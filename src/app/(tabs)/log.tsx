import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppleCard } from '@/components/apple/AppleCard';
import { AppleHeader } from '@/components/apple/AppleHeader';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import type { Database } from '@/types/database';

type Vehicle = Database['public']['Tables']['vehicles']['Row'];

export default function LogTabScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      if (!session) return;
      setLoading(true);
      supabase
        .from('vehicles')
        .select('*')
        .eq('current_owner_id', session.user.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          if (cancelled) return;
          setVehicles(data ?? []);
          setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [session])
  );

  return (
    <SafeAreaView className="flex-1 bg-apple-bg2" edges={['top']}>
      <AppleHeader title="Log a mod" />
      <ScrollView contentContainerClassName="px-4 pb-28 pt-2">
        <Text className="mb-4 text-[15px] text-apple-secondary">
          Pick the vehicle this mod is going on.
        </Text>

        {loading ? (
          <View className="mt-12 items-center">
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : vehicles.length === 0 ? (
          <AppleCard padded>
            <Text className="text-base font-semibold text-apple-ink">No vehicles yet</Text>
            <Text className="mt-1 text-apple-secondary">
              Add your 4WD first — mods attach to its VIN.
            </Text>
            <Pressable
              onPress={() => router.push('/garage/add-vehicle')}
              className="mt-4 self-start rounded-xl bg-accent px-4 py-2.5 active:opacity-90"
            >
              <Text className="font-semibold text-white">Add your vehicle</Text>
            </Pressable>
          </AppleCard>
        ) : (
          <View className="gap-3">
            {vehicles.map((v) => (
              <Pressable
                key={v.id}
                onPress={() => router.push(`/log/new?vehicleId=${v.id}`)}
              >
                <AppleCard style={{ padding: 16 }}>
                  <Text className="text-xs font-medium text-apple-secondary">
                    {v.year} · {v.make} · {v.model}
                  </Text>
                  <Text
                    className="mt-1 text-xl font-bold text-apple-ink"
                    style={{ letterSpacing: -0.4 }}
                  >
                    {v.nickname ?? `${v.make} ${v.model}`}
                  </Text>
                  <Text className="mt-3 text-sm font-semibold text-accent">
                    Log a mod →
                  </Text>
                </AppleCard>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
