import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/lib/auth-context';
import { listVehicleMods, type ModWithPart } from '@/lib/mods';
import {
  listOwnershipHistory,
  type OwnershipTransferRow,
} from '@/lib/ownership';
import { publicBuildUrl } from '@/lib/public-build';
import { buildValueFootnote, buildValueLabel } from '@/lib/valuation';
import { supabase } from '@/lib/supabase';
import {
  listVehicleWishlist,
  removeWishlistItem,
  wishlistDisplayName,
  type WishlistItem,
} from '@/lib/wishlist';
import type { Database } from '@/types/database';

type Vehicle = Database['public']['Tables']['vehicles']['Row'];

export default function VehicleProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [mods, setMods] = useState<ModWithPart[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [history, setHistory] = useState<OwnershipTransferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isOwner = !!(session && vehicle && session.user.id === vehicle.current_owner_id);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [{ data: v, error: vErr }, modList, wishlistList, historyList] =
        await Promise.all([
          supabase.from('vehicles').select('*').eq('id', id).maybeSingle(),
          listVehicleMods(id),
          // Wishlist is owner-only via RLS; non-owners just get an empty array.
          listVehicleWishlist(id).catch(() => []),
          listOwnershipHistory(id).catch(() => []),
        ]);
      if (vErr) throw vErr;
      setVehicle(v);
      setMods(modList);
      setWishlist(wishlistList);
      setHistory(historyList);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load vehicle';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  async function handleShare() {
    if (!vehicle) return;
    const shareTitle =
      vehicle.nickname ?? `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
    const url = publicBuildUrl(vehicle.id);
    try {
      await Share.share({
        message: `Check out this build on Wired Build: ${shareTitle} — ${url}`,
        url,
        title: shareTitle,
      });
    } catch {
      // user dismissed
    }
  }

  async function handleRemoveWishlistItem(itemId: string) {
    const previous = wishlist;
    setWishlist((items) => items.filter((i) => i.id !== itemId));
    try {
      await removeWishlistItem(itemId);
    } catch (err) {
      setWishlist(previous);
      const message = err instanceof Error ? err.message : 'Could not remove item';
      Alert.alert('Remove failed', message);
    }
  }

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
        {vehicle.cover_photo_url ? (
          <Image
            source={{ uri: vehicle.cover_photo_url }}
            className="mb-5 h-48 w-full rounded-2xl bg-ink-800"
            resizeMode="cover"
          />
        ) : null}

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
            label={buildValueLabel(vehicle.valuation_source)}
            value={
              vehicle.build_value
                ? `$${Number(vehicle.build_value).toLocaleString()}`
                : '—'
            }
          />
        </View>
        {vehicle.build_value != null && Number(vehicle.build_value) > 0 ? (
          <Text className="mt-2 text-xs text-ink-300">
            {buildValueFootnote(vehicle.valuation_source)}
          </Text>
        ) : null}

        <View className="mt-6 flex-row flex-wrap gap-2">
          <Pressable
            onPress={() => router.push(`/log/new?vehicleId=${vehicle.id}`)}
            className="rounded-xl bg-accent px-4 py-2.5 active:bg-accent-dark"
          >
            <Text className="font-semibold text-ink-950">+ Log a mod</Text>
          </Pressable>
          {vehicle.is_public ? (
            <Pressable
              onPress={handleShare}
              className="rounded-xl border border-ink-700 bg-ink-900 px-4 py-2.5 active:bg-ink-800"
            >
              <Text className="font-semibold text-ink-200">Share</Text>
            </Pressable>
          ) : null}
          {isOwner ? (
            <>
              <Pressable
                onPress={() =>
                  router.push(`/vehicle/edit?vehicleId=${vehicle.id}`)
                }
                className="rounded-xl border border-ink-700 bg-ink-900 px-4 py-2.5 active:bg-ink-800"
              >
                <Text className="font-semibold text-ink-200">Edit</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  router.push(`/vehicle/transfer?vehicleId=${vehicle.id}`)
                }
                className="rounded-xl border border-ink-700 bg-ink-900 px-4 py-2.5 active:bg-ink-800"
              >
                <Text className="font-semibold text-ink-200">Transfer</Text>
              </Pressable>
            </>
          ) : null}
        </View>
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

      {/* ---- Wishlist (owner-only) ---- */}
      {isOwner ? (
        <View className="px-6 pt-6">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-semibold uppercase tracking-[2px] text-ink-300">
              Wishlist
            </Text>
            <Pressable
              onPress={() => router.push(`/wishlist/new?vehicleId=${vehicle.id}`)}
              className="rounded-lg border border-ink-700 px-2.5 py-1 active:bg-ink-800"
            >
              <Text className="text-xs font-semibold text-accent">+ Add</Text>
            </Pressable>
          </View>
          {wishlist.length === 0 ? (
            <Text className="mt-3 text-sm text-ink-300">
              Nothing planned yet. Tap <Text className="text-accent">+ Add</Text> to start
              building a parts list.
            </Text>
          ) : (
            <View className="mt-3 gap-2">
              {wishlist.map((item) => (
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
                    <Pressable
                      onPress={() =>
                        router.push(
                          `/log/new?vehicleId=${vehicle.id}&wishlistId=${item.id}`
                        )
                      }
                      className="rounded-lg bg-accent px-3 py-1.5 active:bg-accent-dark"
                    >
                      <Text className="text-xs font-semibold text-ink-950">Log it</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleRemoveWishlistItem(item.id)}
                      className="rounded-lg border border-ink-700 px-3 py-1.5 active:bg-ink-800"
                    >
                      <Text className="text-xs text-ink-300">Remove</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}
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
                  {m.part ? (
                    <Pressable
                      onPress={() => router.push(`/part/${m.part!.id}`)}
                      className="mt-1 active:opacity-80"
                    >
                      <Text className="text-base font-semibold text-white">
                        {m.part.brand}
                      </Text>
                      <Text className="text-ink-200">{m.part.name}</Text>
                    </Pressable>
                  ) : (
                    <Text className="mt-1 text-ink-200">
                      {m.custom_part_name ?? 'Unknown part'}
                    </Text>
                  )}
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
                  {isOwner ? (
                    <View className="mt-4 flex-row gap-2">
                      <Pressable
                        onPress={() =>
                          router.push(`/log/edit?modId=${m.id}`)
                        }
                        className="rounded-lg border border-ink-700 px-3 py-1.5 active:bg-ink-800"
                      >
                        <Text className="text-xs font-semibold text-ink-200">
                          Edit
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ---- Ownership history ---- */}
      <OwnershipHistorySection
        history={history}
        onOpenUser={(handle) => router.push(`/user/${handle}`)}
      />
    </ScrollView>
  );
}

function OwnershipHistorySection({
  history,
  onOpenUser,
}: {
  history: OwnershipTransferRow[];
  onOpenUser: (handle: string) => void;
}) {
  if (history.length === 0) {
    return (
      <View className="px-6 pt-6">
        <Text className="text-xs font-semibold uppercase tracking-[2px] text-ink-300">
          Ownership history
        </Text>
        <Text className="mt-3 text-sm text-ink-300">
          One owner so far. When this build is transferred, the full chain
          shows up here for any future buyer to audit.
        </Text>
      </View>
    );
  }
  return (
    <View className="px-6 pt-6">
      <Text className="text-xs font-semibold uppercase tracking-[2px] text-ink-300">
        Ownership history
      </Text>
      <View className="mt-3 gap-2">
        {history.map((row) => (
          <View
            key={row.id}
            className="rounded-2xl border border-ink-700 bg-ink-900 p-4"
          >
            <Text className="text-[10px] uppercase tracking-wider text-ink-300">
              {formatDate(row.created_at)}
            </Text>
            <View className="mt-1 flex-row flex-wrap items-center gap-1">
              {row.from_user ? (
                <Pressable onPress={() => onOpenUser(row.from_user!.handle)}>
                  <Text className="font-semibold text-white">
                    @{row.from_user.handle}
                  </Text>
                </Pressable>
              ) : (
                <Text className="font-semibold text-ink-300">unknown</Text>
              )}
              <Text className="text-ink-300">→</Text>
              {row.to_user ? (
                <Pressable onPress={() => onOpenUser(row.to_user!.handle)}>
                  <Text className="font-semibold text-accent">
                    @{row.to_user.handle}
                  </Text>
                </Pressable>
              ) : (
                <Text className="font-semibold text-ink-300">unknown</Text>
              )}
            </View>
            {row.note ? (
              <Text className="mt-1 text-sm text-ink-300">{row.note}</Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function PriorityPill({ priority }: { priority: 'low' | 'medium' | 'high' }) {
  const styles = {
    low: 'bg-ink-700 text-ink-200',
    medium: 'bg-accent/20 text-accent',
    high: 'bg-accent text-ink-950',
  } as const;
  return (
    <View className={`rounded-full px-2 py-0.5 ${styles[priority].split(' ')[0]}`}>
      <Text
        className={`text-[10px] font-bold uppercase tracking-wider ${
          styles[priority].split(' ')[1]
        }`}
      >
        {priority}
      </Text>
    </View>
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
