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
import { routeParam } from '@/lib/route-param';
import { reportContent } from '@/lib/reports';

export default function PostDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = routeParam(params.id);
  const { session } = useAuth();
  const router = useRouter();

  const [post, setPost] = useState<FeedPost | null>(null);
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [composer, setComposer] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
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
      <View className="flex-1 items-center justify-center bg-apple-bg2">
        <Stack.Screen options={{ title: 'Post' }} />
        <ActivityIndicator color="#FF6A2B" />
      </View>
    );
  }

  if (!post) {
    return (
      <View className="flex-1 items-center justify-center bg-apple-bg2 px-6">
        <Stack.Screen options={{ title: 'Not found' }} />
        <Text className="text-apple-ink">This post isn&apos;t available.</Text>
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
      className="flex-1 bg-apple-bg2"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <Stack.Screen
        options={{
          title: 'Post',
          headerRight: () => (
            <Pressable
              onPress={() => {
                Alert.alert('Report post?', 'We will open your mail app with details.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Report',
                    style: 'destructive',
                    onPress: () => {
                      reportContent({ targetType: 'post', targetId: post.id }).catch((err) => {
                        const message =
                          err instanceof Error ? err.message : 'Could not report';
                        Alert.alert('Report failed', message);
                      });
                    },
                  },
                ]);
              }}
              className="mr-2 px-2"
            >
              <Text className="text-sm text-apple-secondary">Report</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        contentContainerClassName="pb-6"
        keyboardShouldPersistTaps="handled"
      >
        {/* ---- Post ---- */}
        <View className="border-b border-apple-border bg-white">
          <Pressable
            onPress={() => router.push(`/user/${post.author.handle}`)}
            className="flex-row items-center gap-3 px-4 pt-4 active:opacity-80"
          >
            {post.author.avatar_url ? (
              <Image
                source={{ uri: post.author.avatar_url }}
                className="h-10 w-10 rounded-full bg-apple-bg2"
              />
            ) : (
              <View className="h-10 w-10 items-center justify-center rounded-full bg-apple-bg2">
                <Text className="font-bold text-apple-ink">
                  {(post.author.display_name || post.author.handle || '?')[0].toUpperCase()}
                </Text>
              </View>
            )}
            <View className="flex-1">
              <View className="flex-row items-center gap-1.5">
                <Text className="font-semibold text-apple-ink">{post.author.display_name}</Text>
                <UserBadges user={post.author} />
              </View>
              <Text className="text-xs text-apple-secondary">@{post.author.handle}</Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => router.push(`/vehicle/${post.vehicle.id}`)}
            className="mt-3 px-4 active:opacity-80"
          >
            <Text className="text-xs uppercase tracking-wider text-apple-secondary">
              {vehicleTitle} · {post.vehicle.year} {post.vehicle.make} {post.vehicle.model}
            </Text>
          </Pressable>

          {post.mod?.photo_url ? (
            <Image
              source={{ uri: post.mod.photo_url }}
              className="mt-3 h-80 w-full bg-apple-bg2"
              resizeMode="cover"
            />
          ) : null}

          <View className="p-4">
            {post.mod ? (
              <>
                <Text className="text-[11px] uppercase tracking-wider text-apple-secondary">
                  {post.mod.category.replace('_', ' ')}
                </Text>
                {partLabel ? (
                  post.mod.part ? (
                    <Pressable
                      onPress={() => router.push(`/part/${post.mod!.part!.id}`)}
                      className="active:opacity-80"
                    >
                      <Text className="mt-1 text-lg font-semibold text-apple-ink">
                        {partLabel}
                      </Text>
                    </Pressable>
                  ) : (
                    <Text className="mt-1 text-lg font-semibold text-apple-ink">{partLabel}</Text>
                  )
                ) : null}
                {post.mod.cost != null ? (
                  <Text className="mt-1 text-sm text-apple-secondary">
                    ${Number(post.mod.cost).toLocaleString()} · {formatDate(post.mod.install_date)}
                  </Text>
                ) : (
                  <Text className="mt-1 text-sm text-apple-secondary">
                    {formatDate(post.mod.install_date)}
                  </Text>
                )}
              </>
            ) : null}
            {post.body ? <Text className="mt-2 text-sm text-apple-secondary">{post.body}</Text> : null}

            <View className="mt-4 flex-row items-center gap-6">
              <Pressable onPress={handleToggleLike} className="flex-row items-center gap-2">
                <Text className={`text-2xl ${post.liked_by_me ? 'text-accent' : 'text-apple-secondary'}`}>
                  {post.liked_by_me ? '♥' : '♡'}
                </Text>
                <Text
                  className={`text-sm font-semibold ${
                    post.liked_by_me ? 'text-accent' : 'text-apple-secondary'
                  }`}
                >
                  {post.reaction_count}
                </Text>
              </Pressable>
              <View className="flex-row items-center gap-2">
                <Text className="text-lg text-apple-secondary">💬</Text>
                <Text className="text-sm font-semibold text-apple-secondary">{post.comment_count}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ---- Comments ---- */}
        <View className="px-4 pt-6">
          <Text className="text-xs font-semibold uppercase tracking-[2px] text-apple-secondary">
            Comments
          </Text>
          {comments.length === 0 ? (
            <Text className="mt-3 text-sm text-apple-secondary">No comments yet. Start the chat.</Text>
          ) : (
            <View className="mt-3 gap-3">
              {comments.map((c) => (
                <View key={c.id} className="rounded-2xl border border-apple-border bg-white p-3">
                  <Pressable
                    onPress={() => router.push(`/user/${c.author.handle}`)}
                    className="flex-row items-center gap-2 active:opacity-80"
                  >
                    {c.author.avatar_url ? (
                      <Image
                        source={{ uri: c.author.avatar_url }}
                        className="h-6 w-6 rounded-full bg-apple-bg2"
                      />
                    ) : (
                      <View className="h-6 w-6 items-center justify-center rounded-full bg-apple-bg2">
                        <Text className="text-[10px] font-bold text-apple-ink">
                          {(c.author.display_name || c.author.handle || '?')[0].toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View className="flex-row items-center gap-1.5">
                      <Text className="text-sm font-semibold text-apple-ink">
                        {c.author.display_name}
                      </Text>
                      <UserBadges user={c.author} />
                      <Text className="text-xs font-normal text-apple-secondary">
                        @{c.author.handle}
                      </Text>
                    </View>
                    <Text className="ml-auto text-[10px] text-apple-secondary">
                      {formatRelative(c.created_at)}
                    </Text>
                  </Pressable>
                  <Text className="mt-2 text-sm text-apple-secondary">{c.body}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ---- Composer ---- */}
      <View className="border-t border-apple-border bg-white px-4 py-3">
        <View className="flex-row items-end gap-2">
          <TextInput
            value={composer}
            onChangeText={setComposer}
            placeholder={session ? 'Add a comment…' : 'Sign in to comment'}
            placeholderTextColor="#A1A1A6"
            editable={!!session && !posting}
            multiline
            className="max-h-32 min-h-[40px] flex-1 rounded-xl bg-apple-bg2 px-3 py-2 text-apple-ink"
          />
          <Pressable
            onPress={handleAddComment}
            disabled={!session || posting || !composer.trim()}
            className="rounded-xl bg-accent px-4 py-2.5 active:bg-accent-dark disabled:opacity-50"
          >
            {posting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="font-semibold text-white">Post</Text>
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
