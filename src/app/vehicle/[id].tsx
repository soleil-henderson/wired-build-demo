import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import { listVehicleMods, type ModWithPart } from '@/lib/mods';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type Vehicle = Database['public']['Tables']['vehicles']['Row'];

export default function VehicleProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [mods, setMods] = useState<ModWithPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [{ data: v, error: vErr }, modList] = await Promise.all([
        supabase.from('vehicles').select('*').eq('id', id).maybeSingle(),
        listVehicleMods(id),
      ]);
      if (vErr) throw vErr;
      setVehicle(v);
      setMods(modList);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load vehicle';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-ink-950">
        <Stack.Screen options={{ title: 'Build profile' }} />
        <ActivityIndicator color="#F5A524" />
      </View>
    );
  }

  if (!vehicle) {
    return (
      <View className="flex-1 items-center justify-center bg-ink-950 px-6">
        <Stack.Screen options={{ title: 'Not found' }} />
        <Text className="text-white">This vehicle isn&apos;t available.</Text>
      </View>
    );
  }

  const title = vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`;
  const spendByCategory = aggregateSpend(mods);

  return (
    <ScrollView
      className="flex-1 bg-ink-950"
      contentContainerClassName="pb-24"
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
      <Stack.Screen options={{ title }} />

      {/* ---- Hero ---- */}
      <View className="bg-ink-900 px-6 pt-6 pb-8">
        <Text className="text-xs uppercase tracking-wider text-ink-300">
          {vehicle.year} · {vehicle.make} · {vehicle.model}
          {vehicle.trim ? ` · ${vehicle.trim}` : ''}
        </Text>
        <Text className="mt-1 text-3xl font-bold text-white">{title}</Text>
        <Text className="mt-2 font-mono text-xs text-ink-300">
          VIN ····{vehicle.vin.slice(-6)}
        </Text>

        <View className="mt-5 flex-row gap-6">
          <Stat label="Mods" value={String(mods.length)} />
          <Stat label="Spent" value={`$${Number(vehicle.total_spend).toLocaleString()}`} />
          <Stat
            label="Build value"
            value={
              vehicle.build_value ? `$${Number(vehicle.build_value).toLocaleString()}` : '—'
            }
          />
        </View>

        <Pressable
          onPress={() => router.push(`/log/new?vehicleId=${vehicle.id}`)}
          className="mt-6 self-start rounded-xl bg-accent px-4 py-2.5 active:bg-accent-dark"
        >
          <Text className="font-semibold text-ink-950">+ Log a mod</Text>
        </Pressable>
      </View>

      {/* ---- Spend breakdown ---- */}
      {spendByCategory.length > 0 ? (
        <View className="px-6 pt-6">
          <Text className="text-xs font-semibold uppercase tracking-[2px] text-ink-300">
            Spend by category
          </Text>
          <View className="mt-3 gap-2">
            {spendByCategory.map((row) => (
              <View
                key={row.category}
                className="flex-row items-center justify-between rounded-xl border border-ink-700 bg-ink-900 px-4 py-3"
              >
                <Text className="capitalize text-ink-200">
                  {row.category.replace('_', ' ')}
                </Text>
                <Text className="font-semibold text-white">
                  ${row.total.toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* ---- Mods timeline ---- */}
      <View className="px-6 pt-6">
        <Text className="text-xs font-semibold uppercase tracking-[2px] text-ink-300">
          Mods timeline
        </Text>
        {mods.length === 0 ? (
          <View className="mt-3 rounded-2xl border border-ink-700 bg-ink-900 p-6">
            <Text className="text-ink-200 text-base font-semibold">No mods yet</Text>
            <Text className="mt-1 text-ink-300">
              Log your first mod to start the build history.
            </Text>
            <Pressable
              onPress={() => router.push(`/log/new?vehicleId=${vehicle.id}`)}
              className="mt-4 self-start rounded-xl bg-accent px-4 py-2.5 active:bg-accent-dark"
            >
              <Text className="font-semibold text-ink-950">Log a mod</Text>
            </Pressable>
          </View>
        ) : (
          <View className="mt-3 gap-3">
            {mods.map((m) => (
              <View
                key={m.id}
                className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900"
              >
                {m.photo_url ? (
                  <Image
                    source={{ uri: m.photo_url }}
                    className="h-48 w-full bg-ink-800"
                    resizeMode="cover"
                  />
                ) : null}
                <View className="p-4">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[11px] uppercase tracking-wider text-ink-300">
                      {m.category.replace('_', ' ')}
                    </Text>
                    <Text className="text-xs text-ink-300">
                      {formatDate(m.install_date)}
                      {m.date_is_approximate ? ' ~' : ''}
                    </Text>
                  </View>
                  <Text className="mt-1 text-base font-semibold text-white">
                    {m.part ? m.part.brand : ''}
                  </Text>
                  <Text className="text-ink-200">
                    {m.part?.name ?? m.custom_part_name ?? 'Unknown part'}
                  </Text>
                  <View className="mt-3 flex-row items-center justify-between">
                    <Text className="text-sm text-ink-300">
                      {labelForInstaller(m.installer_type)}
                    </Text>
                    <Text className="text-sm font-semibold text-white">
                      {m.cost == null
                        ? '—'
                        : `${m.cost_is_approximate ? '~' : ''}$${Number(m.cost).toLocaleString()}`}
                    </Text>
                  </View>
                  {m.notes ? (
                    <Text className="mt-2 text-sm text-ink-300">{m.notes}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
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

function aggregateSpend(mods: ModWithPart[]) {
  const byCat = new Map<string, number>();
  for (const m of mods) {
    if (m.cost == null) continue;
    byCat.set(m.category, (byCat.get(m.category) ?? 0) + Number(m.cost));
  }
  return [...byCat.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
  } catch {
    return iso;
  }
}

function labelForInstaller(t: string) {
  switch (t) {
    case 'self':
      return 'Installed myself';
    case 'workshop':
      return 'Workshop install';
    case 'friend':
      return 'Friend install';
    case 'dealer':
      return 'Dealer install';
    default:
      return t;
  }
}
