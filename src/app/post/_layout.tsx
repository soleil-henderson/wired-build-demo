import { Stack } from 'expo-router';

import { stackScreenOptions } from '@/lib/theme';

export default function PostStackLayout() {
  return <Stack screenOptions={stackScreenOptions} />;
}
