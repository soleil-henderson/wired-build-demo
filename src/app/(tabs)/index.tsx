import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Share,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppleCard } from '@/components/apple/AppleCard';
import { AppleHeader } from '@/components/apple/AppleHeader';
import { GradientAvatar, MoneyText, VerifiedLabel } from '@/components/apple/ApplePrimitives';
import { SegmentedControl } from '@/components/apple/SegmentedControl';
import { UserBadges } from '@/components/UserBadges';
import { useAuth } from '@/lib/auth-context';
import {
  listFeed,
  togglePostLike,
  type FeedMode,
  type FeedPost,
} from '@/lib/feed';
import { colors } from '@/lib/theme';
import { useUnreadNotifications } from '@/lib/unread-notifications-context';

export default function FeedScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const { count: unread, refresh: refreshUnread, clearLocal: clearUnread } =
    useUnreadNotifications();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [mode, setMode] = useState<FeedMode>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadFresh = useCallback(async () => {
    try {
      const [page] = await Promise.all([
        listFeed(session?.user.id ?? null, mode, null),
        refreshUnread(),
      ]);
      setPosts(page.posts);
      setCursor(page.nextCursor);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load feed';
      Alert.alert('Feed failed', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session, mode, refreshUnread]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !cursor) return;
    setLoadingMore(true);
    try {
      const page = await listFeed(session?.user.id ?? null, mode, cursor);
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const fresh = page.posts.filter((p) => !seen.has(p.id));
        return [...prev, ...fresh];
      });
      setCursor(page.nextCursor);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load more';
      Alert.alert('Load more failed', message);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, session, mode]);

  useFocusEffect(
    useCallback(() => {
      loadFresh();
    }, [loadFresh])
  );

  async function handleToggleLike(post: FeedPost) {
    if (!session) {
      Alert.alert('Sign in', 'Sign in to react.');
      return;
    }
    const previouslyLiked = post.liked_by_me;
    setPosts((current) =>
      current.map((p) =>
        p.id === post.id
          ? {
              ...p,
              liked_by_me: !previouslyLiked,
              reaction_count: Math.max(
                0,
                p.reaction_count + (previouslyLiked ? -1 : 1)
              ),
            }
          : p
      )
    );

    try {
      await togglePostLike(post.id, session.user.id, previouslyLiked);
    } catch (err) {
      setPosts((current) =>
        current.map((p) =>
          p.id === post.id
            ? {
                ...p,
                liked_by_me: previouslyLiked,
                reaction_count: Math.max(
                  0,
                  p.reaction_count + (previouslyLiked ? 1 : -1)
                ),
              }
            : p
        )
      );
      const message = err instanceof Error ? err.message : 'Could not save reaction';
      Alert.alert('Reaction failed', message);
    }
  }

  function switchMode(next: FeedMode) {
    if (next === mode) return;
    setLoading(true);
    setPosts([]);
    setCursor(null);
    setMode(next);
  }

  const ListHeader = (
    <View className="px-4 pb-2 pt-1">
      {/* Community pulse banner */}
      <AppleCard
        style={{
          marginBottom: 14,
          padding: 14,
          backgroundColor: colors.accentSoft,
          borderColor: colors.border,
        }}
      >
        <View className="flex-row items-center gap-3">
          <View
            className="h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: colors.accent }}
          >
            <Ionicons name="sparkles" size={20} color="#fff" />
          </View>
          <View className="flex-1">
            <Text className="text-[15px] font-semibold text-apple-ink">
              {posts.length > 0 ? `${posts.length}+ mods in your feed` : 'What\u2019s being built'}
            </Text>
            <Text className="text-[13px] text-apple-secondary">
              Recent mods logged across the network
            </Text>
          </View>
        </View>
      </AppleCard>

      {session ? (
        <View className="mb-3">
          <SegmentedControl
            options={[
              { id: 'all', label: 'For you' },
              { id: 'following', label: 'Following' },
              { id: 'my-make', label: 'My make' },
            ]}
            value={mode}
            onChange={switchMode}
          />
        </View>
      ) : null}
    </View>
  );

  const ListEmpty = loading ? (
    <View className="mt-12 items-center">
      <ActivityIndicator color={colors.accent} />
    </View>
  ) : (
    <View className="mx-4 mt-4">
      <AppleCard padded>
        {mode === 'following' ? (
          <>
            <Text className="text-base font-semibold text-apple-ink">
              Nothing from your follows yet
            </Text>
            <Text className="mt-1 text-apple-secondary">
              Follow builders and their next mod will land here.
            </Text>
          </>
        ) : mode === 'my-make' ? (
          <>
            <Text className="text-base font-semibold text-apple-ink">
              Nothing from your platform yet
            </Text>
            <Text className="mt-1 text-apple-secondary">
              Add a vehicle in Garage or check back when someone logs a mod on the
              same make.
            </Text>
          </>
        ) : (
          <>
            <Text className="text-base font-semibold text-apple-ink">
              Quiet around here
            </Text>
            <Text className="mt-1 text-apple-secondary">
              No public mods yet. Log one and it&apos;ll show up here for everyone.
            </Text>
          </>
        )}
      </AppleCard>
    </View>
  );

  const ListFooter =
    loadingMore ? (
      <View className="items-center py-6">
        <ActivityIndicator color={colors.accent} />
      </View>
    ) : !cursor && posts.length > 0 ? (
      <View className="items-center py-6">
        <Text className="text-xs text-apple-tertiary">You&apos;re all caught up.</Text>
      </View>
    ) : null;

  return (
    <SafeAreaView className="flex-1 bg-apple-bg2" edges={['top']}>
      <AppleHeader
        title="Home"
        notificationCount={unread}
        onSearchPress={() => router.push('/explore')}
        onNotificationsPress={() => {
          clearUnread();
          router.push('/notifications');
        }}
      />
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <View className="px-4">
            <PostCard
              post={item}
              onToggleLike={() => handleToggleLike(item)}
              onOpenPost={() => router.push(`/post/${item.id}`)}
              onOpenAuthor={() => router.push(`/user/${item.author.handle}`)}
            />
          </View>
        )}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={ListFooter}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        refreshControl={
          <RefreshControl
            tintColor={colors.accent}
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setCursor(null);
              loadFresh();
            }}
          />
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />
    </SafeAreaView>
  );
}

function PostCard({
  post,
  onToggleLike,
  onOpenPost,
  onOpenAuthor,
}: {
  post: FeedPost;
  onToggleLike: () => void;
  onOpenPost: () => void;
  onOpenAuthor: () => void;
}) {
  const router = useRouter();
  const vehicleTitle =
    post.vehicle.nickname ?? `${post.vehicle.make} ${post.vehicle.model}`;
  const partLabel =
    post.mod?.part
      ? `${post.mod.part.brand} ${post.mod.part.name}`
      : post.mod?.custom_part_name ?? null;
  const brandLabel = post.mod?.part?.brand ?? post.mod?.category.replace('_', ' ');
  const caption =
    post.body ??
    (partLabel ? `Installed ${partLabel}` : null);
  const avatarColor = hashColor(post.author.handle);
  const initials = (post.author.display_name || post.author.handle || '?')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <AppleCard style={{ marginBottom: 14 }}>
      <View className="flex-row items-center gap-3 px-4 py-3.5">
        <Pressable onPress={onOpenAuthor}>
          {post.author.avatar_url ? (
            <Image
              source={{ uri: post.author.avatar_url }}
              className="h-[38px] w-[38px] rounded-full bg-apple-bg2"
            />
          ) : (
            <GradientAvatar initials={initials} size={38} color={avatarColor} />
          )}
        </Pressable>
        <Pressable onPress={onOpenAuthor} className="flex-1">
          <View className="flex-row items-center gap-1.5">
            <Text className="text-[15px] font-semibold text-apple-ink">
              {post.author.display_name}
            </Text>
            <UserBadges user={post.author} />
          </View>
          <Text className="text-[13px] text-apple-secondary">
            {vehicleTitle} · {formatRelative(post.created_at)}
          </Text>
        </Pressable>
        <Ionicons name="ellipsis-horizontal" size={20} color={colors.tertiary} />
      </View>

      <Pressable onPress={onOpenPost}>
        <View className="relative w-full bg-apple-bg2" style={{ aspectRatio: 16 / 10 }}>
          {post.mod?.photo_url ? (
            <Image
              source={{ uri: post.mod.photo_url }}
              className="h-full w-full"
              resizeMode="cover"
            />
          ) : (
            <View
              className="h-full w-full items-center justify-center"
              style={{ backgroundColor: `${avatarColor}14` }}
            >
              <Ionicons name="car-sport-outline" size={56} color={avatarColor} />
            </View>
          )}
          {post.mod ? (
            <View
              className="absolute left-3 top-3 rounded-full px-3 py-1"
              style={{ backgroundColor: 'rgba(255,255,255,0.92)' }}
            >
              <Text className="text-xs font-semibold" style={{ color: avatarColor }}>
                + New mod
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>

      <View className="px-4 py-3.5">
        {caption ? (
          <Text className="mb-3 text-[15px] leading-[22px] text-apple-ink">{caption}</Text>
        ) : null}

        {post.mod && partLabel ? (
          <View
            className="mb-3.5 flex-row items-center gap-3 rounded-[14px] p-3"
            style={{ backgroundColor: colors.bg2 }}
          >
            <View className="h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-white">
              <Ionicons name="pricetag-outline" size={16} color={avatarColor} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-xs font-semibold text-apple-secondary">{brandLabel}</Text>
              <Text className="text-sm font-semibold text-apple-ink" numberOfLines={1}>
                {partLabel}
              </Text>
            </View>
            {post.mod.cost != null ? (
              <MoneyText value={Number(post.mod.cost)} size={16} color={colors.accent} weight="700" />
            ) : null}
            {post.mod.part ? (
              <Pressable
                onPress={() => router.push(`/part/${post.mod!.part!.id}`)}
                className="h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-white"
              >
                <Ionicons name="bookmark-outline" size={16} color={colors.secondary} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View className="flex-row items-center gap-5">
          <Pressable onPress={onToggleLike} hitSlop={8} className="flex-row items-center gap-1.5">
            <Ionicons
              name={post.liked_by_me ? 'heart' : 'heart-outline'}
              size={20}
              color={post.liked_by_me ? colors.accent : colors.secondary}
            />
            <Text
              className={`text-sm font-medium ${
                post.liked_by_me ? 'text-accent' : 'text-apple-secondary'
              }`}
            >
              {post.reaction_count}
            </Text>
          </Pressable>
          <Pressable onPress={onOpenPost} className="flex-row items-center gap-1.5">
            <Ionicons name="chatbubble-outline" size={20} color={colors.secondary} />
            <Text className="text-sm font-medium text-apple-secondary">{post.comment_count}</Text>
          </Pressable>
          <View className="flex-1" />
          {post.author.is_identity_verified ? <VerifiedLabel size={13} /> : null}
          <Pressable
            onPress={() => Share.share({ message: `Check out this build on Wired Build` })}
            hitSlop={8}
          >
            <Ionicons name="share-outline" size={19} color={colors.secondary} />
          </Pressable>
        </View>
      </View>
    </AppleCard>
  );
}

function hashColor(seed: string): string {
  const palette = [colors.accent, colors.green, colors.amber, colors.blue, colors.purple];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h + seed.charCodeAt(i)) % palette.length;
  return palette[h] ?? colors.accent;
}

function formatRelative(iso: string) {
  try {
    const ms = Date.now() - new Date(iso).getTime();
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d`;
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}
