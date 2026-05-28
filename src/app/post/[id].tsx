import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { UserBadges } from '@/components/UserBadges';
import { useAuth } from '@/lib/auth-context';
import { addComment, listComments, type CommentWithAuthor } from '@/lib/comments';
import { getPost, togglePostLike, type FeedPost } from '@/lib/feed';

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();

  const [post, setPost] = useState<FeedPost | null>(null);
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [composer, setComposer] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [p, cs] = await Promise.all([
        getPost(id, session?.user.id ?? null),
        listComments(id),
      ]);
      setPost(p);
      setComments(cs);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load post';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, [id, session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleToggleLike() {
    if (!post || !session) return;
    const previouslyLiked = post.liked_by_me;
    setPost({
      ...post,
      liked_by_me: !previouslyLiked,
      reaction_count: Math.max(0, post.reaction_count + (previouslyLiked ? -1 : 1)),
    });
    try {
      await togglePostLike(post.id, session.user.id, previouslyLiked);
    } catch (err) {
      setPost({
        ...post,
        liked_by_me: previouslyLiked,
        reaction_count: post.reaction_count,
      });
      const message = err instanceof Error ? err.message : 'Could not save reaction';
      Alert.alert('Reaction failed', message);
    }
  }

  async function handleAddComment() {
    if (!session || !post) {
      Alert.alert('Sign in', 'Sign in to comment.');
      return;
    }
    const body = composer.trim();
    if (!body) return;
    setPosting(true);
    try {
      await addComment({
        postId: post.id,
        userId: session.user.id,
        body,
      });
      setComposer('');
      const fresh = await listComments(post.id);
      setComments(fresh);
      setPost((p) => (p ? { ...p, comment_count: fresh.length } : p));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not post comment';
      Alert.alert('Comment failed', message);
    } finally {
      setPosting(false);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-ink-950">
        <Stack.Screen options={{ title: 'Post' }} />
        <ActivityIndicator color="#F5A524" />
      </View>
    );
  }

  if (!post) {
    return (
      <View className="flex-1 items-center justify-center bg-ink-950 px-6">
        <Stack.Screen options={{ title: 'Not found' }} />
        <Text className="text-white">This post isn&apos;t available.</Text>
      </View>
    );
  }

  const vehicleTitle = post.vehicle.nickname ?? `${post.vehicle.make} ${post.vehicle.model}`;
  const partLabel = post.mod?.part
    ? `${post.mod.part.brand} ${post.mod.part.name}`
    : post.mod?.custom_part_name ?? null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-ink-950"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <Stack.Screen options={{ title: 'Post' }} />
      <ScrollView
        contentContainerClassName="pb-6"
        keyboardShouldPersistTaps="handled"
      >
        {/* ---- Post ---- */}
        <View className="border-b border-ink-700 bg-ink-900">
          <Pressable
            onPress={() => router.push(`/user/${post.author.handle}`)}
            className="flex-row items-center gap-3 px-4 pt-4 active:opacity-80"
          >
            {post.author.avatar_url ? (
              <Image
                source={{ uri: post.author.avatar_url }}
                className="h-10 w-10 rounded-full bg-ink-700"
              />
            ) : (
              <View className="h-10 w-10 items-center justify-center rounded-full bg-ink-700">
                <Text className="font-bold text-white">
                  {(post.author.display_name || post.author.handle || '?')[0].toUpperCase()}
                </Text>
              </View>
            )}
            <View className="flex-1">
              <View className="flex-row items-center gap-1.5">
                <Text className="font-semibold text-white">{post.author.display_name}</Text>
                <UserBadges user={post.author} />
              </View>
              <Text className="text-xs text-ink-300">@{post.author.handle}</Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => router.push(`/vehicle/${post.vehicle.id}`)}
            className="mt-3 px-4 active:opacity-80"
          >
            <Text className="text-xs uppercase tracking-wider text-ink-300">
              {vehicleTitle} · {post.vehicle.year} {post.vehicle.make} {post.vehicle.model}
            </Text>
          </Pressable>

          {post.mod?.photo_url ? (
            <Image
              source={{ uri: post.mod.photo_url }}
              className="mt-3 h-80 w-full bg-ink-800"
              resizeMode="cover"
            />
          ) : null}

          <View className="p-4">
            {post.mod ? (
              <>
                <Text className="text-[11px] uppercase tracking-wider text-ink-300">
                  {post.mod.category.replace('_', ' ')}
                </Text>
                {partLabel ? (
                  post.mod.part ? (
                    <Pressable
                      onPress={() => router.push(`/part/${post.mod!.part!.id}`)}
                      className="active:opacity-80"
                    >
                      <Text className="mt-1 text-lg font-semibold text-white">
                        {partLabel}
                      </Text>
                    </Pressable>
                  ) : (
                    <Text className="mt-1 text-lg font-semibold text-white">{partLabel}</Text>
                  )
                ) : null}
                {post.mod.cost != null ? (
                  <Text className="mt-1 text-sm text-ink-200">
                    ${Number(post.mod.cost).toLocaleString()} · {formatDate(post.mod.install_date)}
                  </Text>
                ) : (
                  <Text className="mt-1 text-sm text-ink-300">
                    {formatDate(post.mod.install_date)}
                  </Text>
                )}
              </>
            ) : null}
            {post.body ? <Text className="mt-2 text-sm text-ink-200">{post.body}</Text> : null}

            <View className="mt-4 flex-row items-center gap-6">
              <Pressable onPress={handleToggleLike} className="flex-row items-center gap-2">
                <Text className={`text-2xl ${post.liked_by_me ? 'text-accent' : 'text-ink-300'}`}>
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
              <View className="flex-row items-center gap-2">
                <Text className="text-lg text-ink-300">💬</Text>
                <Text className="text-sm font-semibold text-ink-200">{post.comment_count}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ---- Comments ---- */}
        <View className="px-4 pt-6">
          <Text className="text-xs font-semibold uppercase tracking-[2px] text-ink-300">
            Comments
          </Text>
          {comments.length === 0 ? (
            <Text className="mt-3 text-sm text-ink-300">No comments yet. Start the chat.</Text>
          ) : (
            <View className="mt-3 gap-3">
              {comments.map((c) => (
                <View key={c.id} className="rounded-2xl border border-ink-700 bg-ink-900 p-3">
                  <Pressable
                    onPress={() => router.push(`/user/${c.author.handle}`)}
                    className="flex-row items-center gap-2 active:opacity-80"
                  >
                    {c.author.avatar_url ? (
                      <Image
                        source={{ uri: c.author.avatar_url }}
                        className="h-6 w-6 rounded-full bg-ink-700"
                      />
                    ) : (
                      <View className="h-6 w-6 items-center justify-center rounded-full bg-ink-700">
                        <Text className="text-[10px] font-bold text-white">
                          {(c.author.display_name || c.author.handle || '?')[0].toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View className="flex-row items-center gap-1.5">
                      <Text className="text-sm font-semibold text-white">
                        {c.author.display_name}
                      </Text>
                      <UserBadges user={c.author} />
                      <Text className="text-xs font-normal text-ink-300">
                        @{c.author.handle}
                      </Text>
                    </View>
                    <Text className="ml-auto text-[10px] text-ink-300">
                      {formatRelative(c.created_at)}
                    </Text>
                  </Pressable>
                  <Text className="mt-2 text-sm text-ink-200">{c.body}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ---- Composer ---- */}
      <View className="border-t border-ink-700 bg-ink-900 px-4 py-3">
        <View className="flex-row items-end gap-2">
          <TextInput
            value={composer}
            onChangeText={setComposer}
            placeholder={session ? 'Add a comment…' : 'Sign in to comment'}
            placeholderTextColor="#5A6373"
            editable={!!session && !posting}
            multiline
            className="max-h-32 min-h-[40px] flex-1 rounded-xl bg-ink-800 px-3 py-2 text-white"
          />
          <Pressable
            onPress={handleAddComment}
            disabled={!session || posting || !composer.trim()}
            className="rounded-xl bg-accent px-4 py-2.5 active:bg-accent-dark disabled:opacity-50"
          >
            {posting ? (
              <ActivityIndicator color="#08090B" />
            ) : (
              <Text className="font-semibold text-ink-950">Post</Text>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
  } catch {
    return iso;
  }
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
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}
