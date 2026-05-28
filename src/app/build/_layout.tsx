import { Stack } from 'expo-router';

/**
 * Public share route. Reachable without auth — the root layout exempts the
 * `build` segment from the auth gate.
 */
export default function BuildStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0E1014' },
        headerTintColor: '#E2E5EC',
        headerTitleStyle: { color: '#E2E5EC' },
        contentStyle: { backgroundColor: '#08090B' },
      }}
    />
  );
}
