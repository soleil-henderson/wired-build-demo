import { Stack } from 'expo-router';

import { stackScreenOptions } from '@/lib/theme';

export default function PartStackLayout() {
  return <Stack screenOptions={stackScreenOptions} />;
}
