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
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { WebAppShell } from '@/components/layout/WebAppShell';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { subscribeToNotificationTaps } from '@/lib/push-notifications';
import { stackScreenOptions } from '@/lib/theme';
import { UnreadNotificationsProvider } from '@/lib/unread-notifications-context';

const stackHeaderLight = stackScreenOptions;

SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const firstSegment = segments[0] ?? '';
    const inAuthGroup = firstSegment === '(auth)';
    // Public share routes are reachable without an account — they're the
    // whole point of the "transferable, monetisable asset" pitch.
    const isPublicRoute =
      firstSegment === 'build' || firstSegment === 'legal' || firstSegment === 'workshop';

    if (!session && !inAuthGroup && !isPublicRoute) {
      router.replace('/(auth)/sign-in');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
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

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="notifications"
        options={{
          ...stackHeaderLight,
          title: 'Notifications',
        }}
      />
      <Stack.Screen name="build" />
      <Stack.Screen name="legal" options={stackHeaderLight} />
      <Stack.Screen name="settings" options={stackHeaderLight} />
      <Stack.Screen name="admin" options={stackHeaderLight} />
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
      <SafeAreaProvider>
        <WebAppShell>
          <ErrorBoundary>
            <AuthProvider>
              <UnreadNotificationsProvider>
                <RootStack />
                <StatusBar style="dark" />
              </UnreadNotificationsProvider>
            </AuthProvider>
          </ErrorBoundary>
        </WebAppShell>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
