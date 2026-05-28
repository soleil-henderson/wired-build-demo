import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
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

import { UserBadges } from '@/components/UserBadges';
import { useAuth } from '@/lib/auth-context';
import {
  getPartById,
  getPartStats,
  listPartInstalls,
  type Part,
  type PartInstall,
  type PartStats,
} from '@/lib/parts';
import { addWishlistItem } from '@/lib/wishlist';
import type { ModCategory } from '@/types/database';

export default function PartDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();

  const [part, setPart] = useState<Part | null>(null);
  const [stats, setStats] = useState<PartStats | null>(null);
  const [installs, setInstalls] = useState<PartInstall[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [p, s, i] = await Promise.all([
        getPartById(id),
        getPartStats(id),
        listPartInstalls(id, 20),
      ]);
      setPart(p);
      setStats(s);
      setInstalls(i);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load part';
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

  async function handleSave() {
    if (!part) return;
    if (!session) {
      Alert.alert('Sign in', 'Sign in to save parts to your wishlist.');
      return;
    }
    setSaving(true);
    try {
      await addWishlistItem({
        userId: session.user.id,
        vehicleId: null,
        partId: part.id,
        customPartName: null,
        category: part.category as ModCategory,
        targetCost: null,
        notes: null,
        priority: 'medium',
      });
      Alert.alert(
        'Saved',
        `${part.brand} ${part.name} added to your wishlist. View it from Profile → My wishlist.`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save';
      Alert.alert('Save failed', message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-ink-950">
        <Stack.Screen options={{ title: 'Part' }} />
        <ActivityIndicator color="#F5A524" />
      </View>
    );
  }

  if (!part) {
    return (
      <View className="flex-1 items-center justify-center bg-ink-950 px-6">
        <Stack.Screen options={{ title: 'Not found' }} />
        <Text className="text-white">This part isn&apos;t available.</Text>
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
      <Stack.Screen options={{ title: part.brand }} />

      {/* ---- Hero ---- */}
      <View className="bg-ink-900 px-6 pt-6 pb-6">
        <Text className="text-[11px] uppercase tracking-wider text-accent">
          {part.category.replace('_', ' ')}
        </Text>
        <Text className="mt-2 text-2xl font-bold text-white">{part.brand}</Text>
        <Text className="mt-1 text-lg text-ink-200">{part.name}</Text>
        {!part.is_approved ? (
          <View className="mt-3 self-start rounded-full bg-ink-700 px-2 py-0.5">
            <Text className="text-[10px] font-bold uppercase tracking-wider text-ink-200">
              Awaiting review
            </Text>
          </View>
        ) : null}

        <View className="mt-5 flex-row gap-6">
          <Stat label="Installs" value={String(stats?.installCount ?? 0)} />
          <Stat
            label="Avg cost"
            value={
              stats?.averageCost != null
                ? `$${Math.round(stats.averageCost).toLocaleString()}`
                : '—'
            }
          />
          <Stat
            label="Last installed"
            value={stats?.lastInstalledAt ? formatRelative(stats.lastInstalledAt) : '—'}
          />
        </View>

        {stats && stats.installCount > 0 ? (
          <View className="mt-4 flex-row gap-4">
            <Text className="text-xs text-ink-300">
              <Text className="font-semibold text-ink-200">
                {stats.installerSelf}
              </Text>{' '}
              DIY
            </Text>
            <Text className="text-xs text-ink-300">
              <Text className="font-semibold text-ink-200">
                {stats.installerWorkshop}
              </Text>{' '}
              workshop
            </Text>
            <Text className="text-xs text-ink-300">
              Total spent{' '}
              <Text className="font-semibold text-ink-200">
                ${Math.round(stats.totalSpent).toLocaleString()}
              </Text>
            </Text>
          </View>
        ) : null}

        <Pressable
          onPress={handleSave}
          disabled={saving}
          className="mt-6 self-start rounded-xl bg-accent px-4 py-2.5 active:bg-accent-dark disabled:opacity-60"
        >
          {saving ? (
            <ActivityIndicator color="#08090B" />
          ) : (
            <Text className="font-semibold text-ink-950">+ Save to wishlist</Text>
          )}
        </Pressable>
      </View>

      {/* ---- Recent installs ---- */}
      <View className="px-6 pt-6">
        <Text className="text-xs font-semibold uppercase tracking-[2px] text-ink-300">
          Recent installs
        </Text>
        {installs.length === 0 ? (
          <View className="mt-3 rounded-2xl border border-ink-700 bg-ink-900 p-5">
            <Text className="text-base font-semibold text-ink-200">
              No public installs yet
            </Text>
            <Text className="mt-1 text-sm text-ink-300">
              Be the first to log this part on one of your builds.
            </Text>
          </View>
        ) : (
          <View className="mt-3 gap-3">
            {installs.map((row) => (
              <Pressable
                key={row.modId}
                onPress={() => {
                  if (row.vehicle?.id) router.push(`/vehicle/${row.vehicle.id}`);
                }}
                disabled={!row.vehicle?.id}
                className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 active:bg-ink-800"
              >
                {row.photoUrl ? (
                  <Image
                    source={{ uri: row.photoUrl }}
                    className="h-44 w-full bg-ink-800"
                    resizeMode="cover"
                  />
                ) : null}
                <View className="p-4">
                  <View className="flex-row items-center gap-2">
                    {row.owner ? (
                      <Pressable
                        onPress={() => router.push(`/user/${row.owner!.handle}`)}
                        className="flex-row items-center gap-2 active:opacity-80"
                      >
                        {row.owner.avatar_url ? (
                          <Image
                            source={{ uri: row.owner.avatar_url }}
                            className="h-7 w-7 rounded-full bg-ink-700"
                          />
                        ) : (
                          <View className="h-7 w-7 items-center justify-center rounded-full bg-ink-700">
                            <Text className="text-[10px] font-bold text-white">
                              {(row.owner.display_name || row.owner.handle || '?')[0].toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <Text className="text-sm font-semibold text-white">
                          @{row.owner.handle}
                        </Text>
                        <UserBadges user={row.owner} />
                      </Pressable>
                    ) : null}
                    <Text className="ml-auto text-[11px] text-ink-300">
                      {formatDate(row.installDate)}
                      {row.dateIsApproximate ? ' ~' : ''}
                    </Text>
                  </View>
                  {row.vehicle ? (
                    <Text className="mt-2 text-xs uppercase tracking-wider text-ink-300">
                      {row.vehicle.nickname ??
                        `${row.vehicle.year} ${row.vehicle.make} ${row.vehicle.model}`}
                    </Text>
                  ) : null}
                  <View className="mt-2 flex-row items-center justify-between">
                    <Text className="text-xs text-ink-300">
                      {labelForInstaller(row.installerType)}
                    </Text>
                    <Text className="text-sm font-semibold text-white">
                      {row.cost == null
                        ? '—'
                        : `${row.costIsApproximate ? '~' : ''}$${Number(row.cost).toLocaleString()}`}
                    </Text>
                  </View>
                </View>
              </Pressable>
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

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatRelative(iso: string) {
  try {
    const ms = Date.now() - new Date(iso).getTime();
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    if (days < 1) return 'today';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  } catch {
    return '—';
  }
}

function labelForInstaller(t: string) {
  switch (t) {
    case 'self':
      return 'DIY install';
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
