import { Stack, useFocusEffect, useRouter } from 'expo-router';
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

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import {
  listUserWishlist,
  removeWishlistItem,
  wishlistDisplayName,
  type WishlistItem,
} from '@/lib/wishlist';

type VehicleStub = {
  id: string;
  year: number;
  make: string;
  model: string;
  nickname: string | null;
};

type Group = {
  vehicleId: string | null;
  vehicle: VehicleStub | null;
  items: WishlistItem[];
};

export default function WishlistIndexScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) {
      setLoading(false);
      return;
    }
    try {
      const items = await listUserWishlist(session.user.id);
      const vehicleIds = Array.from(
        new Set(items.map((i) => i.vehicle_id).filter((id): id is string => !!id))
      );
      const vehicleMap = new Map<string, VehicleStub>();
      if (vehicleIds.length > 0) {
        const { data } = await supabase
          .from('vehicles')
          .select('id, year, make, model, nickname')
          .in('id', vehicleIds);
        for (const v of data ?? []) vehicleMap.set(v.id, v);
      }
      const byVehicle = new Map<string | null, WishlistItem[]>();
      for (const item of items) {
        const key = item.vehicle_id;
        const list = byVehicle.get(key) ?? [];
        list.push(item);
        byVehicle.set(key, list);
      }
      const groups: Group[] = [];
      // General group first if it has items.
      if (byVehicle.has(null)) {
        groups.push({ vehicleId: null, vehicle: null, items: byVehicle.get(null)! });
      }
      for (const [vid, list] of byVehicle.entries()) {
        if (vid === null) continue;
        groups.push({
          vehicleId: vid,
          vehicle: vehicleMap.get(vid) ?? null,
          items: list,
        });
      }
      setGroups(groups);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load wishlist';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleRemove(id: string) {
    const previous = groups;
    setGroups((gs) =>
      gs
        .map((g) => ({ ...g, items: g.items.filter((i) => i.id !== id) }))
        .filter((g) => g.items.length > 0)
    );
    try {
      await removeWishlistItem(id);
    } catch (err) {
      setGroups(previous);
      const message = err instanceof Error ? err.message : 'Could not remove';
      Alert.alert('Remove failed', message);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-ink-950">
        <Stack.Screen options={{ title: 'My wishlist' }} />
        <ActivityIndicator color="#F5A524" />
      </View>
    );
  }

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
      <Stack.Screen options={{ title: 'My wishlist' }} />

      <View className="px-6 pt-6">
        <Text className="text-accent text-xs font-semibold tracking-[3px]">WISHLIST</Text>
        <Text className="mt-1 text-3xl font-bold text-white">What&apos;s next</Text>
        <Text className="mt-2 text-ink-300">
          Parts you&apos;re planning to install — grouped by build, with anything
          un-assigned in General.
        </Text>
        <Pressable
          onPress={() => router.push('/wishlist/new')}
          className="mt-5 self-start rounded-xl bg-accent px-4 py-2.5 active:bg-accent-dark"
        >
          <Text className="font-semibold text-ink-950">+ Add item</Text>
        </Pressable>
      </View>

      {groups.length === 0 ? (
        <View className="mx-6 mt-8 rounded-2xl border border-ink-700 bg-ink-900 p-6">
          <Text className="text-base font-semibold text-ink-200">Empty for now</Text>
          <Text className="mt-1 text-ink-300">
            Open Explore and tap <Text className="text-accent">+ Wishlist</Text> on any
            popular part, or hit <Text className="text-accent">+ Add</Text> on a build
            profile to plan a specific upgrade.
          </Text>
        </View>
      ) : (
        <View className="mt-6 gap-6 px-6">
          {groups.map((g) => {
            const header = g.vehicle
              ? g.vehicle.nickname ??
                `${g.vehicle.year} ${g.vehicle.make} ${g.vehicle.model}`
              : 'General';
            return (
              <View key={g.vehicleId ?? 'general'}>
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-semibold uppercase tracking-[2px] text-ink-300">
                    {header}
                  </Text>
                  {g.vehicle ? (
                    <Pressable onPress={() => router.push(`/vehicle/${g.vehicle!.id}`)}>
                      <Text className="text-xs font-semibold text-accent">Open build</Text>
                    </Pressable>
                  ) : null}
                </View>
                <View className="mt-2 gap-2">
                  {g.items.map((item) => (
                    <View
                      key={item.id}
                      className="rounded-xl border border-ink-700 bg-ink-900 px-4 py-3"
                    >
                      <View className="flex-row items-center gap-2">
                        <PriorityPill priority={item.priority} />
                        {item.category ? (
                          <Text className="text-[10px] uppercase tracking-wider text-ink-300">
                            {item.category.replace('_', ' ')}
                          </Text>
                        ) : null}
                      </View>
                      <Text className="mt-1 text-base font-semibold text-white">
                        {wishlistDisplayName(item)}
                      </Text>
                      {item.target_cost != null ? (
                        <Text className="mt-1 text-sm text-ink-200">
                          Target ${Number(item.target_cost).toLocaleString()}
                        </Text>
                      ) : null}
                      {item.notes ? (
                        <Text className="mt-1 text-sm text-ink-300">{item.notes}</Text>
                      ) : null}
                      <View className="mt-3 flex-row gap-2">
                        {g.vehicleId ? (
                          <Pressable
                            onPress={() =>
                              router.push(
                                `/log/new?vehicleId=${g.vehicleId}&wishlistId=${item.id}`
                              )
                            }
                            className="rounded-lg bg-accent px-3 py-1.5 active:bg-accent-dark"
                          >
                            <Text className="text-xs font-semibold text-ink-950">
                              Log it
                            </Text>
                          </Pressable>
                        ) : null}
                        <Pressable
                          onPress={() => handleRemove(item.id)}
                          className="rounded-lg border border-ink-700 px-3 py-1.5 active:bg-ink-800"
                        >
                          <Text className="text-xs text-ink-300">Remove</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

function PriorityPill({ priority }: { priority: 'low' | 'medium' | 'high' }) {
  const palette = {
    low: { bg: 'bg-ink-700', text: 'text-ink-200' },
    medium: { bg: 'bg-accent/20', text: 'text-accent' },
    high: { bg: 'bg-accent', text: 'text-ink-950' },
  } as const;
  const tone = palette[priority];
  return (
    <View className={`rounded-full px-2 py-0.5 ${tone.bg}`}>
      <Text className={`text-[10px] font-bold uppercase tracking-wider ${tone.text}`}>
        {priority}
      </Text>
    </View>
  );
}
