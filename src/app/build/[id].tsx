import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { SaveButton } from '@/components/social/SaveButton';
import { UserBadges } from '@/components/UserBadges';
import { MentionText } from '@/components/social/MentionText';
import { useAuth } from '@/lib/auth-context';
import {
  getPublicBuild,
  type PublicBuild,
  type PublicBuildMod,
} from '@/lib/public-build';
import { routeParam } from '@/lib/route-param';
import { useFocusData } from '@/lib/use-focus-data';
import { navigateToModDetail } from '@/lib/mod-nav';
import { sharePublicBuild } from '@/lib/share-build';
import { buildValueFootnote, buildValueLabel } from '@/lib/valuation';

export default function PublicBuildScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = routeParam(params.id);
  const router = useRouter();
  const { session } = useAuth();

  const [build, setBuild] = useState<PublicBuild | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const resetEntity = useCallback(() => {
    setBuild(null);
    setNotFound(false);
    setLoading(true);
  }, []);

  const load = useCallback(
    async ({ isInitial }: { isInitial: boolean }) => {
      if (!id) {
        setLoading(false);
        setNotFound(true);
        return;
      }
      if (isInitial) setLoading(true);
      const data = await getPublicBuild(id);
      if (!data) {
        setNotFound(true);
        setBuild(null);
      } else {
        setBuild(data);
        setNotFound(false);
      }
      setLoading(false);
    },
    [id]
  );

  useFocusData(load, [load], { cacheKey: id, onCacheKeyChange: resetEntity });

  async function handleShare() {
    if (!build || !id) return;
    const title =
      build.vehicle.nickname ??
      `${build.vehicle.year} ${build.vehicle.make} ${build.vehicle.model}`;
    await sharePublicBuild(id, title);
  }

  if (loading && !build) {
    return (
      <View className="flex-1 items-center justify-center bg-apple-bg2">
        <Stack.Screen options={{ title: 'Build' }} />
        <ActivityIndicator color="#FF6A2B" />
      </View>
    );
  }

  if (notFound || !build) {
    return (
      <View className="flex-1 items-center justify-center bg-apple-bg2 px-6">
        <Stack.Screen options={{ title: 'Not found' }} />
        <Text className="text-3xl font-bold text-apple-ink">404</Text>
        <Text className="mt-2 text-center text-apple-secondary">
          This build is private or no longer exists.
        </Text>
      </View>
    );
  }

  const { vehicle, mods, history } = build;
  const title = vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`;
  const spendByCategory = aggregateSpend(mods);
  const isViewerOwner = !!session && vehicle.owner?.id === session.user.id;

  return (
    <ScrollView className="flex-1 bg-apple-bg2" contentContainerClassName="pb-12">
      <Stack.Screen
        options={{
          title,
          headerRight: () =>
            session && !isViewerOwner ? (
              <SaveButton
                targetType="vehicle"
                targetId={vehicle.id}
                className="mr-2 px-2 active:opacity-70"
              />
            ) : null,
        }}
      />

      {/* ---- Wired Build banner (only when viewer is logged-out, for the
            marketplace pitch — the page works as a standalone URL) ---- */}
      {!session ? (
        <View className="flex-row items-center justify-between bg-white px-6 py-3">
          <View>
            <Text className="text-[10px] uppercase tracking-[3px] text-accent">
              Wired Build
            </Text>
            <Text className="text-xs text-apple-secondary">Logged build history</Text>
          </View>
          <Pressable
            onPress={() => router.push('/(auth)/sign-up')}
            className="rounded-lg bg-accent px-3 py-1.5 active:bg-accent-dark"
          >
            <Text className="text-xs font-semibold text-white">Sign up</Text>
          </Pressable>
        </View>
      ) : null}

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

        {vehicle.is_for_sale ? (
          <View className="mt-4 rounded-xl border border-signal-green/40 bg-signal-green/10 px-4 py-3">
            <Text className="text-xs font-semibold uppercase tracking-wider text-signal-green">
              For sale
            </Text>
            {vehicle.asking_price != null ? (
              <Text className="mt-1 text-xl font-bold text-apple-ink">
                ${Number(vehicle.asking_price).toLocaleString()} AUD
              </Text>
            ) : (
              <Text className="mt-1 text-apple-secondary">Price on application</Text>
            )}
            {vehicle.owner ? (
              <Pressable
                onPress={() => router.push(`/user/${vehicle.owner!.handle}`)}
                className="mt-3 self-start rounded-lg bg-accent px-4 py-2 active:bg-accent-dark"
              >
                <Text className="text-sm font-semibold text-white">Contact owner</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View className="mt-6 flex-row flex-wrap gap-2">
          <Pressable
            onPress={handleShare}
            className="rounded-xl bg-accent px-4 py-2.5 active:bg-accent-dark"
          >
            <Text className="font-semibold text-white">Share</Text>
          </Pressable>
          {isViewerOwner ? (
            <Pressable
              onPress={() => router.push(`/vehicle/${vehicle.id}`)}
              className="rounded-xl border border-apple-border bg-white px-4 py-2.5 active:bg-apple-bg2"
            >
              <Text className="font-semibold text-apple-secondary">Manage build</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* ---- Owner card ---- */}
      {vehicle.owner ? (
        <View className="mx-6 mt-6 rounded-2xl border border-apple-border bg-white p-4">
          <Text className="text-[10px] uppercase tracking-wider text-apple-secondary">
            Current owner
          </Text>
          <Pressable
            onPress={() => router.push(`/user/${vehicle.owner!.handle}`)}
            className="mt-3 flex-row items-center gap-3 active:opacity-80"
          >
            {vehicle.owner.avatar_url ? (
              <Image
                source={{ uri: vehicle.owner.avatar_url }}
                className="h-12 w-12 rounded-full bg-apple-bg2"
              />
            ) : (
              <View className="h-12 w-12 items-center justify-center rounded-full bg-apple-bg2">
                <Text className="text-lg font-bold text-apple-ink">
                  {(vehicle.owner.display_name || vehicle.owner.handle || '?')[0].toUpperCase()}
                </Text>
              </View>
            )}
            <View className="flex-1">
              <View className="flex-row items-center gap-1.5">
                <Text className="font-semibold text-apple-ink">
                  {vehicle.owner.display_name}
                </Text>
                <UserBadges user={vehicle.owner} />
              </View>
              <Text className="text-xs text-apple-secondary">@{vehicle.owner.handle}</Text>
            </View>
          </Pressable>
          {vehicle.owner.bio ? (
            <MentionText
              body={vehicle.owner.bio}
              baseClassName="mt-3 text-sm text-apple-secondary"
            />
          ) : null}
        </View>
      ) : null}

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
                <Text className="font-semibold text-apple-ink">
                  ${row.total.toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* ---- Mods timeline ---- */}
      <View className="px-6 pt-6">
        <Text className="text-xs font-semibold uppercase tracking-[2px] text-apple-secondary">
          Mods timeline
        </Text>
        {mods.length === 0 ? (
          <Text className="mt-3 text-sm text-apple-secondary">
            No public mods yet.
          </Text>
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
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* ---- Ownership history (the marketplace-trust section) ---- */}
      <View className="px-6 pt-6">
        <Text className="text-xs font-semibold uppercase tracking-[2px] text-apple-secondary">
          Ownership history
        </Text>
        {history.length === 0 ? (
          <Text className="mt-3 text-sm text-apple-secondary">
            One owner since this build was logged on Wired Build.
          </Text>
        ) : (
          <View className="mt-3 gap-2">
            {history.map((h) => (
              <View
                key={h.id}
                className="rounded-2xl border border-apple-border bg-white p-4"
              >
                <Text className="text-[10px] uppercase tracking-wider text-apple-secondary">
                  {formatDate(h.created_at)}
                </Text>
                <View className="mt-1 flex-row flex-wrap items-center gap-1">
                  {h.from_user ? (
                    <Pressable onPress={() => router.push(`/user/${h.from_user!.handle}`)}>
                      <Text className="font-semibold text-accent">@{h.from_user.handle}</Text>
                    </Pressable>
                  ) : (
                    <Text className="font-semibold text-apple-secondary">unknown</Text>
                  )}
                  <Text className="text-apple-secondary">→</Text>
                  {h.to_user ? (
                    <Pressable onPress={() => router.push(`/user/${h.to_user!.handle}`)}>
                      <Text className="font-semibold text-accent">@{h.to_user.handle}</Text>
                    </Pressable>
                  ) : (
                    <Text className="font-semibold text-apple-secondary">unknown</Text>
                  )}
                </View>
                {h.note ? (
                  <Text className="mt-1 text-sm text-apple-secondary">{h.note}</Text>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ---- Footer / sign-up CTA ---- */}
      {!session ? (
        <View className="mx-6 mt-8 rounded-2xl border border-accent/40 bg-accent/10 p-6">
          <Text className="text-lg font-semibold text-apple-ink">
            Got a build of your own?
          </Text>
          <Text className="mt-1 text-sm text-apple-secondary">
            Wired Build keeps a permanent, transferable record of every mod —
            part, brand, cost, install date. When you sell, the history goes
            with the VIN.
          </Text>
          <Pressable
            onPress={() => router.push('/(auth)/sign-up')}
            className="mt-4 self-start rounded-xl bg-accent px-4 py-2.5 active:bg-accent-dark"
          >
            <Text className="font-semibold text-white">Start logging your build</Text>
          </Pressable>
          {Platform.OS === 'web' ? (
            <Pressable
              onPress={() => Linking.openURL('https://wiredbuild.com')}
              className="mt-3 self-start"
            >
              <Text className="text-xs font-semibold text-accent">
                More about Wired Build →
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
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

function aggregateSpend(mods: PublicBuildMod[]) {
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
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  } catch {
    return iso;
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
