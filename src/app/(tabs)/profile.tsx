import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type Profile = Database['public']['Tables']['users']['Row'];

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) Alert.alert('Could not load profile', error.message);
        setProfile(data);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

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
