import '../global.css';

import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/lib/auth-context';

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
    const isPublicRoute = firstSegment === 'build';

    if (!session && !inAuthGroup && !isPublicRoute) {
      router.replace('/(auth)/sign-in');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, isLoading, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="notifications"
        options={{
          headerShown: true,
          title: 'Notifications',
          headerStyle: { backgroundColor: '#0E1014' },
          headerTintColor: '#E2E5EC',
          headerTitleStyle: { color: '#E2E5EC' },
          contentStyle: { backgroundColor: '#08090B' },
        }}
      />
      <Stack.Screen name="build" />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <RootStack />
          <StatusBar style={colorScheme === 'light' ? 'dark' : 'light'} />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
