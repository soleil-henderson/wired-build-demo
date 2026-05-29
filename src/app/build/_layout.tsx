import { Stack } from 'expo-router';

import { stackScreenOptions } from '@/lib/theme';

export default function BuildStackLayout() {
  return (
    <Stack
      screenOptions={{
        ...stackScreenOptions,
        headerShown: true,
      }}
    />
  );
}
