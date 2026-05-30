import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppleCard } from '@/components/apple/AppleCard';
import { AppleHeader } from '@/components/apple/AppleHeader';
import { SearchField } from '@/components/ui/SearchField';
import { MoneyText } from '@/components/apple/ApplePrimitives';
import { EventsSection } from '@/components/explore/EventsSection';
import { NearYouSection } from '@/components/explore/NearYouSection';
import { FollowButton } from '@/components/social/FollowButton';
import { UserBadges } from '@/components/UserBadges';
import { showAppAlert } from '@/lib/app-alert';
import { useAuth } from '@/lib/auth-context';
import { TAB_SCROLL_BOTTOM_INSET } from '@/lib/tab-screen-layout';
import { colors } from '@/lib/theme';
import type { FeedPost } from '@/lib/feed';
import { isModPost, resolvePostDisplayMedia } from '@/lib/feed';
import { PartCategoryFilters } from '@/components/explore/PartCategoryFilters';
import { PopularPartRow } from '@/components/explore/PopularPartRow';
import {
  enrichPartCardsWithShopping,
  listBuildsForSale,
  listPopularPartsForExplore,
  listTrendingPosts,
  parseExploreSearchQuery,
  type BuildForSale,
  type ExplorePartCard,
  enrichExplorePartCardsThumbnails,
  searchExploreCatalogueOnly,
  searchExploreDiscover,
  searchUsers,
  type UserSearchResult,
} from '@/lib/explore';
import {
  getViewerCoordinates,
  listNearbyBuilds,
  syncViewerLocationCoords,
  type NearbyBuild,
} from '@/lib/nearby-builds';
import { saveSearch } from '@/lib/saved-searches';
import { ensureSubscriptionTier } from '@/lib/subscription-guard';
import { useSubscriptionTier } from '@/hooks/use-subscription-tier';
import { listUpcomingEvents, type EventSummary } from '@/lib/events';
import { addWishlistItem, listUserWishlistPartIds } from '@/lib/wishlist';
import { useFocusData } from '@/lib/use-focus-data';
import type { ModCategory } from '@/types/database';

export default function ExploreScreen() {
  const { session } = useAuth();
  const { tier } = useSubscriptionTier();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [discoverSearching, setDiscoverSearching] = useState(false);
  const [userHits, setUserHits] = useState<UserSearchResult[]>([]);
  const [partHits, setPartHits] = useState<ExplorePartCard[]>([]);
  const [discoverHits, setDiscoverHits] = useState<ExplorePartCard[]>([]);

  const [popularParts, setPopularParts] = useState<ExplorePartCard[]>([]);
  const [trending, setTrending] = useState<FeedPost[]>([]);
  const [forSale, setForSale] = useState<BuildForSale[]>([]);
  const [nearby, setNearby] = useState<NearbyBuild[]>([]);
  const [nearbyLocationEnabled, setNearbyLocationEnabled] = useState(false);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedPartIds, setSavedPartIds] = useState<Set<string>>(() => new Set());
  const [savedDiscoverUrls, setSavedDiscoverUrls] = useState<Set<string>>(() => new Set());
  const [partCategory, setPartCategory] = useState<ModCategory | null>(null);

  const partFilters = useCallback(
    () => (partCategory ? { category: partCategory } : undefined),
    [partCategory]
  );

  const searchParsed = parseExploreSearchQuery(query);
  const isUserSearch = searchParsed.mode === 'user';

  const enrichShoppingRef = useRef(0);

  const enrichPopularPartsInBackground = useCallback(
    async (parts: ExplorePartCard[]) => {
      if (!session?.user.id || parts.length === 0) return;
      const token = ++enrichShoppingRef.current;
      try {
        const enriched = await enrichPartCardsWithShopping(parts, 8);
        if (enrichShoppingRef.current === token) {
          setPopularParts(enriched);
        }
      } catch {
        /* optional live prices */
      }
    },
    [session?.user.id]
  );

  const loadNearbyInBackground = useCallback(async () => {
    try {
      const viewer = await getViewerCoordinates();
      setNearbyLocationEnabled(viewer != null);
      if (viewer && session?.user.id) {
        void syncViewerLocationCoords(session.user.id, viewer).catch(() => {});
      }
      const nearBuilds = await listNearbyBuilds(viewer, {
        excludeUserId: session?.user.id ?? null,
        limit: 10,
      });
      setNearby(nearBuilds);
    } catch {
      /* near-you is optional */
    }
  }, [session?.user.id]);

  const loadCore = useCallback(async () => {
    try {
      const wishlistIdsPromise = session
        ? listUserWishlistPartIds(session.user.id)
        : Promise.resolve(new Set<string>());
      const [parts, posts, saleBuilds, wishlistPartIds, upcomingEvents] =
        await Promise.all([
          listPopularPartsForExplore(session?.user.id ?? null, 8, partFilters()),
          listTrendingPosts(session?.user.id ?? null, 30, 6),
          listBuildsForSale(8),
          wishlistIdsPromise,
          listUpcomingEvents(session?.user.id ?? null, 8).catch(() => [] as EventSummary[]),
        ]);
      setPopularParts(parts);
      setTrending(posts);
      setForSale(saleBuilds);
      setEvents(upcomingEvents);
      setSavedPartIds(wishlistPartIds);
      void enrichPopularPartsInBackground(parts);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load Explore';
      Alert.alert('Error', message);
    } finally {
      setRefreshing(false);
    }
  }, [session, partFilters, enrichPopularPartsInBackground]);

  const load = useCallback(async () => {
    await loadCore();
    void loadNearbyInBackground();
  }, [loadCore, loadNearbyInBackground]);

  useFocusData(
    async () => {
      await loadCore();
      void loadNearbyInBackground();
    },
    [loadCore, loadNearbyInBackground],
    { staleMs: 60_000 }
  );

  const partCategoryInitial = useRef(true);
  useEffect(() => {
    if (partCategoryInitial.current) {
      partCategoryInitial.current = false;
      return;
    }
    if (searchParsed.term.length >= 2) return;
    let cancelled = false;
    void (async () => {
      try {
        const parts = await listPopularPartsForExplore(
          session?.user.id ?? null,
          8,
          partFilters()
        );
        if (!cancelled) {
          setPopularParts(parts);
          void enrichPopularPartsInBackground(parts);
        }
      } catch {
        /* category filter refresh */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [partCategory, session?.user.id, partFilters, enrichPopularPartsInBackground, searchParsed.term]);

  // Debounced search: @handle → users only; otherwise catalogue first, Google in background.
  const searchToken = useRef(0);
  useEffect(() => {
    const { mode, term } = parseExploreSearchQuery(query);
    const minLen = mode === 'user' ? 1 : 2;
    if (term.length < minLen) {
      setUserHits([]);
      setPartHits([]);
      setDiscoverHits([]);
      setSearching(false);
      setDiscoverSearching(false);
      return;
    }
    const token = ++searchToken.current;
    setSearching(true);
    setDiscoverSearching(false);
    const handle = setTimeout(async () => {
      try {
        if (mode === 'user') {
          const users = await searchUsers(term, 6);
          if (searchToken.current === token) {
            setUserHits(users);
            setPartHits([]);
            setDiscoverHits([]);
          }
        } else {
          const catalogue = await searchExploreCatalogueOnly(term, { catalogue: 8 });
          if (searchToken.current !== token) return;

          setUserHits([]);
          setPartHits(catalogue);
          setDiscoverHits([]);
          setSearching(false);

          void (async () => {
            const enriched = await enrichExplorePartCardsThumbnails(catalogue);
            if (searchToken.current === token) setPartHits(enriched);
          })();

          if (!session?.user.id) return;

          setDiscoverSearching(true);
          void (async () => {
            try {
              const discover = await searchExploreDiscover(term, catalogue, 10);
              if (searchToken.current === token) setDiscoverHits(discover);
            } finally {
              if (searchToken.current === token) setDiscoverSearching(false);
            }
          })();
        }
      } finally {
        if (searchToken.current === token && mode === 'user') {
          setSearching(false);
        }
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query, session]);

  async function handleSaveToWishlist(part: ExplorePartCard) {
    if (!session) {
      showAppAlert('Sign in', 'Sign in to save parts to your wishlist.');
      return;
    }

    const isDiscover = part.source === 'discover';
    const discoverUrl = part.product_url?.trim() ?? '';
    if (isDiscover) {
      if (!discoverUrl || savedDiscoverUrls.has(discoverUrl)) return;
    } else if (savedPartIds.has(part.id)) {
      return;
    }

    setSavingId(part.id);
    try {
      const label = `${part.brand} ${part.name}`.trim();
      const priceNote = part.price_range ? `Typical price: ${part.price_range}` : null;
      const linkNote = discoverUrl ? `Product link: ${discoverUrl}` : null;
      const notes = [priceNote, linkNote].filter(Boolean).join('\n') || null;

      await addWishlistItem({
        userId: session.user.id,
        vehicleId: null,
        partId: isDiscover ? null : part.id,
        customPartName: isDiscover ? label : null,
        category: (part.category as ModCategory) ?? 'other',
        targetCost: null,
        notes,
        priority: 'medium',
      });

      if (isDiscover && discoverUrl) {
        setSavedDiscoverUrls((prev) => new Set(prev).add(discoverUrl));
      } else {
        setSavedPartIds((prev) => new Set(prev).add(part.id));
      }

      showAppAlert(
        'Saved',
        `${label} added to your wishlist. View it from Garage → Saved parts.`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save';
      showAppAlert('Save failed', message);
    } finally {
      setSavingId(null);
    }
  }

  const hasQuery =
    searchParsed.term.length >= (searchParsed.mode === 'user' ? 1 : 2);

  return (
    <SafeAreaView className="flex-1 bg-apple-bg2" edges={['top']}>
      <AppleHeader title="Explore" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: TAB_SCROLL_BOTTOM_INSET }}
        keyboardShouldPersistTaps="handled"
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
        <View className="px-4 pt-2">
          <View className="mb-4">
            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder="Search parts or @username"
              trailing={
                searching ? <ActivityIndicator color={colors.accent} size="small" /> : null
              }
            />
          </View>
          {hasQuery && session ? (
            <Pressable
              onPress={async () => {
                try {
                  if (!ensureSubscriptionTier(tier, 'member', 'Saved searches')) return;
                  await saveSearch(session.user.id, query);
                  Alert.alert('Saved', 'Search saved to your account.');
                } catch (err) {
                  const message = err instanceof Error ? err.message : 'Could not save';
                  Alert.alert('Save failed', message);
                }
              }}
              className="mt-2 self-start"
            >
              <Text className="text-sm font-semibold text-signal-blue">Save this search</Text>
            </Pressable>
          ) : null}
        </View>

        {/* ---- Search results ---- */}
        {hasQuery ? (
          <View className="mt-2">
            {searching &&
            userHits.length === 0 &&
            partHits.length === 0 &&
            discoverHits.length === 0 ? (
              <View className="items-center py-6">
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : userHits.length === 0 &&
              partHits.length === 0 &&
              discoverHits.length === 0 &&
              !discoverSearching ? (
              <View className="mx-4 mt-2">
                <AppleCard padded>
                  <Text className="font-semibold text-apple-ink">No matches</Text>
                  <Text className="mt-1 text-sm text-apple-secondary">
                    {isUserSearch
                      ? 'No users for that @handle — try a longer handle or display name.'
                      : session
                        ? 'No matches in the catalogue or from Google Shopping. Try another brand or part name.'
                        : 'Try another brand or part name — sign in for web results.'}
                  </Text>
                </AppleCard>
              </View>
            ) : (
              <View className="gap-5">
                {userHits.length > 0 ? (
                  <View>
                    <SectionLabel>People</SectionLabel>
                    <View className="gap-2 px-4 pt-2">
                      {userHits.map((u) => (
                        <AppleCard key={u.id} style={{ padding: 12 }}>
                        <View className="flex-row items-center gap-3">
                          <Pressable
                            onPress={() =>
                              router.push(
                                `/user/${u.handle}`
                              )
                            }
                            className="flex-1 flex-row items-center gap-3 active:opacity-80"
                          >
                            {u.avatar_url ? (
                              <Image
                                source={{ uri: u.avatar_url }}
                                className="h-10 w-10 rounded-full bg-apple-bg2"
                              />
                            ) : (
                              <View className="h-10 w-10 items-center justify-center rounded-full bg-apple-bg2">
                                <Text className="font-bold text-apple-ink">
                                  {(u.display_name || u.handle || '?')[0].toUpperCase()}
                                </Text>
                              </View>
                            )}
                            <View className="flex-1">
                              <View className="flex-row items-center gap-1.5">
                                <Text className="font-semibold text-apple-ink">
                                  {u.is_workshop && u.workshop_name
                                    ? u.workshop_name
                                    : u.display_name}
                                </Text>
                                <UserBadges user={u} />
                              </View>
                              <Text className="text-xs text-apple-secondary">@{u.handle}</Text>
                            </View>
                          </Pressable>
                          {!u.is_workshop ? (
                            <FollowButton userId={u.id} handle={u.handle} />
                          ) : null}
                          {u.is_workshop && u.workshop_phone ? (
                            <Pressable
                              onPress={() => Linking.openURL(`tel:${u.workshop_phone}`)}
                              className="rounded-xl bg-accent px-3 py-2 active:opacity-90"
                            >
                              <Text className="text-xs font-semibold text-white">Contact</Text>
                            </Pressable>
                          ) : null}
                        </View>
                        </AppleCard>
                      ))}
                    </View>
                  </View>
                ) : null}

                {partHits.length > 0 ? (
                  <View>
                    <SectionLabel>Parts in Wired</SectionLabel>
                    <View className="gap-2 px-4 pt-2">
                      {partHits.map((p) => (
                        <PopularPartRow
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

                {session && !isUserSearch && (discoverSearching || discoverHits.length > 0) ? (
                  <View>
                    <View className="flex-row items-center gap-2 px-4">
                      <SectionLabel inline>From the web</SectionLabel>
                      {discoverSearching ? (
                        <ActivityIndicator color={colors.accent} size="small" />
                      ) : null}
                    </View>
                    <Text className="px-4 pb-1 text-xs text-apple-secondary">
                      Live Google Shopping results — not saved to the catalogue.
                    </Text>
                    <View className="gap-2 px-4 pt-1">
                      {discoverHits.map((p) => (
                        <PopularPartRow
                          key={p.id}
                          part={p}
                          saving={savingId === p.id}
                          saved={
                            p.product_url
                              ? savedDiscoverUrls.has(p.product_url)
                              : false
                          }
                          onSave={() => handleSaveToWishlist(p)}
                        />
                      ))}
                    </View>
                  </View>
                ) : null}

              </View>
            )}
          </View>
        ) : (
          <View className="gap-6 pt-2">
            <NearYouSection builds={nearby} locationEnabled={nearbyLocationEnabled} />

            <EventsSection
              events={events}
              onCreatePress={() => {
                if (!session) {
                  showAppAlert('Sign in', 'Sign in to post an event.');
                  return;
                }
                router.push('/event/new');
              }}
            />

            <View>
              <View className="mb-3 flex-row items-center justify-between px-4">
                <View className="flex-row items-center gap-2">
                  <Text className="text-[22px] font-bold text-apple-ink" style={{ letterSpacing: -0.44 }}>
                    Trending mods
                  </Text>
                  <Ionicons name="flame" size={22} color={colors.accent} />
                </View>
                <Text className="text-xs font-medium text-apple-tertiary">This month</Text>
              </View>
              {trending.length === 0 ? (
                <View className="mx-4">
                  <AppleCard padded>
                    <Text className="font-semibold text-apple-ink">Nothing trending yet</Text>
                    <Text className="mt-1 text-sm text-apple-secondary">
                      Log a public mod or like one to seed the charts.
                    </Text>
                  </AppleCard>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 8 }}
                >
                  {trending.map((post, idx) => (
                    <TrendingCard
                      key={post.id}
                      post={post}
                      rank={idx + 1}
                      onPress={() => router.push(`/post/${post.id}`)}
                    />
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Builds like yours — horizontal carousel */}
            {forSale.length > 0 ? (
              <View>
                <View className="mb-3 flex-row items-baseline justify-between px-4">
                  <Text className="text-[22px] font-bold text-apple-ink" style={{ letterSpacing: -0.44 }}>
                    Builds for sale
                  </Text>
                  <Pressable onPress={() => router.push('/explore')}>
                    <Text className="text-[15px] font-semibold text-signal-blue">See all</Text>
                  </Pressable>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 4 }}
                >
                  {forSale.map((b, i) => {
                    const accent = [colors.accent, colors.green, colors.amber][i % 3];
                    return (
                      <Pressable
                        key={b.id}
                        onPress={() => router.push(`/build/${b.id}`)}
                        style={{ width: 200 }}
                      >
                        <AppleCard style={{ overflow: 'hidden', padding: 0 }}>
                          {b.cover_photo_url ? (
                            <Image
                              source={{ uri: b.cover_photo_url }}
                              className="aspect-[4/3] w-full bg-apple-bg2"
                              resizeMode="cover"
                            />
                          ) : (
                            <View
                              className="aspect-[4/3] w-full items-center justify-center"
                              style={{ backgroundColor: `${accent}14` }}
                            >
                              <Ionicons name="car-sport-outline" size={48} color={accent} />
                            </View>
                          )}
                          <View className="p-3.5">
                            <Text className="text-base font-semibold text-apple-ink">
                              {b.nickname ?? `${b.make} ${b.model}`}
                            </Text>
                            <Text className="text-[13px] text-apple-secondary">
                              {b.year} {b.make} {b.model}
                            </Text>
                            {b.asking_price != null ? (
                              <View className="mt-3 flex-row items-center justify-between border-t border-apple-border pt-3">
                                <Text className="text-[13px] text-apple-secondary">Asking</Text>
                                <MoneyText
                                  value={Number(b.asking_price)}
                                  size={16}
                                  color={colors.accent}
                                  weight="700"
                                />
                              </View>
                            ) : null}
                          </View>
                        </AppleCard>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            <View>
              <View className="mb-2 flex-row items-center justify-between px-4 pt-4">
                <View className="flex-row items-center gap-2">
                  <Text
                    className="text-[22px] font-bold text-apple-ink"
                    style={{ letterSpacing: -0.44 }}
                  >
                    Popular parts
                  </Text>
                  <Ionicons name="cart-outline" size={22} color={colors.accent} />
                </View>
                <Pressable
                  onPress={() =>
                    router.push(
                      partCategory
                        ? `/explore/parts?category=${partCategory}`
                        : '/explore/parts'
                    )
                  }
                  hitSlop={8}
                >
                  <Text className="text-[15px] font-semibold text-signal-blue">View all</Text>
                </Pressable>
              </View>
              <Text className="mb-3 px-4 text-[13px] text-apple-secondary">
                Shop by category — compare community picks and live web prices.
              </Text>
              <PartCategoryFilters category={partCategory} onCategoryChange={setPartCategory} />
              <View className="mt-3 gap-2 px-4">
                {popularParts.length === 0 ? (
                  <AppleCard padded>
                    <Text className="text-sm text-apple-secondary">
                      No catalogue parts in this category yet. Try All types or search above.
                    </Text>
                  </AppleCard>
                ) : (
                  popularParts.map((p) => (
                    <PopularPartRow
                      key={p.id}
                      part={p}
                      saving={savingId === p.id}
                      saved={savedPartIds.has(p.id)}
                      onSave={() => handleSaveToWishlist(p)}
                    />
                  ))
                )}
              </View>
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
      className={`text-[13px] font-semibold text-apple-secondary ${
        inline ? 'px-4' : 'px-4'
      }`}
      style={{ letterSpacing: -0.13 }}
    >
      {children}
    </Text>
  );
}

function TrendingCard({
  post,
  rank,
  onPress,
}: {
  post: FeedPost;
  rank: number;
  onPress: () => void;
}) {
  const thumb = resolvePostDisplayMedia(post)[0]?.url;
  const title = isModPost(post)
    ? post.mod?.part
      ? `${post.mod.part.brand} ${post.mod.part.name}`
      : post.mod?.custom_part_name ?? `${post.vehicle.make} ${post.vehicle.model}`
    : post.body?.trim() || `${post.vehicle.make} ${post.vehicle.model}`;
  const likes =
    post.reaction_count >= 1000
      ? `${(post.reaction_count / 1000).toFixed(1)}k`
      : String(post.reaction_count);

  return (
    <Pressable onPress={onPress} style={{ width: 168 }}>
      <AppleCard style={{ padding: 0, overflow: 'hidden' }}>
        <View className="relative">
          {thumb ? (
            <Image
              source={{ uri: thumb }}
              className="aspect-square w-full bg-apple-bg2"
              resizeMode="cover"
            />
          ) : (
            <View
              className="aspect-square w-full items-center justify-center"
              style={{ backgroundColor: colors.accentSoft }}
            >
              <Ionicons name="car-sport-outline" size={36} color={colors.accent} />
            </View>
          )}
          <View
            className="absolute left-2 top-2 h-7 w-7 items-center justify-center rounded-full"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
          >
            <Text className="text-xs font-bold text-white">#{rank}</Text>
          </View>
        </View>
        <View className="p-3">
          <Text className="text-sm font-semibold text-apple-ink" numberOfLines={2}>
            {title}
          </Text>
          <Text className="mt-1 text-xs text-apple-secondary" numberOfLines={1}>
            @{post.author.handle}
          </Text>
          <View className="mt-2 flex-row items-center gap-1">
            <Ionicons name="heart" size={12} color={colors.accent} />
            <Text className="text-xs font-semibold text-accent">{likes}</Text>
          </View>
        </View>
      </AppleCard>
    </Pressable>
  );
}
