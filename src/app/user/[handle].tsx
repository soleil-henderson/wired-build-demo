import { useLocalSearchParams } from 'expo-router';

import { UserProfileView } from '@/components/social/UserProfileView';

export default function UserProfileScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  if (!handle) return null;
  return <UserProfileView handle={handle} variant="stack" />;
}
