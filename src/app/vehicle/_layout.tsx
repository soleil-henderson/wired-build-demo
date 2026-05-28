import { Stack } from 'expo-router';

export default function VehicleStackLayout() {
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
