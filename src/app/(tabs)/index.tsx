import { useFocusEffect, useRouter } from 'expo-router';
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth-context';
import { listFeed, togglePostLike, type FeedPost } from '@/lib/feed';

export default function FeedScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await listFeed(session?.user.id ?? null);
      setPosts(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load feed';
      Alert.alert('Feed failed', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
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

  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['top']}>
      <ScrollView
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
        <View className="px-6 pt-6">
          <Text className="text-accent text-xs font-semibold tracking-[3px]">FEED</Text>
          <Text className="mt-1 text-3xl font-bold text-white">
            What&apos;s being built
          </Text>
          <Text className="mt-2 text-ink-300">
            Recent mods logged across the network.
          </Text>
        </View>

        {loading ? (
          <View className="mt-12 items-center">
            <ActivityIndicator color="#F5A524" />
          </View>
        ) : posts.length === 0 ? (
          <View className="mx-6 mt-8 rounded-2xl border border-ink-700 bg-ink-900 p-6">
            <Text className="text-ink-200 text-base font-semibold">Quiet around here</Text>
            <Text className="mt-1 text-ink-300">
              No public mods yet. Log one and it&apos;ll show up here for everyone.
            </Text>
          </View>
        ) : (
          <View className="mt-4 gap-3 px-3">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onToggleLike={() => handleToggleLike(post)}
                onOpenPost={() => router.push(`/post/${post.id}`)}
                onOpenAuthor={() => router.push(`/user/${post.author.handle}`)}
              />
            ))}
          </View>
        )}
      </ScrollView>
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
            <Text className="font-semibold text-white" numberOfLines={1}>
              {post.author.display_name}{' '}
              <Text className="font-normal text-ink-300">@{post.author.handle}</Text>
            </Text>
            <Text className="text-xs text-ink-300" numberOfLines={1}>
              {vehicleTitle} · {post.vehicle.year} {post.vehicle.make}{' '}
              {post.vehicle.model}
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
