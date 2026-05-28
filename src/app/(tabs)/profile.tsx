import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth-context';
import { getFollowCounts, type FollowCounts } from '@/lib/follows';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type Profile = Database['public']['Tables']['users']['Row'];

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [counts, setCounts] = useState<FollowCounts>({ followers: 0, following: 0 });
  const [vehicleCount, setVehicleCount] = useState<number>(0);

  const load = useCallback(async () => {
    if (!session) return;
    const userId = session.user.id;
    const [{ data: p, error }, fc, { count: vc }] = await Promise.all([
      supabase.from('users').select('*').eq('id', userId).maybeSingle(),
      getFollowCounts(userId),
      supabase
        .from('vehicles')
        .select('id', { count: 'exact', head: true })
        .eq('current_owner_id', userId),
    ]);
    if (error) Alert.alert('Could not load profile', error.message);
    setProfile(p);
    setCounts(fc);
    setVehicleCount(vc ?? 0);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['top']}>
      <ScrollView contentContainerClassName="px-6 pt-6 pb-24">
        <Text className="text-accent text-xs font-semibold tracking-[3px]">PROFILE</Text>
        <Text className="mt-1 text-3xl font-bold text-white">
          {profile?.display_name ?? session?.user.email ?? 'Builder'}
        </Text>
        {profile?.handle ? (
          <Text className="mt-1 text-ink-300">@{profile.handle}</Text>
        ) : null}

        {/* Stats */}
        <View className="mt-6 flex-row gap-6">
          <Stat label="Vehicles" value={String(vehicleCount)} />
          <Stat label="Followers" value={String(counts.followers)} />
          <Stat label="Following" value={String(counts.following)} />
        </View>

        {/* Actions */}
        <View className="mt-6 flex-row flex-wrap gap-2">
          {profile?.handle ? (
            <Pressable
              onPress={() => router.push(`/user/${profile.handle}`)}
              className="rounded-xl bg-accent px-4 py-2.5 active:bg-accent-dark"
            >
              <Text className="font-semibold text-ink-950">View public profile</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => router.push('/wishlist')}
            className="rounded-xl border border-ink-700 bg-ink-900 px-4 py-2.5 active:bg-ink-800"
          >
            <Text className="font-semibold text-ink-200">My wishlist</Text>
          </Pressable>
        </View>

        <View className="mt-8 rounded-2xl border border-ink-700 bg-ink-900 p-6">
          <Text className="text-xs uppercase tracking-wider text-ink-300">Subscription</Text>
          <Text className="mt-1 text-lg font-semibold capitalize text-white">
            {profile?.subscription_tier ?? 'free'}
          </Text>
          <Text className="mt-2 text-ink-300">
            Member, Pro and Workshop tiers unlock affiliate rates, badges and verification.
          </Text>
        </View>

        <Pressable
          onPress={() => signOut()}
          className="mt-8 self-start rounded-xl border border-ink-700 px-4 py-2"
        >
          <Text className="text-ink-300">Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text className="text-[10px] uppercase tracking-wider text-ink-300">{label}</Text>
      <Text className="mt-1 text-base font-semibold text-white">{value}</Text>
    </View>
  );
}
