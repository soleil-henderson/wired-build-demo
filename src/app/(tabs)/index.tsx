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
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { UserBadges } from '@/components/UserBadges';
import { useAuth } from '@/lib/auth-context';
import {
  listFeed,
  togglePostLike,
  type FeedMode,
  type FeedPost,
} from '@/lib/feed';
import { getUnreadCount } from '@/lib/notifications';

export default function FeedScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [mode, setMode] = useState<FeedMode>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Fresh load: page 1, no cursor. Also refreshes the bell count.
  const loadFresh = useCallback(async () => {
    try {
      const [page, unreadCount] = await Promise.all([
        listFeed(session?.user.id ?? null, mode, null),
        session ? getUnreadCount(session.user.id) : Promise.resolve(0),
      ]);
      setPosts(page.posts);
      setCursor(page.nextCursor);
      setUnread(unreadCount);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load feed';
      Alert.alert('Feed failed', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session, mode]);

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
        <Pressable
          onPress={() => {
            router.push('/notifications');
            setUnread(0);
          }}
          className="mt-1 h-10 w-10 items-center justify-center rounded-full bg-ink-900 active:bg-ink-800"
        >
          <Text className="text-xl text-ink-200">🔔</Text>
          {unread > 0 ? (
            <View className="absolute -right-1 -top-1 min-w-[18px] items-center justify-center rounded-full bg-accent px-1">
              <Text className="text-[10px] font-bold text-ink-950">
                {unread > 99 ? '99+' : unread}
              </Text>
            </View>
          ) : null}
        </Pressable>
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

  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['top']}>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <View className="px-3 pb-3 pt-1">
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
    <View className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
      {/* Header */}
      <Pressable onPress={onOpenAuthor} className="px-4 pt-4 active:opacity-80">
        <View className="flex-row items-center gap-3">
          {post.author.avatar_url ? (
            <Image
              source={{ uri: post.author.avatar_url }}
              className="h-9 w-9 rounded-full bg-ink-700"
            />
          ) : (
            <View className="h-9 w-9 items-center justify-center rounded-full bg-ink-700">
              <Text className="font-bold text-white">
                {(post.author.display_name || post.author.handle || '?')[0].toUpperCase()}
              </Text>
            </View>
          )}
          <View className="flex-1">
            <View className="flex-row items-center gap-1.5">
              <Text className="font-semibold text-white" numberOfLines={1}>
                {post.author.display_name}
              </Text>
              <UserBadges user={post.author} />
            </View>
            <Text className="text-xs text-ink-300" numberOfLines={1}>
              @{post.author.handle} · {vehicleTitle} · {post.vehicle.year}{' '}
              {post.vehicle.make} {post.vehicle.model}
            </Text>
          </View>
        </View>
      </Pressable>

      {/* Photo */}
      {post.mod?.photo_url ? (
        <Pressable onPress={onOpenPost} className="mt-3 active:opacity-90">
          <Image
            source={{ uri: post.mod.photo_url }}
            className="h-72 w-full bg-ink-800"
            resizeMode="cover"
          />
        </Pressable>
      ) : null}

      {/* Body */}
      <Pressable onPress={onOpenPost} className="p-4 active:opacity-80">
        {post.mod ? (
          <>
            <Text className="text-[11px] uppercase tracking-wider text-ink-300">
              {post.mod.category.replace('_', ' ')}
            </Text>
            {partLabel ? (
              <Text className="mt-1 text-base font-semibold text-white">
                {partLabel}
              </Text>
            ) : null}
            {post.mod.cost != null ? (
              <Text className="mt-1 text-sm text-ink-200">
                ${Number(post.mod.cost).toLocaleString()} ·{' '}
                {formatDate(post.mod.install_date)}
              </Text>
            ) : (
              <Text className="mt-1 text-sm text-ink-300">
                {formatDate(post.mod.install_date)}
              </Text>
            )}
          </>
        ) : null}

        {post.body ? (
          <Text className="mt-2 text-sm text-ink-200">{post.body}</Text>
        ) : null}

        {/* Actions */}
        <View className="mt-4 flex-row items-center gap-6">
          <Pressable onPress={onToggleLike} className="flex-row items-center gap-2">
            <Text
              className={`text-lg ${
                post.liked_by_me ? 'text-accent' : 'text-ink-300'
              }`}
            >
              {post.liked_by_me ? '♥' : '♡'}
            </Text>
            <Text
              className={`text-sm font-semibold ${
                post.liked_by_me ? 'text-accent' : 'text-ink-200'
              }`}
            >
              {post.reaction_count}
            </Text>
          </Pressable>
          <Pressable onPress={onOpenPost} className="flex-row items-center gap-2">
            <Text className="text-base text-ink-300">💬</Text>
            <Text className="text-sm font-semibold text-ink-200">
              {post.comment_count}
            </Text>
          </Pressable>
        </View>
      </Pressable>
    </View>
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
