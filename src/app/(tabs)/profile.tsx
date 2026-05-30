import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { UserProfileView } from '@/components/social/UserProfileView';
import { useAuth } from '@/lib/auth-context';
import { getMyProfile } from '@/lib/profile';
import { colors } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

export default function ProfileTab() {
  const { session } = useAuth();
  const router = useRouter();
  const [handle, setHandle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusData(
    async ({ isInitial }) => {
      if (!session) {
        setLoading(false);
        return;
      }
      if (isInitial && !handle) setLoading(true);
      const profile = await getMyProfile(session.user.id);
      setHandle(profile?.handle ?? null);
      setLoading(false);
    },
    [session, handle]
  );

  if (loading && !handle) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-apple-bg2" edges={['top']}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  if (!handle) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-apple-bg2 px-8" edges={['top']}>
        <Text className="text-center text-base text-apple-ink">
          Set up your profile handle to get started.
        </Text>
        <Pressable
          onPress={() => router.push('/profile/edit')}
          className="mt-4 rounded-lg bg-accent px-5 py-2.5 active:opacity-90"
        >
          <Text className="font-semibold text-white">Edit profile</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return <UserProfileView handle={handle} variant="tab" />;
}
