import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { UserBadges } from '@/components/UserBadges';
import { showAppAlert } from '@/lib/app-alert';
import { useAuth } from '@/lib/auth-context';
import type { FeedPost } from '@/lib/feed';
import {
  listBuildsForSale,
  listPopularParts,
  listTrendingPosts,
  type BuildForSale,
  searchPartsForExplore,
  searchUsers,
  type PartSearchResult,
  type UserSearchResult,
} from '@/lib/explore';
import { saveSearch } from '@/lib/saved-searches';
import { canSaveSearches, getUserSubscriptionTier } from '@/lib/subscription';
import { addWishlistItem, listUserWishlistPartIds } from '@/lib/wishlist';
import type { ModCategory } from '@/types/database';

export default function ExploreScreen() {
  const { session } = useAuth();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [userHits, setUserHits] = useState<UserSearchResult[]>([]);
  const [partHits, setPartHits] = useState<PartSearchResult[]>([]);

  const [popularParts, setPopularParts] = useState<PartSearchResult[]>([]);
  const [trending, setTrending] = useState<FeedPost[]>([]);
  const [forSale, setForSale] = useState<BuildForSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedPartIds, setSavedPartIds] = useState<Set<string>>(() => new Set());

  const load = useCallback(async () => {
    try {
      const wishlistIdsPromise = session
        ? listUserWishlistPartIds(session.user.id)
        : Promise.resolve(new Set<string>());
      const [parts, posts, saleBuilds, wishlistPartIds] = await Promise.all([
        listPopularParts(12),
        listTrendingPosts(session?.user.id ?? null, 30, 6),
        listBuildsForSale(8),
        wishlistIdsPromise,
      ]);
      setPopularParts(parts);
      setTrending(posts);
      setForSale(saleBuilds);
      setSavedPartIds(wishlistPartIds);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load Explore';
      Alert.alert('Error', message);
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

  // Debounced search across users + parts.
  const searchToken = useRef(0);
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setUserHits([]);
      setPartHits([]);
      setSearching(false);
      return;
    }
    const token = ++searchToken.current;
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const [users, parts] = await Promise.all([
          searchUsers(term, 6),
          searchPartsForExplore(term, 8),
        ]);
        if (searchToken.current === token) {
          setUserHits(users);
          setPartHits(parts);
        }
      } finally {
        if (searchToken.current === token) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  async function handleSaveToWishlist(part: PartSearchResult) {
    if (!session) {
      showAppAlert('Sign in', 'Sign in to save parts to your wishlist.');
      return;
    }
    if (savedPartIds.has(part.id)) return;

    setSavingId(part.id);
    try {
      await addWishlistItem({
        userId: session.user.id,
        vehicleId: null,
        partId: part.id,
        customPartName: null,
        category: part.category as ModCategory,
        targetCost: null,
        notes: null,
        priority: 'medium',
      });
      setSavedPartIds((prev) => new Set(prev).add(part.id));
      showAppAlert(
        'Saved',
        `${part.brand} ${part.name} added to your wishlist. View it from Profile → My wishlist.`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save';
      showAppAlert('Save failed', message);
    } finally {
      setSavingId(null);
    }
  }

  const hasQuery = query.trim().length >= 2;

  return (
    <SafeAreaView className="flex-1 bg-ink-950" edges={['top']}>
      <ScrollView
        contentContainerClassName="pb-24"
        keyboardShouldPersistTaps="handled"
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
          <Text className="text-accent text-xs font-semibold tracking-[3px]">EXPLORE</Text>
          <Text className="mt-1 text-3xl font-bold text-white">Discover builds</Text>
          <Text className="mt-2 text-ink-300">
            Find people, parts, and what&apos;s being installed this month.
          </Text>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search people or parts…"
            placeholderTextColor="#5A6373"
            autoCapitalize="none"
            autoCorrect={false}
            className="mt-5 rounded-xl bg-ink-900 px-4 py-3 text-white"
          />
          {hasQuery && session ? (
            <Pressable
              onPress={async () => {
                try {
                  const tier = await getUserSubscriptionTier(session.user.id);
                  if (!canSaveSearches(tier)) {
                    Alert.alert(
                      'Member perk',
                      'Saved searches require a Member subscription or higher.'
                    );
                    return;
                  }
                  await saveSearch(session.user.id, query);
                  Alert.alert('Saved', 'Search saved to your account.');
                } catch (err) {
                  const message = err instanceof Error ? err.message : 'Could not save';
                  Alert.alert('Save failed', message);
                }
              }}
              className="mt-2 self-start"
            >
              <Text className="text-sm font-semibold text-accent">Save this search</Text>
            </Pressable>
          ) : null}
        </View>

        {/* ---- Search results ---- */}
        {hasQuery ? (
          <View className="mt-4">
            {searching ? (
              <View className="items-center py-6">
                <ActivityIndicator color="#F5A524" />
              </View>
            ) : userHits.length === 0 && partHits.length === 0 ? (
              <View className="mx-6 mt-2 rounded-2xl border border-ink-700 bg-ink-900 p-5">
                <Text className="text-ink-200 font-semibold">No matches</Text>
                <Text className="mt-1 text-sm text-ink-300">
                  Try a brand, part name, handle or builder name.
                </Text>
              </View>
            ) : (
              <View className="gap-5">
                {userHits.length > 0 ? (
                  <View>
                    <SectionLabel>People</SectionLabel>
                    <View className="gap-2 px-6 pt-2">
                      {userHits.map((u) => (
                        <View
                          key={u.id}
                          className="flex-row items-center gap-3 rounded-2xl border border-ink-700 bg-ink-900 p-3"
                        >
                          <Pressable
                            onPress={() =>
                              router.push(
                                u.is_workshop ? `/workshop/${u.handle}` : `/user/${u.handle}`
                              )
                            }
                            className="flex-1 flex-row items-center gap-3 active:opacity-80"
                          >
                            {u.avatar_url ? (
                              <Image
                                source={{ uri: u.avatar_url }}
                                className="h-10 w-10 rounded-full bg-ink-700"
                              />
                            ) : (
                              <View className="h-10 w-10 items-center justify-center rounded-full bg-ink-700">
                                <Text className="font-bold text-white">
                                  {(u.display_name || u.handle || '?')[0].toUpperCase()}
                                </Text>
                              </View>
                            )}
                            <View className="flex-1">
                              <View className="flex-row items-center gap-1.5">
                                <Text className="font-semibold text-white">
                                  {u.is_workshop && u.workshop_name
                                    ? u.workshop_name
                                    : u.display_name}
                                </Text>
                                <UserBadges user={u} />
                              </View>
                              <Text className="text-xs text-ink-300">@{u.handle}</Text>
                            </View>
                          </Pressable>
                          {u.is_workshop && u.workshop_phone ? (
                            <Pressable
                              onPress={() => Linking.openURL(`tel:${u.workshop_phone}`)}
                              className="rounded-lg bg-accent px-3 py-2 active:bg-accent-dark"
                            >
                              <Text className="text-xs font-semibold text-ink-950">Contact</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                {partHits.length > 0 ? (
                  <View>
                    <SectionLabel>Parts</SectionLabel>
                    <View className="gap-2 px-6 pt-2">
                      {partHits.map((p) => (
                        <PartRow
                          key={p.id}
                          part={p}
                          saving={savingId === p.id}
                          saved={savedPartIds.has(p.id)}
                          onSave={() => handleSaveToWishlist(p)}
                        />
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            )}
          </View>
        ) : loading ? (
          <View className="mt-12 items-center">
            <ActivityIndicator color="#F5A524" />
          </View>
        ) : (
          <View className="gap-6 pt-2">
            {forSale.length > 0 ? (
              <View className="mt-8">
                <SectionLabel inline>Builds for sale</SectionLabel>
                <View className="mt-3 gap-3">
                  {forSale.map((b) => (
                    <Pressable
                      key={b.id}
                      onPress={() => router.push(`/build/${b.id}`)}
                      className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 active:bg-ink-800"
                    >
                      {b.cover_photo_url ? (
                        <Image
                          source={{ uri: b.cover_photo_url }}
                          className="h-24 w-full bg-ink-800"
                          resizeMode="cover"
                        />
                      ) : null}
                      <View className="p-4">
                        <Text className="font-semibold text-white">
                          {b.nickname ?? `${b.make} ${b.model}`}
                        </Text>
                        {b.asking_price != null ? (
                          <Text className="mt-1 text-accent">
                            ${Number(b.asking_price).toLocaleString()}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {/* ---- Popular parts ---- */}
            <View>
              <View className="flex-row items-end justify-between px-6 pt-4">
                <SectionLabel inline>Popular parts</SectionLabel>
                <Text className="text-[10px] uppercase tracking-wider text-ink-300">
                  by install count
                </Text>
              </View>
              <View className="mt-2 gap-2 px-6">
                {popularParts.map((p) => (
                  <PartRow
                    key={p.id}
                    part={p}
                    saving={savingId === p.id}
                    saved={savedPartIds.has(p.id)}
                    onSave={() => handleSaveToWishlist(p)}
                  />
                ))}
              </View>
            </View>

            {/* ---- Trending posts ---- */}
            <View>
              <View className="flex-row items-end justify-between px-6 pt-2">
                <SectionLabel inline>Trending this month</SectionLabel>
                <Text className="text-[10px] uppercase tracking-wider text-ink-300">
                  top reactions
                </Text>
              </View>
              {trending.length === 0 ? (
                <View className="mx-6 mt-2 rounded-2xl border border-ink-700 bg-ink-900 p-5">
                  <Text className="text-ink-200 font-semibold">Nothing trending yet</Text>
                  <Text className="mt-1 text-sm text-ink-300">
                    Log a public mod or like one to seed the charts.
                  </Text>
                </View>
              ) : (
                <View className="mt-2 gap-2 px-6">
                  {trending.map((post) => (
                    <TrendingCard
                      key={post.id}
                      post={post}
                      onPress={() => router.push(`/post/${post.id}`)}
                    />
                  ))}
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionLabel({
  children,
  inline,
}: {
  children: React.ReactNode;
  inline?: boolean;
}) {
  return (
    <Text
      className={`text-xs font-semibold uppercase tracking-[2px] text-ink-300 ${
        inline ? '' : 'px-6'
      }`}
    >
      {children}
    </Text>
  );
}

function PartRow({
  part,
  saving,
  saved,
  onSave,
}: {
  part: PartSearchResult;
  saving: boolean;
  saved: boolean;
  onSave: () => void;
}) {
  const router = useRouter();
  return (
    <View className="flex-row items-center gap-3 rounded-2xl border border-ink-700 bg-ink-900 px-3 py-3">
      <View className="min-w-0 flex-1">
        <Pressable
          onPress={() => router.push(`/part/${part.id}`)}
          className="active:opacity-80"
        >
          <Text className="text-[10px] uppercase tracking-wider text-ink-300">
            {part.category.replace('_', ' ')}
          </Text>
          <Text className="mt-0.5 text-base font-semibold text-white">{part.brand}</Text>
          <Text className="text-sm text-ink-200">{part.name}</Text>
          <Text className="mt-1 text-[11px] text-ink-300">
            {part.install_count} install{part.install_count === 1 ? '' : 's'}
          </Text>
        </Pressable>
      </View>
      <Pressable
        onPress={onSave}
        disabled={saving || saved}
        className={`shrink-0 rounded-lg px-3 py-1.5 disabled:opacity-60 ${
          saved ? 'bg-ink-700' : 'bg-accent/20 active:bg-accent/30'
        }`}
        accessibilityRole="button"
        accessibilityLabel={saved ? 'Saved to wishlist' : 'Add to wishlist'}
      >
        {saving ? (
          <ActivityIndicator color="#F5A524" />
        ) : (
          <Text
            className={`text-xs font-semibold ${saved ? 'text-ink-300' : 'text-accent'}`}
          >
            {saved ? 'Saved' : '+ Wishlist'}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

function TrendingCard({ post, onPress }: { post: FeedPost; onPress: () => void }) {
  const partLabel = post.mod?.part
    ? `${post.mod.part.brand} ${post.mod.part.name}`
    : post.mod?.custom_part_name ?? 'Build update';
  return (
    <Pressable
      onPress={onPress}
      className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 active:bg-ink-800"
    >
      {post.mod?.photo_url ? (
        <Image
          source={{ uri: post.mod.photo_url }}
          className="h-40 w-full bg-ink-800"
          resizeMode="cover"
        />
      ) : null}
      <View className="p-4">
        <Text className="text-[11px] uppercase tracking-wider text-ink-300">
          {post.vehicle.year} · {post.vehicle.make} · {post.vehicle.model}
        </Text>
        <Text className="mt-1 text-base font-semibold text-white" numberOfLines={1}>
          {partLabel}
        </Text>
        <View className="mt-2 flex-row items-center justify-between">
          <Text className="text-xs text-ink-300">@{post.author.handle}</Text>
          <View className="flex-row gap-3">
            <Text className="text-xs text-ink-300">♥ {post.reaction_count}</Text>
            <Text className="text-xs text-ink-300">💬 {post.comment_count}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
