import { Stack } from 'expo-router';

import { stackScreenOptions } from '@/lib/theme';

export default function AdminLayout() {
  return <Stack screenOptions={stackScreenOptions} />;
}
