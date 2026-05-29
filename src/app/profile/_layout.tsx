import { Stack } from 'expo-router';

import { stackScreenOptions } from '@/lib/theme';

export default function ProfileStackLayout() {
  return <Stack screenOptions={stackScreenOptions} />;
}
