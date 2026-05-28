import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type Vehicle = Database['public']['Tables']['vehicles']['Row'];
type VehicleWithCount = Vehicle & { mod_count: number };

export default function GarageScreen() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const [vehicles, setVehicles] = useState<VehicleWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const { data: rows, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('current_owner_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      Alert.alert('Could not load garage', error.message);
      setVehicles([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const list = rows ?? [];
    const counts = await Promise.all(
      list.map(async (v) => {
        const { count } = await supabase
          .from('mods')
          .select('id', { count: 'exact', head: true })
          .eq('vehicle_id', v.id);
        return count ?? 0;
      })
    );

    setVehicles(list.map((v, i) => ({ ...v, mod_count: counts[i] })));
    setLoading(false);
    setRefreshing(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function handleAdd() {
    router.push('/garage/add-vehicle');
  }

  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['top']}>
      <ScrollView
        contentContainerClassName="px-6 pt-6 pb-24"
        refreshControl={
          <RefreshControl
            tintColor="#F5A524"
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
      >
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-accent text-xs font-semibold tracking-[3px]">GARAGE</Text>
            <Text className="mt-1 text-3xl font-bold text-white">Your vehicles</Text>
          </View>
          <Pressable
            onPress={handleAdd}
            className="rounded-full bg-accent px-4 py-2 active:bg-accent-dark"
          >
            <Text className="font-semibold text-ink-950">+ Add</Text>
          </Pressable>
        </View>

        {loading ? (
          <View className="mt-12 items-center">
            <ActivityIndicator color="#F5A524" />
          </View>
        ) : vehicles.length === 0 ? (
          <View className="mt-8 rounded-2xl border border-ink-700 bg-ink-900 p-6">
            <Text className="text-ink-200 text-base font-semibold">No vehicles yet</Text>
            <Text className="mt-1 text-ink-300">
              Add your 4WD to start logging mods against its VIN.
            </Text>
            <Pressable
              onPress={handleAdd}
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
                onPress={() => router.push(`/vehicle/${v.id}`)}
                className="rounded-2xl border border-ink-700 bg-ink-900 p-5 active:bg-ink-800"
              >
                <Text className="text-xs uppercase tracking-wider text-ink-300">
                  {v.year} · {v.make} · {v.model}
                  {v.trim ? ` · ${v.trim}` : ''}
                </Text>
                <Text className="mt-1 text-xl font-bold text-white">
                  {v.nickname ?? `${v.make} ${v.model}`}
                </Text>
                <Text className="mt-2 font-mono text-xs text-ink-300">
                  VIN ····{v.vin.slice(-6)}
                </Text>
                <View className="mt-4 flex-row gap-6">
                  <Stat label="Mods" value={String(v.mod_count)} />
                  <Stat
                    label="Spent"
                    value={`$${Number(v.total_spend).toLocaleString()}`}
                  />
                  <Stat
                    label="Build value"
                    value={v.build_value ? `$${Number(v.build_value).toLocaleString()}` : '—'}
                  />
                </View>
              </Pressable>
            ))}
          </View>
        )}

        <Pressable
          onPress={() => signOut()}
          className="mt-12 self-start rounded-xl border border-ink-700 px-4 py-2"
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
