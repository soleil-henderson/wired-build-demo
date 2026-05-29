import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';

/**
 * Push-notification glue. Strategy:
 *   - Server side: a Postgres trigger on `notifications` POSTs to the Expo
 *     Push API via pg_net. So we don't ship any custom backend code — the
 *     client just has to keep `users.push_token` accurate.
 *   - Client side: register on sign-in, clear on sign-out, route to
 *     `data.url` when the user taps a notification.
 */

// Foreground display: show banners even when the app is open, so a comment
// landing while the user is in the Feed is still visible.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    // Badge count is synced from the notifications table via setAppBadgeCount.
    shouldSetBadge: false,
  }),
});

/** Sync the iOS home-screen app icon badge (no-op on web/Android). */
export async function setAppBadgeCount(count: number): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, count));
  } catch (err) {
    console.warn('[push] failed to set badge count', err);
  }
}

function getProjectId(): string | undefined {
  // SDK 54 / EAS: the project id lives in expoConfig.extra.eas.projectId
  // once `eas init` has been run. Pre-EAS / dev: undefined — we still try
  // to get a token because Expo Go's legacy fallback works without one.
  const cfg = Constants.expoConfig as
    | { extra?: { eas?: { projectId?: string } } }
    | null
    | undefined;
  const eas = (Constants as unknown as { easConfig?: { projectId?: string } })
    .easConfig;
  return cfg?.extra?.eas?.projectId ?? eas?.projectId;
}

/**
 * Request notification permission, fetch the Expo push token, and persist
 * it on the user row. Safe to call repeatedly — re-saving the same token
 * is a no-op.
 *
 * Returns the token on success, or null on simulator / denied permission /
 * any other no-op.
 */
export async function registerForPushNotificationsAsync(
  userId: string
): Promise<string | null> {
  if (!Device.isDevice) return null;

  // Android needs a channel before tokens can be issued.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F5A524',
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return null;

  let token: string;
  try {
    const projectId = getProjectId();
    const res = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    token = res.data;
  } catch (err) {
    // Expo Go without an EAS project id will fall back to legacy; if even
    // that fails (e.g. tunnelled session without project) we silently bail.
    console.warn('[push] could not fetch Expo push token', err);
    return null;
  }

  const { error } = await supabase
    .from('users')
    .update({ push_token: token })
    .eq('id', userId);
  if (error) {
    console.warn('[push] failed to save push token', error);
  }

  return token;
}

/**
 * Drops the saved push token. Call on sign-out so the previous user
 * doesn't keep receiving pushes for this device. Best-effort — failures
 * are logged but don't block the sign-out flow.
 */
export async function clearPushToken(userId: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ push_token: null })
    .eq('id', userId);
  if (error) {
    console.warn('[push] failed to clear push token', error);
  }
}

/**
 * Subscribe to notification taps and route the user to `data.url`. Returns
 * a cleanup function. Called once from the root layout.
 */
export function subscribeToNotificationTaps(
  navigate: (url: string) => void
): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as { url?: string };
    if (data?.url) {
      navigate(data.url);
    }
  });
  return () => sub.remove();
}
