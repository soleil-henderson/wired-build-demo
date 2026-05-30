import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { MediaCarousel } from '@/components/ui/MediaCarousel';
import { CommentComposer } from '@/components/social/CommentComposer';
import { KeyboardStickyFooter } from '@/components/ui/KeyboardSafeView';
import { FollowButton } from '@/components/social/FollowButton';
import { SaveButton } from '@/components/social/SaveButton';
import { MentionText } from '@/components/social/MentionText';
import { ModProductLinksDisplay } from '@/components/social/ModProductLinksForm';
import { ModToolsDisplay } from '@/components/mods/ModToolsDisplay';
import { UserBadges } from '@/components/UserBadges';
import { useSubscriptionTier } from '@/hooks/use-subscription-tier';
import { useAuth } from '@/lib/auth-context';
import { canCommentAndReact } from '@/lib/subscription';
import { ensureSubscriptionTier } from '@/lib/subscription-guard';
import { addComment, deleteComment, listComments, type CommentWithAuthor } from '@/lib/comments';
import { deletePost, getPost, isModPost, resolvePostDisplayMedia, togglePostLike, type FeedPost } from '@/lib/feed';
import { routeParam } from '@/lib/route-param';
import { reportContent } from '@/lib/reports';
import { colors } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';
import { resolveModShopLink } from '@/lib/shop-link';
import { navigateToModDetail } from '@/lib/mod-nav';
import { navigateToModProduct } from '@/lib/product-nav';

export default function PostDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = routeParam(params.id);
  const { session } = useAuth();
  const { tier } = useSubscriptionTier();
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

  const resetEntity = useCallback(() => {
    setPost(null);
    setComments([]);
    setLoading(true);
  }, []);

  useFocusData(
    async ({ isInitial }) => {
      if (isInitial) setLoading(true);
      await load();
    },
    [load],
    { cacheKey: id, onCacheKeyChange: resetEntity }
  );

  async function handleToggleLike() {
    if (!post || !session) return;
    if (!ensureSubscriptionTier(tier, 'member', 'Liking posts')) return;
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
      Alert.alert('Reaction failed', err instanceof Error ? err.message : 'Could not save');
    }
  }

  async function handleAddComment() {
    if (!session || !post) {
      Alert.alert('Sign in', 'Sign in to comment.');
      return;
    }
    if (!ensureSubscriptionTier(tier, 'member', 'Commenting on posts')) return;
    const body = composer.trim();
    if (!body) return;
    setPosting(true);
    try {
      await addComment({ postId: post.id, userId: session.user.id, body });
      setComposer('');
      const fresh = await listComments(post.id);
      setComments(fresh);
      setPost((p) => (p ? { ...p, comment_count: fresh.length } : p));
    } catch (err) {
      Alert.alert('Comment failed', err instanceof Error ? err.message : 'Could not post');
    } finally {
      setPosting(false);
    }
  }

  function handleDelete() {
    if (!post || !session || post.user_id !== session.user.id) return;
    Alert.alert(
      'Delete post?',
      post.mod
        ? 'This removes the post and linked mod permanently.'
        : 'This removes the post permanently.',
      [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePost(post.id);
            router.back();
          } catch (err) {
            Alert.alert('Delete failed', err instanceof Error ? err.message : 'Could not delete');
          }
        },
      },
    ]);
  }

  if (loading && !post) {
    return (
      <View className="flex-1 items-center justify-center bg-apple-bg2">
        <Stack.Screen options={{ title: 'Post' }} />
        <ActivityIndicator color={colors.accent} />
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

  const isOwner = session?.user.id === post.user_id;
  const vehicleTitle = post.vehicle.nickname ?? `${post.vehicle.make} ${post.vehicle.model}`;
  const partLabel = post.mod?.part
    ? `${post.mod.part.brand} ${post.mod.part.name}`
    : post.mod?.custom_part_name ?? null;
  const shopLink = post.mod
    ? resolveModShopLink({
        product_links: post.mod.product_links,
        part: post.mod.part,
        partLabel,
      })
    : null;
  const media = resolvePostDisplayMedia(post);
  const modPost = isModPost(post);

  return (
    <View className="flex-1 bg-apple-bg2">
      <Stack.Screen
        options={{
          title: modPost ? 'Post' : 'Photo',
          headerRight: () => (
            <View className="flex-row items-center gap-2">
              {isOwner ? (
                <>
                  <Pressable
                    onPress={() => router.push(`/post/edit?id=${post.id}`)}
                    className="px-2"
                  >
                    <Ionicons name="create-outline" size={20} color={colors.blue} />
                  </Pressable>
                  <Pressable onPress={handleDelete} className="px-2">
                    <Ionicons name="trash-outline" size={20} color={colors.red} />
                  </Pressable>
                </>
              ) : null}
              {!isOwner ? (
                <SaveButton targetType="post" targetId={post.id} />
              ) : null}
              <Pressable
                onPress={() => {
                  Alert.alert('Report post?', 'We will open your mail app with details.', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Report',
                      style: 'destructive',
                      onPress: () => {
                        reportContent({ targetType: 'post', targetId: post.id }).catch((err) => {
                          Alert.alert(
                            'Report failed',
                            err instanceof Error ? err.message : 'Could not report'
                          );
                        });
                      },
                    },
                  ]);
                }}
                className="mr-2 px-2"
              >
                <Ionicons name="flag-outline" size={20} color={colors.secondary} />
              </Pressable>
            </View>
          ),
        }}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerClassName="pb-6"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <MediaCarousel
          items={media}
          aspectRatio={1}
          liked={post.liked_by_me}
          onDoubleTap={() => {
            if (!session) {
              Alert.alert('Sign in', 'Sign in to like posts.');
              return;
            }
            handleToggleLike();
          }}
        />

        <View className="px-4 pt-3">
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => router.push(`/user/${post.author.handle}`)}
              className="min-w-0 flex-1 flex-row items-center gap-3 active:opacity-80"
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
              <View className="min-w-0 flex-1">
                <View className="flex-row items-center gap-1.5">
                  <Text className="font-semibold text-apple-ink">{post.author.display_name}</Text>
                  <UserBadges user={post.author} />
                </View>
                <Text className="text-xs text-apple-secondary">@{post.author.handle}</Text>
              </View>
            </Pressable>
            <FollowButton userId={post.author.id} handle={post.author.handle} size="md" />
          </View>

          {post.body ? (
            <View className="mt-3">
              <MentionText body={post.body} baseClassName="text-[15px] leading-[22px] text-apple-ink" />
            </View>
          ) : null}

          {modPost ? (
            <>
              <Pressable
                onPress={() => router.push(`/vehicle/${post.vehicle.id}`)}
                className="mt-3 active:opacity-80"
              >
                <Text className="text-xs uppercase tracking-wider text-apple-secondary">
                  {vehicleTitle} · {post.vehicle.year} {post.vehicle.make} {post.vehicle.model}
                </Text>
              </Pressable>

              <Text className="mt-2 text-[11px] uppercase tracking-wider text-apple-secondary">
                {post.mod!.category.replace('_', ' ')}
              </Text>
              {partLabel ? (
                <Pressable
                  onPress={() => navigateToModProduct(router, post.mod)}
                  className="active:opacity-80"
                >
                  <Text className="mt-1 text-lg font-semibold text-apple-ink">{partLabel}</Text>
                </Pressable>
              ) : null}
              <View className="mt-4 gap-2">
                <Pressable
                  onPress={() => navigateToModDetail(router, post.mod!.id)}
                  className="flex-row items-center justify-center gap-2 rounded-xl border border-apple-border bg-apple-surface px-5 py-3 active:opacity-80"
                >
                  <Ionicons name="construct-outline" size={18} color={colors.accent} />
                  <Text className="font-semibold text-accent">View mod</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.tertiary} />
                </Pressable>
                <Pressable
                  onPress={() => navigateToModProduct(router, post.mod)}
                  className="flex-row items-center justify-center gap-2 rounded-xl border border-apple-border bg-apple-surface px-5 py-3 active:opacity-80"
                >
                  <Ionicons name="pricetag-outline" size={18} color={colors.accent} />
                  <Text className="font-semibold text-accent">View product</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.tertiary} />
                </Pressable>
              </View>
              {post.mod!.cost != null ? (
                <Text className="mt-1 text-sm text-apple-secondary">
                  ${Number(post.mod!.cost).toLocaleString()} · {formatDate(post.mod!.install_date)}
                </Text>
              ) : (
                <Text className="mt-1 text-sm text-apple-secondary">
                  {formatDate(post.mod!.install_date)}
                </Text>
              )}
              <ModProductLinksDisplay
                links={post.mod!.product_links}
                hidePrimary={!!shopLink}
                modId={post.mod!.id}
              />
              <ModToolsDisplay tools={post.mod!.tools ?? []} />
            </>
          ) : (
            <Pressable
              onPress={() => router.push(`/vehicle/${post.vehicle.id}`)}
              className="mt-3 active:opacity-80"
            >
              <Text className="text-sm text-apple-secondary">
                {vehicleTitle} · {post.vehicle.year} {post.vehicle.make} {post.vehicle.model}
              </Text>
            </Pressable>
          )}

          <View className="mt-4 flex-row items-center gap-6">
            <Pressable onPress={handleToggleLike} className="flex-row items-center gap-2">
              <Ionicons
                name={post.liked_by_me ? 'heart' : 'heart-outline'}
                size={24}
                color={post.liked_by_me ? colors.accent : colors.secondary}
              />
              <Text
                className={`text-sm font-semibold ${
                  post.liked_by_me ? 'text-accent' : 'text-apple-secondary'
                }`}
              >
                {post.reaction_count}
              </Text>
            </Pressable>
            <View className="flex-row items-center gap-2">
              <Ionicons name="chatbubble-outline" size={22} color={colors.secondary} />
              <Text className="text-sm font-semibold text-apple-secondary">
                {post.comment_count}
              </Text>
            </View>
          </View>
        </View>

        <View className="px-4 pt-6">
          <Text className="text-xs font-semibold uppercase tracking-[2px] text-apple-secondary">
            Comments
          </Text>
          {comments.length === 0 ? (
            <Text className="mt-3 text-sm text-apple-secondary">
              No comments yet. Double-tap the photo to like — tag someone with @handle.
            </Text>
          ) : (
            <View className="mt-3 gap-3">
              {comments.map((c) => (
                <View key={c.id} className="rounded-2xl border border-apple-border bg-apple-surface p-3">
                  <View className="flex-row items-center gap-2">
                    <Pressable
                      onPress={() => router.push(`/user/${c.author.handle}`)}
                      className="flex-1 flex-row items-center gap-2 active:opacity-80"
                    >
                      {c.author.avatar_url ? (
                        <Image
                          source={{ uri: c.author.avatar_url }}
                          className="h-7 w-7 rounded-full bg-apple-bg2"
                        />
                      ) : (
                        <View className="h-7 w-7 items-center justify-center rounded-full bg-apple-bg2">
                          <Text className="text-[10px] font-bold text-apple-ink">
                            {(c.author.display_name || c.author.handle || '?')[0].toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View className="min-w-0 flex-1">
                        <View className="flex-row items-center gap-1">
                          <Text className="text-sm font-semibold text-apple-ink">
                            {c.author.display_name}
                          </Text>
                          <UserBadges user={c.author} />
                        </View>
                        <Text className="text-xs text-apple-secondary">@{c.author.handle}</Text>
                      </View>
                    </Pressable>
                    {session?.user.id === c.author.id ? (
                      <Pressable
                        onPress={() => {
                          Alert.alert('Delete comment?', undefined, [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: async () => {
                                try {
                                  await deleteComment(c.id);
                                  const fresh = await listComments(post.id);
                                  setComments(fresh);
                                  setPost((p) =>
                                    p ? { ...p, comment_count: fresh.length } : p
                                  );
                                } catch (err) {
                                  Alert.alert(
                                    'Error',
                                    err instanceof Error ? err.message : 'Could not delete'
                                  );
                                }
                              },
                            },
                          ]);
                        }}
                        hitSlop={8}
                      >
                        <Ionicons name="trash-outline" size={16} color={colors.tertiary} />
                      </Pressable>
                    ) : null}
                    <Text className="text-[10px] text-apple-tertiary">
                      {formatRelative(c.created_at)}
                    </Text>
                  </View>
                  <MentionText body={c.body} baseClassName="mt-2 text-sm text-apple-secondary" />
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <KeyboardStickyFooter className="bg-apple-bg2 px-4 pt-3">
        <CommentComposer
          value={composer}
          onChangeText={setComposer}
          onSubmit={handleAddComment}
          posting={posting}
          editable={!!session && canCommentAndReact(tier)}
          placeholder={
            !session
              ? 'Sign in to comment'
              : canCommentAndReact(tier)
                ? 'Add a comment… use @handle to mention'
                : 'Member plan required to comment'
          }
        />
      </KeyboardStickyFooter>
    </View>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
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
