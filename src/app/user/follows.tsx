import { Ionicons } from '@expo/vector-icons';
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

import { FollowButton } from '@/components/social/FollowButton';
import { UserBadges } from '@/components/UserBadges';
import { useAuth } from '@/lib/auth-context';
import {
  listFollowers,
  listFollowing,
  type FollowUser,
} from '@/lib/follows';
import { routeParam } from '@/lib/route-param';
import { getUserByHandle } from '@/lib/users';
import { colors } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

export default function FollowsScreen() {
  const params = useLocalSearchParams<{ handle: string; tab?: string }>();
  const handle = routeParam(params.handle);
  const tab = params.tab === 'following' ? 'following' : 'followers';
  const { session } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<FollowUser[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!handle) return;
    try {
      const profile = await getUserByHandle(handle);
      if (!profile) {
        setUsers([]);
        return;
      }
      setDisplayName(profile.display_name);
      const rows =
        tab === 'following'
          ? await listFollowing(profile.id)
          : await listFollowers(profile.id);
      setUsers(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load list';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [handle, tab]);

  const listKey = `${handle ?? ''}:${tab}`;

  const resetList = useCallback(() => {
    setUsers([]);
    setLoading(true);
  }, []);

  useFocusData(
    async ({ isInitial }) => {
      if (isInitial && users.length === 0) setLoading(true);
      await load();
    },
    [load],
    { cacheKey: listKey, onCacheKeyChange: resetList }
  );

  const title = tab === 'following' ? 'Following' : 'Followers';

  return (
    <View className="flex-1 bg-apple-bg2">
      <Stack.Screen options={{ title: `@${handle ?? ''} · ${title}` }} />

      <View className="flex-row bg-apple-bg2 px-4">
        <TabChip
          label="Followers"
          active={tab === 'followers'}
          onPress={() =>
            router.setParams({ handle, tab: 'followers' })
          }
        />
        <TabChip
          label="Following"
          active={tab === 'following'}
          onPress={() =>
            router.setParams({ handle, tab: 'following' })
          }
        />
      </View>

      {loading && users.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl
              tintColor={colors.accent}
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          contentContainerClassName="pb-12"
        >
          {users.length === 0 ? (
            <View className="mx-4 mt-8 rounded-2xl border border-apple-border bg-white p-6">
              <Text className="font-semibold text-apple-ink">
                {tab === 'following'
                  ? `${displayName || handle} isn\u2019t following anyone yet`
                  : 'No followers yet'}
              </Text>
            </View>
          ) : (
            users.map((u) => (
              <View
                key={u.id}
                className="flex-row items-center gap-3 border-b border-apple-border/60 bg-white px-4 py-3.5"
              >
                <Pressable
                  onPress={() => router.push(`/user/${u.handle}`)}
                  className="flex-1 flex-row items-center gap-3 active:opacity-80"
                >
                  {u.avatar_url ? (
                    <Image
                      source={{ uri: u.avatar_url }}
                      className="h-11 w-11 rounded-full bg-apple-bg2"
                    />
                  ) : (
                    <View className="h-11 w-11 items-center justify-center rounded-full bg-apple-bg2">
                      <Text className="font-bold text-accent">
                        {(u.display_name || u.handle)[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View className="min-w-0 flex-1">
                    <View className="flex-row items-center gap-1.5">
                      <Text className="font-semibold text-apple-ink">{u.display_name}</Text>
                      <UserBadges user={u} />
                    </View>
                    <Text className="text-sm text-apple-secondary">@{u.handle}</Text>
                  </View>
                </Pressable>
                {session?.user.id !== u.id ? (
                  <FollowButton userId={u.id} handle={u.handle} />
                ) : null}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

function TabChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`mr-6 border-b-2 py-3 ${active ? 'border-accent' : 'border-transparent'}`}
    >
      <Text
        className={`text-sm font-semibold ${
          active ? 'text-apple-ink' : 'text-apple-secondary'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
