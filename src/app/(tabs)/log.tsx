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

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
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
    <SafeAreaView className="flex-1 bg-ink-950" edges={['top']}>
      <ScrollView contentContainerClassName="px-6 pt-6 pb-24">
        <Text className="text-accent text-xs font-semibold tracking-[3px]">LOG</Text>
        <Text className="mt-1 text-3xl font-bold text-white">Log a mod</Text>
        <Text className="mt-2 text-ink-300">
          Pick the vehicle this mod is going on.
        </Text>

        {loading ? (
          <View className="mt-12 items-center">
            <ActivityIndicator color="#F5A524" />
          </View>
        ) : vehicles.length === 0 ? (
          <View className="mt-8 rounded-2xl border border-ink-700 bg-ink-900 p-6">
            <Text className="text-ink-200 text-base font-semibold">No vehicles yet</Text>
            <Text className="mt-1 text-ink-300">
              Add your 4WD first — mods attach to its VIN.
            </Text>
            <Pressable
              onPress={() => router.push('/garage/add-vehicle')}
              className="mt-4 self-start rounded-xl bg-accent px-4 py-2.5 active:bg-accent-dark"
            >
              <Text className="font-semibold text-ink-950">Add your vehicle</Text>
            </Pressable>
          </View>
        ) : (
          <View className="mt-6 gap-3">
            {vehicles.map((v) => (
              <Pressable
                key={v.id}
                onPress={() => router.push(`/log/new?vehicleId=${v.id}`)}
                className="rounded-2xl border border-ink-700 bg-ink-900 p-5 active:bg-ink-800"
              >
                <Text className="text-xs uppercase tracking-wider text-ink-300">
                  {v.year} · {v.make} · {v.model}
                </Text>
                <Text className="mt-1 text-xl font-bold text-white">
                  {v.nickname ?? `${v.make} ${v.model}`}
                </Text>
                <Text className="mt-3 text-sm font-semibold text-accent">
                  Log a mod for this vehicle →
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
