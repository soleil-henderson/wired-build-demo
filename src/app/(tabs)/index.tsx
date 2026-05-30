import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  Share,
  Text,
  View,
} from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InstagramHomeHeader } from '@/components/InstagramHomeHeader';
import { AppleCard } from '@/components/apple/AppleCard';
import { GradientAvatar, MoneyText, VerifiedLabel } from '@/components/apple/ApplePrimitives';
import { SegmentedControl } from '@/components/apple/SegmentedControl';
import { MediaCarousel } from '@/components/ui/MediaCarousel';
import { StoriesRow } from '@/components/social/StoriesRow';
import { HomeSwipeShell } from '@/components/social/HomeSwipeShell';
import { ModToolsDisplay } from '@/components/mods/ModToolsDisplay';
import { FollowButton } from '@/components/social/FollowButton';
import { UserBadges } from '@/components/UserBadges';
import { useSubscriptionTier } from '@/hooks/use-subscription-tier';
import { useAuth } from '@/lib/auth-context';
import { ensureSubscriptionTier } from '@/lib/subscription-guard';
import {
  listFeed,
  isModPost,
  resolvePostDisplayMedia,
  togglePostLike,
  type FeedMode,
  type FeedPost,
} from '@/lib/feed';
import { listStoryRings, type StoryRing } from '@/lib/stories';
import { TAB_SCROLL_BOTTOM_INSET } from '@/lib/tab-screen-layout';
import { colors } from '@/lib/theme';
import { resolveModShopLink } from '@/lib/shop-link';
import { navigateToModProduct } from '@/lib/product-nav';
import { useUnreadNotifications } from '@/lib/unread-notifications-context';
import { useUnreadMessages } from '@/lib/unread-messages-context';
import { useFocusData } from '@/lib/use-focus-data';

export default function FeedScreen() {
  const { session } = useAuth();
  const { tier } = useSubscriptionTier();
  const router = useRouter();
  const { count: unread, refresh: refreshUnread, clearLocal: clearUnread } =
    useUnreadNotifications();
  const { count: unreadMessages, refresh: refreshMessageUnread } = useUnreadMessages();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [mode, setMode] = useState<FeedMode>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [storyRings, setStoryRings] = useState<StoryRing[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(true);

  const loadFresh = useCallback(async () => {
    try {
      const [page, rings] = await Promise.all([
        listFeed(session?.user.id ?? null, mode, null),
        session
          ? listStoryRings(session.user.id).catch(() => [] as StoryRing[])
          : Promise.resolve([] as StoryRing[]),
      ]);
      await Promise.all([refreshUnread(), refreshMessageUnread()]);
      setPosts(page.posts);
      setCursor(page.nextCursor);
      setStoryRings(rings);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load feed';
      Alert.alert('Feed failed', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setStoriesLoading(false);
    }
  }, [session, mode, refreshUnread, refreshMessageUnread]);

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

  useFocusData(
    async ({ isInitial }) => {
      if (isInitial && posts.length === 0) setLoading(true);
      await loadFresh();
    },
    [loadFresh]
  );

  async function handleToggleLike(post: FeedPost) {
    if (!session) {
      Alert.alert('Sign in', 'Sign in to react.');
      return;
    }
    if (!ensureSubscriptionTier(tier, 'member', 'Liking posts')) return;
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
    <View>
      {session ? (
        <StoriesRow rings={storyRings} loading={storiesLoading && storyRings.length === 0} />
      ) : null}
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
              {posts.length > 0 ? `${posts.length}+ posts in your feed` : 'What\u2019s being built'}
            </Text>
            <Text className="text-[13px] text-apple-secondary">
              Mods, photos, and adventures from the network
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
              No public posts yet. Log a mod or share photos from the Create tab.
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
    <HomeSwipeShell enabled={!!session && Platform.OS !== 'web'}>
      <SafeAreaView className="flex-1 bg-apple-bg2" edges={['top']}>
        <InstagramHomeHeader
          notificationCount={unread}
          messageCount={unreadMessages}
          onNotificationsPress={() => {
            clearUnread();
            router.push('/notifications');
          }}
          onMessagesPress={() => router.push('/messages')}
        />
        <FlatList
          style={{ flex: 1 }}
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
          contentContainerStyle={{ paddingBottom: TAB_SCROLL_BOTTOM_INSET }}
        />
      </SafeAreaView>
    </HomeSwipeShell>
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
  const brandLabel = post.mod?.part?.brand ?? post.mod?.category.replace('_', ' ') ?? '';
  const displayMedia = resolvePostDisplayMedia(post);
  const caption = isModPost(post)
    ? post.body ?? (partLabel ? `Installed ${partLabel}` : null)
    : post.body;
  const shopLink = post.mod
    ? resolveModShopLink({
        product_links: post.mod.product_links,
        part: post.mod.part,
        partLabel,
      })
    : null;
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
            {isModPost(post)
              ? `${vehicleTitle} · ${formatRelative(post.created_at)}`
              : formatRelative(post.created_at)}
          </Text>
        </Pressable>
        <FollowButton userId={post.author.id} handle={post.author.handle} />
      </View>

      {displayMedia.length > 0 ? (
        <MediaCarousel
          items={displayMedia}
          aspectRatio={1}
          liked={post.liked_by_me}
          onSingleTap={onOpenPost}
          onDoubleTap={onToggleLike}
        />
      ) : null}

      <View className="px-4 py-3.5">
        {caption ? (
          <Text className="mb-3 text-[15px] leading-[22px] text-apple-ink">{caption}</Text>
        ) : null}

        {post.mod && (partLabel || shopLink) ? (
          <Pressable
            onPress={() => navigateToModProduct(router, post.mod)}
            className="mb-3.5 flex-row items-center gap-3 rounded-[14px] p-3 active:opacity-80"
            style={{ backgroundColor: colors.bg2 }}
          >
            <View className="h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-white">
              <Ionicons name="pricetag-outline" size={16} color={avatarColor} />
            </View>
            <View className="min-w-0 flex-1">
              {partLabel ? (
                <>
                  <Text className="text-xs font-semibold text-apple-secondary">{brandLabel}</Text>
                  <Text className="text-sm font-semibold text-apple-ink" numberOfLines={1}>
                    {partLabel}
                  </Text>
                </>
              ) : (
                <Text className="text-sm font-semibold text-apple-ink" numberOfLines={1}>
                  {shopLink?.subtitle ?? 'Product link'}
                </Text>
              )}
            </View>
            {post.mod.cost != null ? (
              <MoneyText value={Number(post.mod.cost)} size={16} color={colors.accent} weight="700" />
            ) : null}
            <Ionicons name="chevron-forward" size={18} color={colors.tertiary} />
          </Pressable>
        ) : null}

        {post.mod && (post.mod.tools?.length ?? 0) > 0 ? (
          <ModToolsDisplay tools={post.mod.tools} />
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
