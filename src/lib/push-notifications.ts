import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { supabase } from './supabase';

/**
 * Push-notification glue. Strategy:
 *   - Server side: a Postgres trigger on `notifications` POSTs to the Expo
 *     Push API via pg_net. So we don't ship any custom backend code — the
 *     client just has to keep `users.push_token` accurate.
 *   - Client side: register on sign-in, clear on sign-out, route to
 *     `data.url` when the user taps a notification.
 *
 * expo-notifications is loaded lazily so Expo Go (SDK 53+) without an EAS
 * project id does not import the native module or spam the dev console.
 */

export function getEasProjectId(): string | undefined {
  const cfg = Constants.expoConfig as
    | { extra?: { eas?: { projectId?: string } } }
    | null
    | undefined;
  const eas = (Constants as unknown as { easConfig?: { projectId?: string } })
    .easConfig;
  return cfg?.extra?.eas?.projectId ?? eas?.projectId;
}

/** Remote push tokens are unavailable in Expo Go until `eas init` adds a project id. */
export function isRemotePushSupported(): boolean {
  if (Platform.OS === 'web') return false;
  if (!Device.isDevice) return false;
  if (Constants.appOwnership === 'expo') {
    return Boolean(getEasProjectId());
  }
  return true;
}

type NotificationsModule = typeof import('expo-notifications');

let notificationsModule: NotificationsModule | null = null;
let notificationsLoad: Promise<NotificationsModule | null> | null = null;

async function loadNotifications(): Promise<NotificationsModule | null> {
  if (!isRemotePushSupported()) return null;
  if (notificationsModule) return notificationsModule;
  if (!notificationsLoad) {
    notificationsLoad = import('expo-notifications').then((mod) => {
      mod.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
      notificationsModule = mod;
      return mod;
    });
  }
  return notificationsLoad;
}

/** Sync the iOS home-screen app icon badge (no-op on web/Android/Expo Go without EAS). */
export async function setAppBadgeCount(count: number): Promise<void> {
  if (Platform.OS !== 'ios') return;
  const Notifications = await loadNotifications();
  if (!Notifications) return;
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, count));
  } catch (err) {
    console.warn('[push] failed to set badge count', err);
  }
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
  if (!isRemotePushSupported()) return null;

  const Notifications = await loadNotifications();
  if (!Notifications) return null;

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

  const projectId = getEasProjectId();
  if (!projectId) return null;

  let token: string;
  try {
    const res = await Notifications.getExpoPushTokenAsync({ projectId });
    token = res.data;
  } catch (err) {
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
  if (!isRemotePushSupported()) return () => {};

  let removed = false;
  let removeListener: (() => void) | undefined;

  void loadNotifications().then((Notifications) => {
    if (!Notifications || removed) return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { url?: string };
      if (data?.url) {
        navigate(data.url);
      }
    });
    removeListener = () => sub.remove();
    if (removed) removeListener();
  });

  return () => {
    removed = true;
    removeListener?.();
  };
}
