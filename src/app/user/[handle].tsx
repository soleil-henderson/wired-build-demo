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
  getFollowCounts,
  isFollowing,
  toggleFollow,
  type FollowCounts,
} from '@/lib/follows';
import {
  getUserByHandle,
  listUserVehicles,
  type UserProfile,
  type VehicleSummary,
} from '@/lib/users';

export default function UserProfileScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const { session } = useAuth();
  const router = useRouter();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [counts, setCounts] = useState<FollowCounts>({ followers: 0, following: 0 });
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!handle) return;
    try {
      const u = await getUserByHandle(handle);
      setUser(u);
      if (!u) return;
      const [vs, fc, isF] = await Promise.all([
        listUserVehicles(u.id),
        getFollowCounts(u.id),
        session ? isFollowing(session.user.id, u.id) : Promise.resolve(false),
      ]);
      setVehicles(vs);
      setCounts(fc);
      setFollowing(isF);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load profile';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [handle, session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleToggleFollow() {
    if (!session || !user) {
      Alert.alert('Sign in', 'Sign in to follow.');
      return;
    }
    setBusy(true);
    const previously = following;
    setFollowing(!previously);
    setCounts((c) => ({
      ...c,
      followers: Math.max(0, c.followers + (previously ? -1 : 1)),
    }));
    try {
      await toggleFollow(session.user.id, user.id, previously);
    } catch (err) {
      setFollowing(previously);
      setCounts((c) => ({
        ...c,
        followers: Math.max(0, c.followers + (previously ? 1 : -1)),
      }));
      const message = err instanceof Error ? err.message : 'Could not update follow';
      Alert.alert('Follow failed', message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-ink-950">
        <Stack.Screen options={{ title: 'Profile' }} />
        <ActivityIndicator color="#F5A524" />
      </View>
    );
  }

  if (!user) {
    return (
      <View className="flex-1 items-center justify-center bg-ink-950 px-6">
        <Stack.Screen options={{ title: 'Not found' }} />
        <Text className="text-white">No such user.</Text>
      </View>
    );
  }

  const isSelf = session?.user.id === user.id;

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
      <Stack.Screen options={{ title: `@${user.handle}` }} />

      {/* ---- Hero ---- */}
      <View className="bg-ink-900 px-6 pt-6 pb-6">
        <View className="flex-row items-center gap-4">
          {user.avatar_url ? (
            <Image
              source={{ uri: user.avatar_url }}
              className="h-16 w-16 rounded-full bg-ink-700"
            />
          ) : (
            <View className="h-16 w-16 items-center justify-center rounded-full bg-ink-700">
              <Text className="text-xl font-bold text-white">
                {(user.display_name || user.handle || '?')[0].toUpperCase()}
              </Text>
            </View>
          )}
          <View className="flex-1">
            <Text className="text-xl font-bold text-white">{user.display_name}</Text>
            <Text className="text-ink-300">@{user.handle}</Text>
            <View className="mt-1.5 flex-row flex-wrap items-center gap-1.5">
              <UserBadges user={user} size="lg" />
              <Text className="text-[11px] uppercase tracking-wider text-ink-300">
                {user.subscription_tier} tier
              </Text>
            </View>
          </View>
        </View>

        {user.bio ? (
          <Text className="mt-4 text-ink-200">{user.bio}</Text>
        ) : null}

        <View className="mt-5 flex-row gap-6">
          <Stat label="Vehicles" value={String(vehicles.length)} />
          <Stat label="Followers" value={String(counts.followers)} />
          <Stat label="Following" value={String(counts.following)} />
        </View>

        {!isSelf ? (
          <Pressable
            onPress={handleToggleFollow}
            disabled={busy}
            className={`mt-5 self-start rounded-xl px-5 py-2.5 ${
              following ? 'border border-ink-600 bg-ink-800' : 'bg-accent'
            } disabled:opacity-60`}
          >
            <Text
              className={`font-semibold ${
                following ? 'text-ink-200' : 'text-ink-950'
              }`}
            >
              {following ? 'Following' : 'Follow'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* ---- Garage ---- */}
      <View className="px-6 pt-6">
        <Text className="text-xs font-semibold uppercase tracking-[2px] text-ink-300">
          Garage
        </Text>
        {vehicles.length === 0 ? (
          <Text className="mt-3 text-sm text-ink-300">
            No public vehicles yet.
          </Text>
        ) : (
          <View className="mt-3 gap-3">
            {vehicles.map((v) => (
              <Pressable
                key={v.id}
                onPress={() => router.push(`/vehicle/${v.id}`)}
                className="rounded-2xl border border-ink-700 bg-ink-900 p-4 active:bg-ink-800"
              >
                <Text className="text-xs uppercase tracking-wider text-ink-300">
                  {v.year} · {v.make} · {v.model}
                  {v.trim ? ` · ${v.trim}` : ''}
                </Text>
                <Text className="mt-1 text-lg font-semibold text-white">
                  {v.nickname ?? `${v.make} ${v.model}`}
                </Text>
                <View className="mt-3 flex-row gap-6">
                  <Stat label="Mods" value={String(v.mod_count)} />
                  <Stat
                    label="Spent"
                    value={`$${Number(v.total_spend).toLocaleString()}`}
                  />
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
