import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { UserBadges } from '@/components/UserBadges';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { getUserByHandle } from '@/lib/users';
import type { UserProfile } from '@/lib/users';

export default function WorkshopPublicScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!handle) return;
    const u = await getUserByHandle(handle);
    setUser(u);
    setLoading(false);
  }, [handle]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-apple-bg2">
        <ActivityIndicator color="#FF6A2B" />
      </View>
    );
  }

  if (!user || !user.is_workshop) {
    return (
      <View className="flex-1 bg-apple-bg2 px-6 pt-12">
        <Stack.Screen options={{ title: 'Workshop' }} />
        <Text className="text-apple-ink">Workshop not found.</Text>
      </View>
    );
  }

  const businessName = user.workshop_name ?? user.display_name;

  return (
    <ScrollView className="flex-1 bg-apple-bg2" contentContainerClassName="pb-12">
      <Stack.Screen options={{ title: businessName }} />
      <ScreenHeader
        eyebrow="WORKSHOP"
        title={businessName}
        subtitle={user.bio ?? 'Installer on Wired Build'}
      />

      <View className="mx-6 mt-4 flex-row flex-wrap items-center gap-2">
        <UserBadges user={user} size="lg" />
        <Text className="text-apple-secondary">@{user.handle}</Text>
      </View>

      <View className="mx-6 mt-6 gap-3">
        {user.workshop_phone ? (
          <Pressable
            onPress={() => Linking.openURL(`tel:${user.workshop_phone}`)}
            className="rounded-xl border border-apple-border bg-white px-4 py-3"
          >
            <Text className="text-apple-secondary text-xs uppercase">Phone</Text>
            <Text className="mt-1 font-semibold text-apple-ink">{user.workshop_phone}</Text>
          </Pressable>
        ) : null}
        {user.workshop_website ? (
          <Pressable
            onPress={() => Linking.openURL(user.workshop_website!)}
            className="rounded-xl border border-apple-border bg-white px-4 py-3"
          >
            <Text className="text-apple-secondary text-xs uppercase">Website</Text>
            <Text className="mt-1 font-semibold text-accent">{user.workshop_website}</Text>
          </Pressable>
        ) : null}
      </View>

      <View className="mx-6 mt-8 gap-3">
        <Pressable
          onPress={() => {
            const email = user.workshop_phone
              ? `mailto:support@wiredautogroup.com?subject=Workshop%20enquiry%20for%20${encodeURIComponent(businessName)}`
              : 'mailto:support@wiredautogroup.com';
            Linking.openURL(email);
          }}
          className="rounded-xl bg-accent py-3.5"
        >
          <Text className="text-center font-semibold text-white">Contact workshop</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push(`/user/${user.handle}`)}
          className="rounded-xl border border-apple-border py-3"
        >
          <Text className="text-center font-semibold text-apple-secondary">View builder profile</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
