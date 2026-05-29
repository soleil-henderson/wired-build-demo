import { Stack } from 'expo-router';

import { stackScreenOptions } from '@/lib/theme';

export default function VehicleStackLayout() {
  return <Stack screenOptions={stackScreenOptions} />;
}
