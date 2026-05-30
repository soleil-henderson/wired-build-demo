import '../global.css';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import {
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { Stack, useRouter, useSegments } from 'expo-router';
import { Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { WebAppHistoryGuard } from '@/components/layout/WebAppHistoryGuard';
import { WebAppShell } from '@/components/layout/WebAppShell';
import { WebHttpsRedirect } from '@/components/layout/WebHttpsRedirect';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import {
  resolvePostAuthRoute,
  syncAccountTypeFromAuthMetadata,
} from '@/lib/account-routing';
import { getMyProfile } from '@/lib/profile';
import { subscribeToNotificationTaps } from '@/lib/push-notifications';
import { useStackScreenOptions } from '@/lib/stack-options';
import { ThemeProvider, useTheme } from '@/lib/theme-context';
import { UnreadNotificationsProvider } from '@/lib/unread-notifications-context';
import { UnreadMessagesProvider } from '@/lib/unread-messages-context';

function ThemedStatusBar() {
  const { theme } = useTheme();
  return <StatusBar style={theme.statusBar} />;
}

SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const stackHeaderLight = useStackScreenOptions();

  useEffect(() => {
    if (isLoading) return;

    const firstSegment = segments[0] ?? '';
    const inAuthGroup = firstSegment === '(auth)';
    // Public share routes are reachable without an account — they're the
    // whole point of the "transferable, monetisable asset" pitch.
    const isPublicRoute =
      firstSegment === 'build' ||
      firstSegment === 'legal' ||
      firstSegment === 'workshop' ||
      firstSegment === 'auth';

    if (!session && !inAuthGroup && !isPublicRoute) {
      router.replace('/(auth)/sign-in');
      return;
    }

    if (!session) return;

    void syncAccountTypeFromAuthMetadata(
      session.user.id,
      session.user.user_metadata as Record<string, unknown>
    );

    if (inAuthGroup) {
      const authScreen = segments[1] ?? '';
      if (authScreen === 'onboarding' || authScreen === 'verify-email') {
        return;
      }
      void getMyProfile(session.user.id)
        .then((profile) => {
          router.replace(resolvePostAuthRoute(profile));
        })
        .catch((err) => {
          console.error('[auth] profile load after sign-in', err);
          router.replace('/(auth)/onboarding');
        });
      return;
    }

    void getMyProfile(session.user.id)
      .then((profile) => {
        if (!profile?.handle?.trim() && !inAuthGroup && !isPublicRoute) {
          router.replace('/(auth)/onboarding');
        }
      })
      .catch((err) => {
        console.error('[auth] profile load', err);
      });
  }, [session, isLoading, segments, router]);

  // Route the user to the right place when they tap a push notification.
  // The deep-link URL is set server-side in the push payload — see the
  // notifications-push migration.
  useEffect(() => {
    return subscribeToNotificationTaps((url) => {
      try {
        // Strip the scheme + leading slashes so router.push gets a
        // relative path it can resolve (e.g. /post/abc).
        const path = url.replace(/^[a-z0-9+\-.]+:\/\//i, '/').replace(/^\/+/, '/');
        router.push(path as Parameters<typeof router.push>[0]);
      } catch (err) {
        console.warn('[push] failed to route notification tap', err);
      }
    });
  }, [router]);

  const rootStackOptions = useMemo(
    () => ({
      headerShown: false,
      freezeOnBlur: true,
      ...(Platform.OS === 'web' ? { animation: 'none' as const } : {}),
    }),
    []
  );

  return (
    <Stack screenOptions={rootStackOptions}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="notifications"
        options={{
          ...stackHeaderLight,
          title: 'Notifications',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="stories"
        options={{
          headerShown: false,
          animation: Platform.select({
            ios: 'slide_from_left',
            android: 'slide_from_left',
            default: 'slide_from_left',
          }),
          animationDuration: 280,
        }}
      />
      <Stack.Screen name="messages" />
      <Stack.Screen name="build" />
      <Stack.Screen name="explore" options={stackHeaderLight} />
      <Stack.Screen name="event" options={stackHeaderLight} />
      <Stack.Screen name="legal" options={stackHeaderLight} />
      <Stack.Screen name="settings" options={stackHeaderLight} />
      <Stack.Screen name="admin" options={stackHeaderLight} />
      <Stack.Screen name="workshop" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <WebHttpsRedirect>
      <SafeAreaProvider>
        <ThemeProvider>
          <WebAppShell>
            <WebAppHistoryGuard />
            <ErrorBoundary>
              <AuthProvider>
                <UnreadNotificationsProvider>
                  <UnreadMessagesProvider>
                    <RootStack />
                    <ThemedStatusBar />
                  </UnreadMessagesProvider>
                </UnreadNotificationsProvider>
              </AuthProvider>
            </ErrorBoundary>
          </WebAppShell>
        </ThemeProvider>
      </SafeAreaProvider>
      </WebHttpsRedirect>
    </GestureHandlerRootView>
  );
}
