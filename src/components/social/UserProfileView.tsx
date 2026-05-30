import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WorkshopProfileSections } from '@/components/profile/WorkshopProfileSections';
import { ProfileAvatar } from '@/components/social/ProfileAvatar';
import { isBusinessProfile } from '@/lib/account-routing';
import { WiredHeaderTitle } from '@/components/ui/WiredHeaderTitle';
import { MentionText } from '@/components/social/MentionText';
import { UserBadges } from '@/components/UserBadges';
import { useAuth } from '@/lib/auth-context';
import { blockUser } from '@/lib/blocks';
import {
  getFollowCounts,
  getFollowStatus,
  toggleFollowStatus,
  type FollowCounts,
  type FollowStatus,
} from '@/lib/follows';
import { listUserPosts, isModPost, resolvePostDisplayMedia, type FeedPost } from '@/lib/feed';
import { getOrCreateConversation } from '@/lib/messages';
import { TAB_SCROLL_BOTTOM_INSET } from '@/lib/tab-screen-layout';
import { colors } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';
import { formatUserLocation, parseUserLocation } from '@/lib/user-location';
import { EventCard } from '@/components/explore/EventCard';
import { listUserEvents, type UserEventsBundle } from '@/lib/events';
import {
  getUserByHandle,
  listUserVehicles,
  type UserProfile,
  type VehicleSummary,
} from '@/lib/users';

type ProfileTab = 'posts' | 'mods' | 'garage' | 'events';

const AVATAR_SIZE = 86;
const GRID_GAP = 2;
const COLS = 3;
const SCREEN_W = Dimensions.get('window').width;
const TILE = Math.floor((SCREEN_W - GRID_GAP * (COLS - 1)) / COLS);

type Props = {
  handle: string;
  variant?: 'tab' | 'stack';
};

export function UserProfileView({ handle, variant = 'stack' }: Props) {
  const { session } = useAuth();
  const router = useRouter();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [userEvents, setUserEvents] = useState<UserEventsBundle>({
    hosting: [],
    attending: [],
  });
  const [counts, setCounts] = useState<FollowCounts>({ followers: 0, following: 0 });
  const [followStatus, setFollowStatus] = useState<FollowStatus>('none');
  const [tab, setTab] = useState<ProfileTab>('posts');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!handle) return;
    try {
      const u = await getUserByHandle(handle);
      setUser(u);
      if (!u) return;
      const [vs, fc, status, ps, evts] = await Promise.all([
        listUserVehicles(u.id),
        getFollowCounts(u.id),
        session ? getFollowStatus(session.user.id, u.id) : Promise.resolve('none' as FollowStatus),
        listUserPosts(u.id, session?.user.id ?? null, 48).catch((err) => {
          console.warn('[profile] posts failed to load', err);
          return [] as FeedPost[];
        }),
        listUserEvents(u.id, session?.user.id ?? null).catch((err) => {
          console.warn('[profile] events failed to load', err);
          return { hosting: [], attending: [] } as UserEventsBundle;
        }),
      ]);
      setVehicles(vs);
      setCounts(fc);
      setFollowStatus(status);
      setPosts(ps);
      setUserEvents(evts);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not load profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [handle, session]);

  const resetEntity = useCallback(() => {
    setUser(null);
    setVehicles([]);
    setPosts([]);
    setUserEvents({ hosting: [], attending: [] });
    setLoading(true);
  }, []);

  useFocusData(
    async ({ isInitial }) => {
      if (isInitial) setLoading(true);
      await load();
    },
    [load],
    { cacheKey: handle, onCacheKeyChange: resetEntity }
  );

  const feedPosts = useMemo(() => posts.filter((p) => !isModPost(p)), [posts]);
  const modPosts = useMemo(() => posts.filter(isModPost), [posts]);

  async function handleToggleFollow() {
    if (!session || !user) {
      Alert.alert('Sign in', 'Sign in to follow.');
      return;
    }
    setBusy(true);
    const prev = followStatus;
    const optimistic =
      prev === 'following'
        ? 'none'
        : prev === 'requested'
          ? 'none'
          : user.is_private
            ? 'requested'
            : 'following';
    setFollowStatus(optimistic);
    if (prev === 'following') {
      setCounts((c) => ({ ...c, followers: Math.max(0, c.followers - 1) }));
    } else if (optimistic === 'following') {
      setCounts((c) => ({ ...c, followers: c.followers + 1 }));
    }
    try {
      const next = await toggleFollowStatus(session.user.id, user.id);
      setFollowStatus(next);
      if (next === 'following' && prev !== 'following') {
        await load();
      } else if (next === 'none' && prev === 'following') {
        setPosts([]);
      }
    } catch (err) {
      setFollowStatus(prev);
      if (prev === 'following') {
        setCounts((c) => ({ ...c, followers: c.followers + 1 }));
      } else if (optimistic === 'following') {
        setCounts((c) => ({ ...c, followers: Math.max(0, c.followers - 1) }));
      }
      Alert.alert('Follow failed', err instanceof Error ? err.message : 'Could not update');
    } finally {
      setBusy(false);
    }
  }

  async function handleMessage() {
    if (!session || !user) {
      Alert.alert('Sign in', 'Sign in to send messages.');
      return;
    }
    setBusy(true);
    try {
      const conversationId = await getOrCreateConversation(user.id);
      router.push(`/messages/${conversationId}`);
    } catch (err) {
      Alert.alert(
        'Message failed',
        err instanceof Error ? err.message : 'Could not start conversation'
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading && !user) {
    const loadingView = (
      <View className="flex-1 items-center justify-center bg-apple-bg2">
        <ActivityIndicator color={colors.accent} />
      </View>
    );
    if (variant === 'tab') {
      return <SafeAreaView className="flex-1 bg-apple-bg2" edges={['top']}>{loadingView}</SafeAreaView>;
    }
    return (
      <View className="flex-1 bg-apple-bg2">
        <Stack.Screen options={{ title: 'Profile' }} />
        {loadingView}
      </View>
    );
  }

  if (!user) {
    const notFound = (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-apple-ink">No such user.</Text>
      </View>
    );
    if (variant === 'tab') {
      return <SafeAreaView className="flex-1 bg-apple-bg2" edges={['top']}>{notFound}</SafeAreaView>;
    }
    return (
      <View className="flex-1 bg-apple-bg2">
        <Stack.Screen options={{ title: 'Not found' }} />
        {notFound}
      </View>
    );
  }

  const isSelf = session?.user.id === user.id;
  const locationLabel = formatUserLocation(parseUserLocation(user.location));
  const canViewContent = isSelf || !user.is_private || followStatus === 'following';
  const followLabel =
    followStatus === 'following'
      ? 'Following'
      : followStatus === 'requested'
        ? 'Requested'
        : 'Follow';
  const followFilled = followStatus === 'none';

  const content = (
    <ScrollView
      className="flex-1 bg-apple-bg2"
      contentContainerStyle={{
        paddingBottom: variant === 'tab' ? TAB_SCROLL_BOTTOM_INSET : 96,
      }}
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
    >
      {variant === 'stack' ? <Stack.Screen options={{ title: `@${user.handle}` }} /> : null}

      {variant === 'tab' ? (
        <View className="bg-apple-bg2 px-4 pb-2.5 pt-1">
          <View className="h-11 items-center justify-center">
            <WiredHeaderTitle size="screen">@{user.handle}</WiredHeaderTitle>
          </View>
        </View>
      ) : null}

      <View className="bg-apple-bg2 px-4 pb-3 pt-4">
        <View className="flex-row items-center">
          <ProfileAvatar
            uri={user.avatar_url}
            name={user.display_name}
            size={AVATAR_SIZE}
            borderWidth={0}
          />
          <View className="ml-6 flex-1 flex-row justify-around">
            <Stat label="Posts" value={String(feedPosts.length)} onPress={() => setTab('posts')} />
            <Stat
              label="Followers"
              value={String(counts.followers)}
              onPress={() => router.push(`/user/follows?handle=${user.handle}&tab=followers`)}
            />
            <Stat
              label="Following"
              value={String(counts.following)}
              onPress={() => router.push(`/user/follows?handle=${user.handle}&tab=following`)}
            />
          </View>
        </View>

        <View className="mt-3">
          <View className="flex-row items-center gap-1.5">
            <Text className="text-sm font-semibold text-apple-ink">{user.display_name}</Text>
            {user.is_private ? (
              <Ionicons name="lock-closed" size={14} color={colors.secondary} />
            ) : null}
          </View>
          {user.bio ? (
            <MentionText
              body={user.bio}
              baseClassName="mt-0.5 text-sm leading-[18px] text-apple-ink"
            />
          ) : null}
          {locationLabel ? (
            <Text className="mt-1 text-sm text-apple-secondary">{locationLabel}</Text>
          ) : null}
          <View className="mt-2">
            <UserBadges user={user} size="inline" />
          </View>
        </View>

        {!isSelf ? (
          <View className="mt-3 flex-row gap-2">
            <Pressable
              onPress={handleToggleFollow}
              disabled={busy}
              className={`min-h-[32px] flex-1 items-center justify-center rounded-lg py-1.5 ${
                followFilled ? 'bg-accent' : 'border border-apple-border bg-apple-bg2'
              }`}
            >
              <Text
                className={`text-sm font-semibold ${followFilled ? 'text-white' : 'text-apple-ink'}`}
              >
                {followLabel}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void handleMessage()}
              disabled={busy}
              className="min-h-[32px] flex-1 items-center justify-center rounded-lg border border-apple-border py-1.5 active:bg-apple-bg2"
            >
              <Text className="text-sm font-semibold text-apple-ink">Message</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (!session) return;
                Alert.alert('Block user?', `Hide @${user.handle} from your feed.`, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Block',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await blockUser(session.user.id, user.id);
                        router.back();
                      } catch (err) {
                        Alert.alert(
                          'Block failed',
                          err instanceof Error ? err.message : 'Could not block'
                        );
                      }
                    },
                  },
                ]);
              }}
              className="min-h-[32px] items-center justify-center rounded-lg border border-apple-border px-3 py-1.5"
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.ink} />
            </Pressable>
          </View>
        ) : (
          <View className="mt-3 flex-row gap-2">
            <Pressable
              onPress={() => router.push('/profile/edit')}
              className="min-h-[32px] flex-1 items-center justify-center rounded-lg border border-apple-border py-1.5 active:bg-apple-bg2"
            >
              <Text className="text-sm font-semibold text-apple-ink">Edit profile</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/settings')}
              className="min-h-[32px] flex-1 items-center justify-center rounded-lg border border-apple-border py-1.5 active:bg-apple-bg2"
            >
              <Text className="text-sm font-semibold text-apple-ink">Settings</Text>
            </Pressable>
          </View>
        )}
      </View>

      {canViewContent && isBusinessProfile(user) ? (
        <WorkshopProfileSections user={user} isSelf={isSelf} />
      ) : null}

      <ProfileIconTabs tab={tab} onChange={setTab} />

      {!canViewContent ? (
        <View className="items-center px-8 py-16">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-full border-2 border-apple-border">
            <Ionicons name="lock-closed" size={28} color={colors.ink} />
          </View>
          <Text className="text-lg font-semibold text-apple-ink">This account is private</Text>
          <Text className="mt-2 text-center text-sm text-apple-secondary">
            Follow this account to see their posts and garage.
          </Text>
        </View>
      ) : null}

      {canViewContent && tab === 'posts' ? (
        feedPosts.length === 0 ? (
          <EmptyTab message="No public posts yet." />
        ) : (
          <View className="flex-row flex-wrap" style={{ gap: GRID_GAP }}>
            {feedPosts.map((p) => {
              const thumb = resolvePostDisplayMedia(p)[0]?.url;
              const multi = resolvePostDisplayMedia(p).length > 1;
              return (
              <Pressable
                key={p.id}
                onPress={() => router.push(`/post/${p.id}`)}
                style={{ width: TILE, height: TILE }}
                className="bg-apple-bg2"
              >
                {thumb ? (
                  <Image
                    source={{ uri: thumb }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                  />
                ) : (
                  <View className="h-full w-full items-center justify-center">
                    <Ionicons name="car-sport-outline" size={28} color={colors.tertiary} />
                  </View>
                )}
                {multi ? (
                  <View className="absolute right-1.5 top-1.5">
                    <Ionicons name="copy-outline" size={16} color="#fff" />
                  </View>
                ) : null}
              </Pressable>
            );
            })}
          </View>
        )
      ) : null}

      {canViewContent && tab === 'mods' ? (
        modPosts.length === 0 ? (
          <EmptyTab message="No public mods logged yet." />
        ) : (
          <View className="gap-2 px-4 pt-2">
            {modPosts.map((p) => {
              const label = p.mod?.part
                ? `${p.mod.part.brand} ${p.mod.part.name}`
                : p.mod?.custom_part_name ?? 'Mod';
              return (
                <Pressable
                  key={p.id}
                  onPress={() => router.push(`/post/${p.id}`)}
                  className="flex-row overflow-hidden rounded-2xl border border-apple-border bg-white active:opacity-90"
                >
                  {p.mod?.photo_url ? (
                    <Image
                      source={{ uri: p.mod.photo_url }}
                      style={{ width: 96, height: 96 }}
                      contentFit="cover"
                    />
                  ) : (
                    <View className="h-24 w-24 items-center justify-center bg-apple-bg2">
                      <Ionicons name="construct-outline" size={24} color={colors.tertiary} />
                    </View>
                  )}
                  <View className="min-w-0 flex-1 justify-center p-3">
                    <Text className="text-[10px] uppercase tracking-wider text-apple-tertiary">
                      {p.mod?.category.replace('_', ' ') ?? 'mod'}
                    </Text>
                    <Text className="mt-0.5 font-semibold text-apple-ink" numberOfLines={2}>
                      {label}
                    </Text>
                    <Text className="mt-1 text-xs text-apple-secondary">
                      {p.vehicle.nickname ?? `${p.vehicle.make} ${p.vehicle.model}`}
                      {p.mod?.cost != null ? ` · $${Number(p.mod.cost).toLocaleString()}` : ''}
                    </Text>
                  </View>
                  <View className="justify-center pr-3">
                    <Ionicons name="chevron-forward" size={18} color={colors.tertiary} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        )
      ) : null}

      {canViewContent && tab === 'garage' ? (
        vehicles.length === 0 ? (
          <EmptyTab message="No public vehicles yet." />
        ) : (
          <View className="gap-3 px-4 pt-2">
            {vehicles.map((v) => (
              <Pressable
                key={v.id}
                onPress={() => router.push(`/vehicle/${v.id}`)}
                className="overflow-hidden rounded-2xl border border-apple-border bg-white active:opacity-90"
              >
                {v.cover_photo_url ? (
                  <Image
                    source={{ uri: v.cover_photo_url }}
                    style={{ width: '100%', height: 144 }}
                    contentFit="cover"
                  />
                ) : (
                  <View
                    className="h-36 w-full items-center justify-center"
                    style={{ backgroundColor: colors.accentSoft }}
                  >
                    <Ionicons name="car-sport-outline" size={40} color={colors.accent} />
                  </View>
                )}
                <View className="p-4">
                  <Text className="text-xs uppercase tracking-wider text-apple-secondary">
                    {v.year} · {v.make} · {v.model}
                  </Text>
                  <Text className="mt-1 text-lg font-semibold text-apple-ink">
                    {v.nickname ?? `${v.make} ${v.model}`}
                  </Text>
                  <View className="mt-3 flex-row gap-6">
                    <MiniStat label="Mods" value={String(v.mod_count)} />
                    <MiniStat
                      label="Spent"
                      value={`$${Number(v.total_spend).toLocaleString()}`}
                    />
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )
      ) : null}

      {canViewContent && tab === 'events' ? (
        <ProfileEventsTab
          bundle={userEvents}
          isSelf={isSelf}
          onCreate={() => router.push('/event/new')}
        />
      ) : null}
    </ScrollView>
  );

  if (variant === 'tab') {
    return (
      <SafeAreaView className="flex-1 bg-apple-bg2" edges={['top']}>
        {content}
      </SafeAreaView>
    );
  }

  return content;
}

function Stat({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const inner = (
    <>
      <Text className="text-center text-[17px] font-semibold text-apple-ink">{value}</Text>
      <Text className="text-center text-[13px] text-apple-ink">{label}</Text>
    </>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} hitSlop={8} className="active:opacity-70">
        {inner}
      </Pressable>
    );
  }
  return <View>{inner}</View>;
}

const PROFILE_TABS: {
  id: ProfileTab;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: 'posts', icon: 'grid-outline' },
  { id: 'mods', icon: 'construct-outline' },
  { id: 'garage', icon: 'car-sport-outline' },
  { id: 'events', icon: 'calendar-outline' },
];

function ProfileIconTabs({
  tab,
  onChange,
}: {
  tab: ProfileTab;
  onChange: (tab: ProfileTab) => void;
}) {
  return (
    <View className="flex-row bg-apple-bg2">
      {PROFILE_TABS.map((item) => {
        const active = tab === item.id;
        return (
          <Pressable
            key={item.id}
            onPress={() => onChange(item.id)}
            className="flex-1 items-center py-3 active:opacity-70"
            style={{
              borderBottomWidth: active ? 1 : 0,
              borderBottomColor: colors.ink,
            }}
          >
            <Ionicons
              name={item.icon}
              size={22}
              color={active ? colors.ink : colors.tertiary}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text className="text-[10px] uppercase tracking-wider text-apple-secondary">{label}</Text>
      <Text className="mt-0.5 text-sm font-semibold text-apple-ink">{value}</Text>
    </View>
  );
}

function EmptyTab({ message }: { message: string }) {
  return (
    <View className="mx-4 mt-6 rounded-2xl border border-apple-border bg-white p-8">
      <Text className="text-center text-sm text-apple-secondary">{message}</Text>
    </View>
  );
}

function ProfileEventsTab({
  bundle,
  isSelf,
  onCreate,
}: {
  bundle: UserEventsBundle;
  isSelf: boolean;
  onCreate: () => void;
}) {
  const router = useRouter();
  const { hosting, attending } = bundle;
  const empty = hosting.length === 0 && attending.length === 0;

  if (empty) {
    return (
      <View className="mx-4 mt-6">
        <EmptyTab message="No upcoming events yet." />
        {isSelf ? (
          <Pressable
            onPress={onCreate}
            className="mt-4 items-center rounded-xl bg-accent py-3 active:opacity-90"
          >
            <Text className="font-semibold text-white">Create event</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View className="gap-5 px-4 pt-2 pb-4">
      {isSelf ? (
        <Pressable
          onPress={onCreate}
          className="flex-row items-center justify-center gap-2 rounded-xl border border-apple-border bg-white py-3 active:bg-apple-bg2"
        >
          <Ionicons name="add-circle-outline" size={20} color={colors.blue} />
          <Text className="text-sm font-semibold text-apple-ink">Create event</Text>
        </Pressable>
      ) : null}

      {hosting.length > 0 ? (
        <View className="gap-2">
          <Text className="text-xs font-bold uppercase tracking-wider text-apple-secondary">
            Hosting
          </Text>
          {hosting.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              compact
              onPress={() => router.push(`/event/${event.id}`)}
            />
          ))}
        </View>
      ) : null}

      {attending.length > 0 ? (
        <View className="gap-2">
          <Text className="text-xs font-bold uppercase tracking-wider text-apple-secondary">
            Going to
          </Text>
          {attending.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              compact
              onPress={() => router.push(`/event/${event.id}`)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
