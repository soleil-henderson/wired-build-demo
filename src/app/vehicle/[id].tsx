import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Linking,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/lib/auth-context';
import { useFocusData } from '@/lib/use-focus-data';
import { buildCsvExport, csvExportFilename, shareCsvExport } from '@/lib/export-build';
import { listVehicleMods, type ModWithPart } from '@/lib/mods';
import { navigateToModDetail } from '@/lib/mod-nav';
import { getReceiptSignedUrl } from '@/lib/receipts';
import { canExportBuildData, getUserSubscriptionTier } from '@/lib/subscription';
import {
  listOwnershipHistory,
  type OwnershipTransferRow,
} from '@/lib/ownership';
import { sharePublicBuild } from '@/lib/share-build';
import { routeParam } from '@/lib/route-param';
import { buildValueFootnote, buildValueLabel } from '@/lib/valuation';
import { supabase } from '@/lib/supabase';
import {
  listVehicleWishlist,
  removeWishlistItem,
  wishlistDisplayName,
  type WishlistItem,
} from '@/lib/wishlist';
import type { Database } from '@/types/database';
import { SaveButton } from '@/components/social/SaveButton';
import { VehicleGarageHub } from '@/components/vehicle/VehicleGarageHub';

type Vehicle = Database['public']['Tables']['vehicles']['Row'];

export default function VehicleProfileScreen() {
  const params = useLocalSearchParams<{ id: string; tab?: string }>();
  const id = routeParam(params.id);
  const router = useRouter();
  const { session, isLoading: authLoading } = useAuth();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [mods, setMods] = useState<ModWithPart[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [history, setHistory] = useState<OwnershipTransferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isOwner = !!(session && vehicle && session.user.id === vehicle.current_owner_id);

  const load = useCallback(async ({ isInitial }: { isInitial: boolean }) => {
    if (!id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (authLoading) return;

    if (isInitial) setLoading(true);
    try {
      const { data: v, error: vErr } = await supabase
        .from('vehicles')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (vErr) throw vErr;
      setVehicle(v);

      const ownerView =
        !!session && !!v && session.user.id === v.current_owner_id;

      if (!v || ownerView) {
        setMods([]);
        setWishlist([]);
        setHistory([]);
        return;
      }

      const [modList, wishlistList, historyList] = await Promise.all([
        listVehicleMods(id),
        listVehicleWishlist(id).catch(() => [] as WishlistItem[]),
        listOwnershipHistory(id).catch(() => [] as OwnershipTransferRow[]),
      ]);
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
  }, [id, authLoading, session?.user.id]);

  async function handleExportCsv() {
    if (!vehicle || !session) return;
    try {
      const tier = await getUserSubscriptionTier(session.user.id);
      if (!canExportBuildData(tier)) {
        const message = 'CSV export is available on Pro and Workshop plans.';
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.alert(`Pro feature\n\n${message}`);
        } else {
          Alert.alert('Pro feature', message, [
            { text: 'View plans', onPress: () => router.push('/profile/subscription') },
          ]);
        }
        return;
      }
      const csv = buildCsvExport(vehicle, mods);
      await shareCsvExport(csv, csvExportFilename(vehicle));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not export CSV';
      Alert.alert('Export failed', message);
    }
  }

  async function handleViewReceipt(mod: ModWithPart) {
    if (!mod.receipt_media_id) return;
    try {
      const { data } = await supabase
        .from('media')
        .select('storage_key')
        .eq('id', mod.receipt_media_id)
        .maybeSingle();
      if (!data?.storage_key) return;
      const url = await getReceiptSignedUrl(data.storage_key);
      await Linking.openURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not open receipt';
      Alert.alert('Receipt', message);
    }
  }

  async function handleShare() {
    if (!vehicle) return;
    const shareTitle =
      vehicle.nickname ?? `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
    await sharePublicBuild(vehicle.id, shareTitle);
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

  const resetEntity = useCallback(() => {
    setVehicle(null);
    setMods([]);
    setWishlist([]);
    setHistory([]);
    setLoading(true);
  }, []);

  useFocusData(load, [load], { cacheKey: id, onCacheKeyChange: resetEntity });

  if (authLoading || (loading && !vehicle)) {
    return (
      <View className="flex-1 items-center justify-center bg-apple-bg2">
        <Stack.Screen options={{ title: 'Build profile' }} />
        <ActivityIndicator color="#FF6A2B" />
      </View>
    );
  }

  if (!vehicle) {
    const unavailableMessage = !session
      ? 'Sign in to view this build.'
      : 'This build is private or no longer exists.';
    return (
      <View className="flex-1 items-center justify-center bg-apple-bg2 px-6">
        <Stack.Screen options={{ title: 'Not found' }} />
        <Text className="text-center text-apple-ink">{unavailableMessage}</Text>
        {!session ? (
          <Pressable
            onPress={() => router.push('/(auth)/sign-in')}
            className="mt-4 rounded-xl bg-accent px-4 py-2"
          >
            <Text className="font-semibold text-white">Sign in</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (isOwner) {
    return <VehicleGarageHub vehicleId={vehicle.id} initialTab={params.tab} />;
  }

  const title = vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`;
  const spendByCategory = aggregateSpend(mods);

  return (
    <ScrollView
      className="flex-1 bg-apple-bg2"
      contentContainerClassName="pb-24"
      refreshControl={
        <RefreshControl
          tintColor="#F5A524"
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load({ isInitial: false });
          }}
        />
      }
    >
      <Stack.Screen
        options={{
          title,
          headerRight: () =>
            session && vehicle.is_public ? (
              <SaveButton
                targetType="vehicle"
                targetId={vehicle.id}
                className="mr-2 px-2 active:opacity-70"
              />
            ) : null,
        }}
      />

      {/* ---- Hero ---- */}
      <View className="bg-white px-6 pt-6 pb-8">
        {vehicle.cover_photo_url ? (
          <Image
            source={{ uri: vehicle.cover_photo_url }}
            className="mb-5 h-48 w-full rounded-2xl bg-apple-bg2"
            resizeMode="cover"
          />
        ) : null}

        <Text className="text-xs uppercase tracking-wider text-apple-secondary">
          {vehicle.year} · {vehicle.make} · {vehicle.model}
          {vehicle.trim ? ` · ${vehicle.trim}` : ''}
        </Text>
        <Text className="mt-1 text-3xl font-bold text-apple-ink">{title}</Text>
        <Text className="mt-2 font-mono text-xs text-apple-secondary">
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
          <Text className="mt-2 text-xs text-apple-secondary">
            {buildValueFootnote(vehicle.valuation_source)}
          </Text>
        ) : null}

        <View className="mt-6 flex-row flex-wrap gap-2">
          {vehicle.is_public ? (
            <Pressable
              onPress={handleShare}
              className="rounded-xl border border-apple-border bg-white px-4 py-2.5 active:bg-apple-bg2"
            >
              <Text className="font-semibold text-apple-secondary">Share</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* ---- Spend breakdown ---- */}
      {spendByCategory.length > 0 ? (
        <View className="px-6 pt-6">
          <Text className="text-xs font-semibold uppercase tracking-[2px] text-apple-secondary">
            Spend by category
          </Text>
          <View className="mt-3 gap-2">
            {spendByCategory.map((row) => (
              <View
                key={row.category}
                className="flex-row items-center justify-between rounded-xl border border-apple-border bg-white px-4 py-3"
              >
                <Text className="capitalize text-apple-secondary">
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
            <Text className="text-xs font-semibold uppercase tracking-[2px] text-apple-secondary">
              Wishlist
            </Text>
            <Pressable
              onPress={() => router.push(`/wishlist/new?vehicleId=${vehicle.id}`)}
              className="rounded-lg border border-apple-border px-2.5 py-1 active:bg-apple-bg2"
            >
              <Text className="text-xs font-semibold text-accent">+ Add</Text>
            </Pressable>
          </View>
          {wishlist.length === 0 ? (
            <Text className="mt-3 text-sm text-apple-secondary">
              Nothing planned yet. Tap <Text className="text-accent">+ Add</Text> to start
              building a parts list.
            </Text>
          ) : (
            <View className="mt-3 gap-2">
              {wishlist.map((item) => (
                <View
                  key={item.id}
                  className="rounded-xl border border-apple-border bg-white px-4 py-3"
                >
                  <View className="flex-row items-center gap-2">
                    <PriorityPill priority={item.priority} />
                    {item.category ? (
                      <Text className="text-[10px] uppercase tracking-wider text-apple-secondary">
                        {item.category.replace('_', ' ')}
                      </Text>
                    ) : null}
                  </View>
                  <Text className="mt-1 text-base font-semibold text-apple-ink">
                    {wishlistDisplayName(item)}
                  </Text>
                  {item.target_cost != null ? (
                    <Text className="mt-1 text-sm text-apple-secondary">
                      Target ${Number(item.target_cost).toLocaleString()}
                    </Text>
                  ) : null}
                  {item.notes ? (
                    <Text className="mt-1 text-sm text-apple-secondary">{item.notes}</Text>
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
                      <Text className="text-xs font-semibold text-white">Log it</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleRemoveWishlistItem(item.id)}
                      className="rounded-lg border border-apple-border px-3 py-1.5 active:bg-apple-bg2"
                    >
                      <Text className="text-xs text-apple-secondary">Remove</Text>
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
        <Text className="text-xs font-semibold uppercase tracking-[2px] text-apple-secondary">
          Mods timeline
        </Text>
        {mods.length === 0 ? (
          <View className="mt-3 rounded-2xl border border-apple-border bg-white p-6">
            <Text className="text-base font-semibold text-apple-secondary">No mods yet</Text>
            <Text className="mt-1 text-apple-secondary">
              This build does not have any logged mods yet.
            </Text>
          </View>
        ) : (
          <View className="mt-3 gap-3">
            {mods.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => navigateToModDetail(router, m.id)}
                className="overflow-hidden rounded-2xl border border-apple-border bg-white active:opacity-95"
              >
                {m.photo_url ? (
                  <Image
                    source={{ uri: m.photo_url }}
                    className="h-48 w-full bg-apple-bg2"
                    resizeMode="cover"
                  />
                ) : null}
                <View className="p-4">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[11px] uppercase tracking-wider text-apple-secondary">
                      {m.category.replace('_', ' ')}
                    </Text>
                    <Text className="text-xs text-apple-secondary">
                      {formatDate(m.install_date)}
                      {m.date_is_approximate ? ' ~' : ''}
                    </Text>
                  </View>
                  {m.part ? (
                    <Pressable
                      onPress={() => router.push(`/part/${m.part!.id}`)}
                      className="mt-1 active:opacity-80"
                    >
                      <Text className="text-base font-semibold text-apple-ink">
                        {m.part.brand}
                      </Text>
                      <Text className="text-apple-secondary">{m.part.name}</Text>
                    </Pressable>
                  ) : (
                    <Text className="mt-1 text-apple-secondary">
                      {m.custom_part_name ?? 'Unknown part'}
                    </Text>
                  )}
                  <View className="mt-3 flex-row items-center justify-between">
                    <Text className="text-sm text-apple-secondary">
                      {labelForInstaller(m.installer_type)}
                    </Text>
                    <Text className="text-sm font-semibold text-apple-ink">
                      {m.cost == null
                        ? '—'
                        : `${m.cost_is_approximate ? '~' : ''}$${Number(m.cost).toLocaleString()}`}
                    </Text>
                  </View>
                  {m.notes ? (
                    <Text className="mt-2 text-sm text-apple-secondary">{m.notes}</Text>
                  ) : null}
                  {isOwner ? (
                    <View className="mt-4 flex-row flex-wrap gap-2">
                      {m.has_receipt ? (
                        <Pressable
                          onPress={() => void handleViewReceipt(m)}
                          className="rounded-lg border border-apple-border px-3 py-1.5 active:bg-apple-bg2"
                        >
                          <Text className="text-xs font-semibold text-apple-secondary">
                            Receipt
                          </Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        onPress={() => router.push(`/log/edit?modId=${m.id}`)}
                        className="rounded-lg border border-apple-border px-3 py-1.5 active:bg-apple-bg2"
                      >
                        <Text className="text-xs font-semibold text-apple-secondary">
                          Edit
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </Pressable>
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
        <Text className="text-xs font-semibold uppercase tracking-[2px] text-apple-secondary">
          Ownership history
        </Text>
        <Text className="mt-3 text-sm text-apple-secondary">
          One owner so far. When this build is transferred, the full chain
          shows up here for any future buyer to audit.
        </Text>
      </View>
    );
  }
  return (
    <View className="px-6 pt-6">
      <Text className="text-xs font-semibold uppercase tracking-[2px] text-apple-secondary">
        Ownership history
      </Text>
      <View className="mt-3 gap-2">
        {history.map((row) => (
          <View
            key={row.id}
            className="rounded-2xl border border-apple-border bg-white p-4"
          >
            <Text className="text-[10px] uppercase tracking-wider text-apple-secondary">
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
                <Text className="font-semibold text-apple-secondary">unknown</Text>
              )}
              <Text className="text-apple-secondary">→</Text>
              {row.to_user ? (
                <Pressable onPress={() => onOpenUser(row.to_user!.handle)}>
                  <Text className="font-semibold text-accent">
                    @{row.to_user.handle}
                  </Text>
                </Pressable>
              ) : (
                <Text className="font-semibold text-apple-secondary">unknown</Text>
              )}
            </View>
            {row.note ? (
              <Text className="mt-1 text-sm text-apple-secondary">{row.note}</Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function PriorityPill({ priority }: { priority: 'low' | 'medium' | 'high' }) {
  const styles = {
    low: 'bg-apple-bg2 text-apple-secondary',
    medium: 'bg-accent/20 text-accent',
    high: 'bg-accent text-apple-ink',
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
      <Text className="text-[10px] uppercase tracking-wider text-apple-secondary">{label}</Text>
      <Text className="mt-1 text-base font-semibold text-apple-ink">{value}</Text>
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
