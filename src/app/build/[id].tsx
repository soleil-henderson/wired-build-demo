import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from 'react-native';

import { UserBadges } from '@/components/UserBadges';
import { useAuth } from '@/lib/auth-context';
import {
  getPublicBuild,
  publicBuildUrl,
  type PublicBuild,
  type PublicBuildMod,
} from '@/lib/public-build';
import { buildValueFootnote, buildValueLabel } from '@/lib/valuation';

export default function PublicBuildScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();

  const [build, setBuild] = useState<PublicBuild | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const data = await getPublicBuild(id);
    if (!data) {
      setNotFound(true);
    } else {
      setBuild(data);
    }
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleShare() {
    if (!build || !id) return;
    const title =
      build.vehicle.nickname ??
      `${build.vehicle.year} ${build.vehicle.make} ${build.vehicle.model}`;
    const url = publicBuildUrl(id);
    try {
      await Share.share({
        message: `Check out this build on Wired Build: ${title} — ${url}`,
        url,
        title,
      });
    } catch {
      // user dismissed
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-ink-950">
        <Stack.Screen options={{ title: 'Build' }} />
        <ActivityIndicator color="#F5A524" />
      </View>
    );
  }

  if (notFound || !build) {
    return (
      <View className="flex-1 items-center justify-center bg-ink-950 px-6">
        <Stack.Screen options={{ title: 'Not found' }} />
        <Text className="text-3xl font-bold text-white">404</Text>
        <Text className="mt-2 text-center text-ink-300">
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
    <ScrollView className="flex-1 bg-ink-950" contentContainerClassName="pb-12">
      <Stack.Screen options={{ title }} />

      {/* ---- Wired Build banner (only when viewer is logged-out, for the
            marketplace pitch — the page works as a standalone URL) ---- */}
      {!session ? (
        <View className="flex-row items-center justify-between bg-ink-900 px-6 py-3">
          <View>
            <Text className="text-[10px] uppercase tracking-[3px] text-accent">
              Wired Build
            </Text>
            <Text className="text-xs text-ink-300">Logged build history</Text>
          </View>
          <Pressable
            onPress={() => router.push('/(auth)/sign-up')}
            className="rounded-lg bg-accent px-3 py-1.5 active:bg-accent-dark"
          >
            <Text className="text-xs font-semibold text-ink-950">Sign up</Text>
          </Pressable>
        </View>
      ) : null}

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
            onPress={handleShare}
            className="rounded-xl bg-accent px-4 py-2.5 active:bg-accent-dark"
          >
            <Text className="font-semibold text-ink-950">Share</Text>
          </Pressable>
          {isViewerOwner ? (
            <Pressable
              onPress={() => router.push(`/vehicle/${vehicle.id}`)}
              className="rounded-xl border border-ink-700 bg-ink-900 px-4 py-2.5 active:bg-ink-800"
            >
              <Text className="font-semibold text-ink-200">Manage build</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* ---- Owner card ---- */}
      {vehicle.owner ? (
        <View className="mx-6 mt-6 rounded-2xl border border-ink-700 bg-ink-900 p-4">
          <Text className="text-[10px] uppercase tracking-wider text-ink-300">
            Current owner
          </Text>
          <Pressable
            onPress={() => router.push(`/user/${vehicle.owner!.handle}`)}
            className="mt-3 flex-row items-center gap-3 active:opacity-80"
          >
            {vehicle.owner.avatar_url ? (
              <Image
                source={{ uri: vehicle.owner.avatar_url }}
                className="h-12 w-12 rounded-full bg-ink-700"
              />
            ) : (
              <View className="h-12 w-12 items-center justify-center rounded-full bg-ink-700">
                <Text className="text-lg font-bold text-white">
                  {(vehicle.owner.display_name || vehicle.owner.handle || '?')[0].toUpperCase()}
                </Text>
              </View>
            )}
            <View className="flex-1">
              <View className="flex-row items-center gap-1.5">
                <Text className="font-semibold text-white">
                  {vehicle.owner.display_name}
                </Text>
                <UserBadges user={vehicle.owner} />
              </View>
              <Text className="text-xs text-ink-300">@{vehicle.owner.handle}</Text>
            </View>
          </Pressable>
          {vehicle.owner.bio ? (
            <Text className="mt-3 text-sm text-ink-200">{vehicle.owner.bio}</Text>
          ) : null}
        </View>
      ) : null}

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
          <Text className="mt-3 text-sm text-ink-300">
            No public mods yet.
          </Text>
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
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ---- Ownership history (the marketplace-trust section) ---- */}
      <View className="px-6 pt-6">
        <Text className="text-xs font-semibold uppercase tracking-[2px] text-ink-300">
          Ownership history
        </Text>
        {history.length === 0 ? (
          <Text className="mt-3 text-sm text-ink-300">
            One owner since this build was logged on Wired Build.
          </Text>
        ) : (
          <View className="mt-3 gap-2">
            {history.map((h) => (
              <View
                key={h.id}
                className="rounded-2xl border border-ink-700 bg-ink-900 p-4"
              >
                <Text className="text-[10px] uppercase tracking-wider text-ink-300">
                  {formatDate(h.created_at)}
                </Text>
                <View className="mt-1 flex-row flex-wrap items-center gap-1">
                  {h.from_user ? (
                    <Pressable onPress={() => router.push(`/user/${h.from_user!.handle}`)}>
                      <Text className="font-semibold text-white">@{h.from_user.handle}</Text>
                    </Pressable>
                  ) : (
                    <Text className="font-semibold text-ink-300">unknown</Text>
                  )}
                  <Text className="text-ink-300">→</Text>
                  {h.to_user ? (
                    <Pressable onPress={() => router.push(`/user/${h.to_user!.handle}`)}>
                      <Text className="font-semibold text-accent">@{h.to_user.handle}</Text>
                    </Pressable>
                  ) : (
                    <Text className="font-semibold text-ink-300">unknown</Text>
                  )}
                </View>
                {h.note ? (
                  <Text className="mt-1 text-sm text-ink-300">{h.note}</Text>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ---- Footer / sign-up CTA ---- */}
      {!session ? (
        <View className="mx-6 mt-8 rounded-2xl border border-accent/40 bg-accent/10 p-6">
          <Text className="text-lg font-semibold text-white">
            Got a build of your own?
          </Text>
          <Text className="mt-1 text-sm text-ink-200">
            Wired Build keeps a permanent, transferable record of every mod —
            part, brand, cost, install date. When you sell, the history goes
            with the VIN.
          </Text>
          <Pressable
            onPress={() => router.push('/(auth)/sign-up')}
            className="mt-4 self-start rounded-xl bg-accent px-4 py-2.5 active:bg-accent-dark"
          >
            <Text className="font-semibold text-ink-950">Start logging your build</Text>
          </Pressable>
          {Platform.OS === 'web' ? (
            <Pressable
              onPress={() => Linking.openURL('https://wiredbuild.app')}
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
      <Text className="text-[10px] uppercase tracking-wider text-ink-300">{label}</Text>
      <Text className="mt-1 text-base font-semibold text-white">{value}</Text>
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
