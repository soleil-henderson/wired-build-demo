import { Stack } from 'expo-router';

import { stackScreenOptions } from '@/lib/theme';

export default function SettingsLayout() {
  return <Stack screenOptions={stackScreenOptions} />;
}
