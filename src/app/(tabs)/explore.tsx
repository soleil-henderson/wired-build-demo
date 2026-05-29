import { Ionicons } from '@expo/vector-icons';
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

import { AppleCard } from '@/components/apple/AppleCard';
import { AppleHeader } from '@/components/apple/AppleHeader';
import { MoneyText, VehicleThumb } from '@/components/apple/ApplePrimitives';
import { UserBadges } from '@/components/UserBadges';
import { showAppAlert } from '@/lib/app-alert';
import { useAuth } from '@/lib/auth-context';
import { colors } from '@/lib/theme';
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
    <SafeAreaView className="flex-1 bg-apple-bg2" edges={['top']}>
      <AppleHeader title="Explore" />
      <ScrollView
        contentContainerClassName="pb-24"
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
          <AppleCard style={{ marginBottom: 24, padding: 0, overflow: 'hidden' }}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search builds, parts, people"
              placeholderTextColor={colors.tertiary}
              autoCapitalize="none"
              autoCorrect={false}
              className="px-4 py-3.5 text-base text-apple-ink"
            />
          </AppleCard>
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
              <Text className="text-sm font-semibold text-signal-blue">Save this search</Text>
            </Pressable>
          ) : null}
        </View>

        {/* ---- Search results ---- */}
        {hasQuery ? (
          <View className="mt-4">
            {searching ? (
              <View className="items-center py-6">
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : userHits.length === 0 && partHits.length === 0 ? (
              <View className="mx-4 mt-2">
                <AppleCard padded>
                  <Text className="font-semibold text-apple-ink">No matches</Text>
                  <Text className="mt-1 text-sm text-apple-secondary">
                    Try a brand, part name, handle or builder name.
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
                                u.is_workshop ? `/workshop/${u.handle}` : `/user/${u.handle}`
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
                    <SectionLabel>Parts</SectionLabel>
                    <View className="gap-2 px-4 pt-2">
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
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <View className="gap-6 pt-2">
            {/* Builds like yours — horizontal carousel */}
            {forSale.length > 0 ? (
              <View className="mt-2">
                <View className="mb-3.5 flex-row items-baseline justify-between px-4">
                  <Text
                    className="text-[22px] font-bold text-apple-ink"
                    style={{ letterSpacing: -0.44 }}
                  >
                    Builds like yours
                  </Text>
                  <Text className="text-[15px] font-semibold text-signal-blue">See all</Text>
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
              <View className="flex-row items-end justify-between px-4 pt-4">
                <Text
                  className="text-[22px] font-bold text-apple-ink"
                  style={{ letterSpacing: -0.44 }}
                >
                  Popular parts
                </Text>
                <Text className="text-xs font-medium text-apple-tertiary">by installs</Text>
              </View>
              <View className="mt-2 gap-2 px-4">
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

            <View>
              <View className="mb-3.5 flex-row items-center gap-2 px-4">
                <Text
                  className="text-[22px] font-bold text-apple-ink"
                  style={{ letterSpacing: -0.44 }}
                >
                  Trending
                </Text>
                <Ionicons name="flame" size={22} color={colors.accent} />
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
                <View className="mx-4">
                  <AppleCard style={{ padding: 0, overflow: 'hidden' }}>
                    {trending.map((post, idx) => (
                      <TrendingRow
                        key={post.id}
                        post={post}
                        rank={idx + 1}
                        last={idx === trending.length - 1}
                        onPress={() => router.push(`/post/${post.id}`)}
                      />
                    ))}
                  </AppleCard>
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
      className={`text-[13px] font-semibold text-apple-secondary ${
        inline ? 'px-4' : 'px-4'
      }`}
      style={{ letterSpacing: -0.13 }}
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
    <AppleCard style={{ padding: 12 }}>
      <View className="flex-row items-center gap-3">
      <View className="min-w-0 flex-1">
        <Pressable
          onPress={() => router.push(`/part/${part.id}`)}
          className="active:opacity-80"
        >
          <Text className="text-[10px] font-semibold uppercase tracking-wider text-apple-tertiary">
            {part.category.replace('_', ' ')}
          </Text>
          <Text className="mt-0.5 text-base font-semibold text-apple-ink">{part.brand}</Text>
          <Text className="text-sm text-apple-secondary">{part.name}</Text>
          <Text className="mt-1 text-[11px] text-apple-tertiary">
            {part.install_count} install{part.install_count === 1 ? '' : 's'}
          </Text>
        </Pressable>
      </View>
      <Pressable
        onPress={onSave}
        disabled={saving || saved}
        className={`shrink-0 rounded-xl px-3 py-1.5 disabled:opacity-60 ${
          saved ? 'bg-apple-bg2' : 'bg-accent-soft active:opacity-80'
        }`}
        accessibilityRole="button"
        accessibilityLabel={saved ? 'Saved to wishlist' : 'Add to wishlist'}
      >
        {saving ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <Text
            className={`text-xs font-semibold ${saved ? 'text-apple-tertiary' : 'text-accent'}`}
          >
            {saved ? 'Saved' : '+ Wishlist'}
          </Text>
        )}
      </Pressable>
      </View>
    </AppleCard>
  );
}

function TrendingRow({
  post,
  rank,
  last,
  onPress,
}: {
  post: FeedPost;
  rank: number;
  last: boolean;
  onPress: () => void;
}) {
  const partLabel = post.mod?.part
    ? `${post.mod.part.brand} ${post.mod.part.name}`
    : post.mod?.custom_part_name ?? `${post.vehicle.make} ${post.vehicle.model}`;
  const likes =
    post.reaction_count >= 1000
      ? `${(post.reaction_count / 1000).toFixed(1)}k`
      : String(post.reaction_count);

  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-3.5 px-4 py-3.5 active:bg-apple-bg2 ${
        last ? '' : 'border-b border-apple-border'
      }`}
    >
      <Text className="w-6 text-xl font-bold text-accent">{rank}</Text>
      <VehicleThumb size={48} color={colors.accent} />
      <View className="min-w-0 flex-1">
        <Text className="text-[15px] font-semibold text-apple-ink" numberOfLines={1}>
          {partLabel}
        </Text>
        <Text className="text-[13px] text-apple-secondary">
          @{post.author.handle} · {likes} likes
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.tertiary} />
    </Pressable>
  );
}
