import { Stack } from 'expo-router';

import { stackScreenOptions } from '@/lib/theme';

export default function UserStackLayout() {
  return <Stack screenOptions={stackScreenOptions} />;
}
