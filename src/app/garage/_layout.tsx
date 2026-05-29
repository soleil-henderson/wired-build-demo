import { Stack } from 'expo-router';

import { stackScreenOptions } from '@/lib/theme';

export default function GarageStackLayout() {
  return <Stack screenOptions={stackScreenOptions} />;
}
