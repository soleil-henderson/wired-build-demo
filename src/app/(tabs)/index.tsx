import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { UserBadges } from '@/components/UserBadges';
import { NotificationBellButton } from '@/components/NotificationBellButton';
import { useAuth } from '@/lib/auth-context';
import {
  listFeed,
  togglePostLike,
  type FeedMode,
  type FeedPost,
} from '@/lib/feed';
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

  // Fresh load: page 1, no cursor. Also refreshes the bell count.
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

  // Subsequent pages. No-op if we've already reached the end (cursor null)
  // or are mid-fetch.
  const loadMore = useCallback(async () => {
    if (loadingMore || !cursor) return;
    setLoadingMore(true);
    try {
      const page = await listFeed(session?.user.id ?? null, mode, cursor);
      setPosts((prev) => {
        // Defend against the same post landing twice (e.g. a new mod
        // posted between page 1 and 2 would shift things).
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
    // Optimistic update — the trigger will reconcile the count server-side.
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
      // Roll back on failure.
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
    <View>
      <View className="flex-row items-start justify-between px-6 pt-6">
        <View className="flex-1 pr-4">
          <Text className="text-accent text-xs font-semibold tracking-[3px]">FEED</Text>
          <Text className="mt-1 text-3xl font-bold text-white">
            What&apos;s being built
          </Text>
          <Text className="mt-2 text-ink-300">
            Recent mods logged across the network.
          </Text>
        </View>
        <NotificationBellButton
          count={unread}
          onPress={() => {
            clearUnread();
            router.push('/notifications');
          }}
        />
      </View>

      {session ? (
        <View className="mx-6 mt-5 mb-1 flex-row self-start rounded-xl bg-ink-900 p-1">
          <ModeTab label="For you" active={mode === 'all'} onPress={() => switchMode('all')} />
          <ModeTab
            label="Following"
            active={mode === 'following'}
            onPress={() => switchMode('following')}
          />
          <ModeTab
            label="My make"
            active={mode === 'my-make'}
            onPress={() => switchMode('my-make')}
          />
        </View>
      ) : null}
    </View>
  );

  const ListEmpty = loading ? (
    <View className="mt-12 items-center">
      <ActivityIndicator color="#F5A524" />
    </View>
  ) : (
    <View className="mx-6 mt-6 rounded-2xl border border-ink-700 bg-ink-900 p-6">
      {mode === 'following' ? (
        <>
          <Text className="text-ink-200 text-base font-semibold">
            Nothing from your follows yet
          </Text>
          <Text className="mt-1 text-ink-300">
            Tap a username on any post to open their profile and follow them —
            their next mod will land here.
          </Text>
        </>
      ) : mode === 'my-make' ? (
        <>
          <Text className="text-ink-200 text-base font-semibold">
            Nothing from your platform yet
          </Text>
          <Text className="mt-1 text-ink-300">
            Posts here are filtered to the makes in your garage. Add a vehicle
            (Garage tab) or check back when someone else logs a mod on the same
            platform.
          </Text>
        </>
      ) : (
        <>
          <Text className="text-ink-200 text-base font-semibold">
            Quiet around here
          </Text>
          <Text className="mt-1 text-ink-300">
            No public mods yet. Log one and it&apos;ll show up here for everyone.
          </Text>
        </>
      )}
    </View>
  );

  const ListFooter =
    loadingMore ? (
      <View className="py-6 items-center">
        <ActivityIndicator color="#F5A524" />
      </View>
    ) : !cursor && posts.length > 0 ? (
      <View className="py-6 items-center">
        <Text className="text-xs text-ink-300">You&apos;re all caught up.</Text>
      </View>
    ) : null;

  const { width: screenWidth } = useWindowDimensions();
  const gridGap = 10;
  const gridPadding = 12;
  const cardWidth = (screenWidth - gridPadding * 2 - gridGap) / 2;

  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['top']}>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={{ paddingHorizontal: gridPadding, gap: gridGap }}
        renderItem={({ item }) => (
          <View style={{ width: cardWidth }}>
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
        // Trigger loadMore well before the user actually reaches the
        // bottom — keeps scrolling feeling endless on a fast connection.
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        refreshControl={
          <RefreshControl
            tintColor="#F5A524"
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setCursor(null);
              loadFresh();
            }}
          />
        }
        contentContainerStyle={{ paddingBottom: 96 }}
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
  const vehicleTitle =
    post.vehicle.nickname ?? `${post.vehicle.make} ${post.vehicle.model}`;
  const partLabel =
    post.mod?.part
      ? `${post.mod.part.brand} ${post.mod.part.name}`
      : post.mod?.custom_part_name ?? null;

  return (
    <Pressable
      onPress={onOpenPost}
      className="mb-3 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 active:opacity-90"
    >
      {/* Square photo box — keeps product shots framed consistently in the grid */}
      <View className="w-full overflow-hidden bg-ink-800" style={{ aspectRatio: 1 }}>
        {post.mod?.photo_url ? (
          <Image
            source={{ uri: post.mod.photo_url }}
            className="h-full w-full"
            resizeMode="cover"
          />
        ) : (
          <View className="h-full w-full items-center justify-center px-3">
            <Text className="text-center text-xs uppercase tracking-wider text-ink-400">
              {post.mod?.category.replace('_', ' ') ?? 'Mod'}
            </Text>
          </View>
        )}
      </View>

      <View className="p-3">
        <Pressable onPress={onOpenAuthor} className="active:opacity-80">
          <View className="flex-row items-center gap-2">
            {post.author.avatar_url ? (
              <Image
                source={{ uri: post.author.avatar_url }}
                className="h-6 w-6 rounded-full bg-ink-700"
              />
            ) : (
              <View className="h-6 w-6 items-center justify-center rounded-full bg-ink-700">
                <Text className="text-[10px] font-bold text-white">
                  {(post.author.display_name || post.author.handle || '?')[0].toUpperCase()}
                </Text>
              </View>
            )}
            <Text className="flex-1 text-xs font-semibold text-white" numberOfLines={1}>
              {post.author.display_name}
            </Text>
            <UserBadges user={post.author} />
          </View>
          <Text className="mt-1 text-[10px] text-ink-400" numberOfLines={1}>
            {vehicleTitle} · {post.vehicle.year}
          </Text>
        </Pressable>

        {post.mod ? (
          <View className="mt-2">
            <Text className="text-[10px] uppercase tracking-wider text-ink-400">
              {post.mod.category.replace('_', ' ')}
            </Text>
            {partLabel ? (
              <Text className="mt-0.5 text-sm font-semibold text-white" numberOfLines={2}>
                {partLabel}
              </Text>
            ) : null}
            {post.mod.cost != null ? (
              <Text className="mt-1 text-xs text-ink-300" numberOfLines={1}>
                ${Number(post.mod.cost).toLocaleString()} · {formatDate(post.mod.install_date)}
              </Text>
            ) : (
              <Text className="mt-1 text-xs text-ink-400" numberOfLines={1}>
                {formatDate(post.mod.install_date)}
              </Text>
            )}
          </View>
        ) : null}

        {post.body ? (
          <Text className="mt-1.5 text-xs text-ink-300" numberOfLines={2}>
            {post.body}
          </Text>
        ) : null}

        <View className="mt-2.5 flex-row items-center gap-4">
          <Pressable onPress={onToggleLike} hitSlop={8} className="flex-row items-center gap-1">
            <Text className={`text-sm ${post.liked_by_me ? 'text-accent' : 'text-ink-400'}`}>
              {post.liked_by_me ? '♥' : '♡'}
            </Text>
            <Text
              className={`text-xs font-semibold ${
                post.liked_by_me ? 'text-accent' : 'text-ink-300'
              }`}
            >
              {post.reaction_count}
            </Text>
          </Pressable>
          <View className="flex-row items-center gap-1">
            <Text className="text-sm text-ink-400">💬</Text>
            <Text className="text-xs font-semibold text-ink-300">{post.comment_count}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function ModeTab({
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
      className={`rounded-lg px-4 py-1.5 ${active ? 'bg-ink-700' : ''}`}
    >
      <Text className={`text-sm ${active ? 'font-semibold text-white' : 'text-ink-300'}`}>
        {label}
      </Text>
    </Pressable>
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
