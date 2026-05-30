import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { AppleCard } from '@/components/apple/AppleCard';
import { PartCategoryFilters } from '@/components/explore/PartCategoryFilters';
import { PopularPartRow } from '@/components/explore/PopularPartRow';
import { SearchField } from '@/components/ui/SearchField';
import { showAppAlert } from '@/lib/app-alert';
import { useAuth } from '@/lib/auth-context';
import {
  enrichExplorePartCardsThumbnails,
  enrichPartCardsWithShopping,
  listPopularPartsForExplore,
  searchExploreCatalogueOnly,
  searchExploreDiscover,
  type ExplorePartCard,
} from '@/lib/explore';
import { modCategoryFromParam } from '@/lib/mod-categories';
import { colors } from '@/lib/theme';
import { addWishlistItem, listUserWishlistPartIds } from '@/lib/wishlist';
import type { ModCategory } from '@/types/database';

const PAGE_SIZE = 48;

export default function PartsMarketplaceScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  const { session } = useAuth();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ModCategory | null>(() =>
    modCategoryFromParam(params.category)
  );
  const [parts, setParts] = useState<ExplorePartCard[]>([]);
  const [discoverParts, setDiscoverParts] = useState<ExplorePartCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [discoverSearching, setDiscoverSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedPartIds, setSavedPartIds] = useState<Set<string>>(() => new Set());
  const [savedDiscoverUrls, setSavedDiscoverUrls] = useState<Set<string>>(() => new Set());

  const enrichRef = useRef(0);
  const searchToken = useRef(0);

  const searchTerm = query.trim();
  const isSearching = searchTerm.length >= 2;

  const partFilters = useCallback(
    () => (category ? { category } : undefined),
    [category]
  );

  const enrichShopping = useCallback(
    async (cards: ExplorePartCard[]) => {
      if (!session?.user.id || cards.length === 0) return;
      const token = ++enrichRef.current;
      try {
        const enriched = await enrichPartCardsWithShopping(cards, 16);
        if (enrichRef.current === token) setParts(enriched);
      } catch {
        /* optional */
      }
    },
    [session?.user.id]
  );

  const loadBrowse = useCallback(async () => {
    const list = await listPopularPartsForExplore(
      session?.user.id ?? null,
      PAGE_SIZE,
      partFilters()
    );
    setParts(list);
    void enrichShopping(list);
  }, [session?.user.id, partFilters, enrichShopping]);

  const load = useCallback(async () => {
    try {
      if (session?.user.id) {
        const ids = await listUserWishlistPartIds(session.user.id);
        setSavedPartIds(ids);
      }
      if (isSearching) return;
      await loadBrowse();
    } catch (err) {
      showAppAlert('Error', err instanceof Error ? err.message : 'Could not load parts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.user.id, isSearching, loadBrowse]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (isSearching) return;
    if (parts.length === 0) setLoading(true);
    void loadBrowse().finally(() => setLoading(false));
  }, [category, isSearching, loadBrowse, parts.length]);

  useEffect(() => {
    if (searchTerm.length < 2) {
      setDiscoverParts([]);
      setDiscoverSearching(false);
      setSearching(false);
      if (searchTerm.length === 0) {
        setLoading(true);
        void loadBrowse().finally(() => setLoading(false));
      }
      return;
    }

    const token = ++searchToken.current;
    setSearching(true);
    setDiscoverSearching(false);

    const handle = setTimeout(async () => {
      try {
        const catalogue = await searchExploreCatalogueOnly(
          searchTerm,
          { catalogue: PAGE_SIZE },
          partFilters()
        );
        if (searchToken.current !== token) return;

        setParts(catalogue);
        setDiscoverParts([]);
        setSearching(false);

        void (async () => {
          const enriched = await enrichExplorePartCardsThumbnails(catalogue);
          if (searchToken.current === token) setParts(enriched);
        })();

        if (!session?.user.id) return;

        setDiscoverSearching(true);
        try {
          const discover = await searchExploreDiscover(searchTerm, catalogue, 24);
          if (searchToken.current === token) setDiscoverParts(discover);
        } finally {
          if (searchToken.current === token) setDiscoverSearching(false);
        }
      } catch {
        if (searchToken.current === token) setSearching(false);
      }
    }, 280);

    return () => clearTimeout(handle);
  }, [searchTerm, session?.user.id, partFilters]);

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

      showAppAlert('Saved', `${label} added to your wishlist.`);
    } catch (err) {
      showAppAlert('Save failed', err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSavingId(null);
    }
  }

  const empty =
    !loading &&
    !searching &&
    parts.length === 0 &&
    discoverParts.length === 0 &&
    !discoverSearching;

  return (
    <View className="flex-1 bg-apple-bg2">
      <ScrollView
        contentContainerClassName="pb-12"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            tintColor={colors.accent}
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
          />
        }
      >
        <View className="px-4 pt-2">
          <Text className="text-sm leading-5 text-apple-secondary">
            Browse parts logged by the community, compare prices, and shop the web — all in one
            place.
          </Text>
          <View className="mt-4">
            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder="Search brand, part name, or SKU…"
              trailing={
                searching ? <ActivityIndicator color={colors.accent} size="small" /> : null
              }
            />
          </View>
        </View>

        <View className="mt-4">
          <PartCategoryFilters category={category} onCategoryChange={setCategory} />
        </View>

        {loading && parts.length === 0 ? (
          <View className="items-center py-16">
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : null}

        {empty ? (
          <View className="mx-4 mt-4">
            <AppleCard padded>
              <Text className="font-semibold text-apple-ink">No parts found</Text>
              <Text className="mt-1 text-sm text-apple-secondary">
                {isSearching
                  ? 'Try another search term or pick a different category.'
                  : 'No catalogue parts in this category yet. Try All types or search above.'}
              </Text>
            </AppleCard>
          </View>
        ) : null}

        {parts.length > 0 ? (
          <View className="mt-4">
            <Text className="mb-2 px-4 text-[13px] font-semibold text-apple-secondary">
              {isSearching ? 'In Wired Build' : 'Popular in community'}
            </Text>
            <View className="gap-2 px-4">
              {parts.map((p) => (
                <PopularPartRow
                  key={p.id}
                  part={p}
                  saving={savingId === p.id}
                  saved={savedPartIds.has(p.id)}
                  onSave={() => void handleSaveToWishlist(p)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {session && isSearching && (discoverSearching || discoverParts.length > 0) ? (
          <View className="mt-6">
            <View className="mb-2 flex-row items-center gap-2 px-4">
              <Text className="text-[13px] font-semibold text-apple-secondary">Shop the web</Text>
              {discoverSearching ? (
                <ActivityIndicator color={colors.accent} size="small" />
              ) : (
                <Ionicons name="globe-outline" size={16} color={colors.secondary} />
              )}
            </View>
            <Text className="mb-2 px-4 text-xs text-apple-tertiary">
              Live shopping results — tap a part to compare stores and buy.
            </Text>
            <View className="gap-2 px-4">
              {discoverParts.map((p) => (
                <PopularPartRow
                  key={p.id}
                  part={p}
                  saving={savingId === p.id}
                  saved={p.product_url ? savedDiscoverUrls.has(p.product_url) : false}
                  onSave={() => void handleSaveToWishlist(p)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {!session && isSearching ? (
          <Text className="mt-6 px-4 text-center text-sm text-apple-secondary">
            Sign in to see live web shopping results.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
