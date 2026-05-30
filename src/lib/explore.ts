import { supabase } from './supabase';
import type { Database } from '@/types/database';
import { displayImageUrl } from './image-url';
import { analyzeShoppingOffers, formatPriceRangeLabel } from './product-pricing';
import { searchDiscoverParts, type DiscoverPartResult } from './part-discover';
import type { ModCategory } from '@/types/database';
import { fetchProductShopping } from './product-resolve';
import { parseProductLinks } from './mod-products';
import { fetchModToolsByModIds } from './mod-tools';
import type { FeedAuthor, FeedPost } from './feed';
import { fetchPostMediaByPostIds } from './posts';

export type UserSearchResult = Pick<
  Database['public']['Tables']['users']['Row'],
  | 'id'
  | 'handle'
  | 'display_name'
  | 'avatar_url'
  | 'is_workshop'
  | 'is_identity_verified'
  | 'subscription_tier'
  | 'workshop_name'
  | 'workshop_phone'
>;

export type PartSearchResult = Pick<
  Database['public']['Tables']['parts']['Row'],
  | 'id'
  | 'brand'
  | 'name'
  | 'category'
  | 'install_count'
  | 'is_approved'
  | 'price_min'
  | 'price_max'
  | 'hero_image_url'
>;

/** Popular/search cards with thumbnail and a display price range. */
export type ExplorePartCard = PartSearchResult & {
  source: 'catalogue' | 'discover';
  image_url: string | null;
  price_range: string | null;
  price_from_google: boolean;
  /** Set for discover (Google Shopping) hits — opens product link screen. */
  product_url?: string | null;
  store_label?: string | null;
};

const PART_CARD_SELECT =
  'id, brand, name, category, install_count, is_approved, price_min, price_max, hero_image_url';

export async function searchUsers(
  query: string,
  limit = 6
): Promise<UserSearchResult[]> {
  const term = query.trim();
  if (!term) return [];
  const escaped = term.replace(/[%_]/g, '\\$&');
  const pattern = `%${escaped}%`;
  const { data, error } = await supabase
    .from('users')
    .select(
      'id, handle, display_name, avatar_url, is_workshop, is_identity_verified, subscription_tier, workshop_name, workshop_phone'
    )
    .or(
      `handle.ilike.${pattern},display_name.ilike.${pattern},workshop_name.ilike.${pattern}`
    )
    .limit(limit);
  if (error) return [];
  return data ?? [];
}

export type PartListFilters = {
  category?: ModCategory | null;
};

export type { ExploreSearchMode } from './explore-search-query';
export { parseExploreSearchQuery } from './explore-search-query';

export async function searchPartsForExplore(
  query: string,
  limit = 8,
  filters?: PartListFilters
): Promise<PartSearchResult[]> {
  const term = query.trim();
  if (!term) return [];
  const escaped = term.replace(/[%_]/g, '\\$&');
  const pattern = `%${escaped}%`;
  let q = supabase
    .from('parts')
    .select(PART_CARD_SELECT)
    .eq('is_approved', true)
    .or(`brand.ilike.${pattern},name.ilike.${pattern}`);
  if (filters?.category) {
    q = q.eq('category', filters.category);
  }
  const { data, error } = await q
    .order('install_count', { ascending: false })
    .limit(limit);
  if (error) return [];
  return data ?? [];
}

export async function listPopularParts(
  limit = 12,
  filters?: PartListFilters
): Promise<PartSearchResult[]> {
  let q = supabase.from('parts').select(PART_CARD_SELECT).eq('is_approved', true);
  if (filters?.category) {
    q = q.eq('category', filters.category);
  }
  const { data, error } = await q
    .order('install_count', { ascending: false })
    .order('name')
    .limit(limit);
  if (error) return [];
  return data ?? [];
}

async function fetchPartThumbnailUrls(partIds: string[]): Promise<Map<string, string>> {
  if (partIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('mods')
    .select(
      `
      part_id,
      install_date,
      media!media_mod_id_fkey ( url, thumbnail_url, kind, is_sensitive )
    `
    )
    .in('part_id', partIds)
    .order('install_date', { ascending: false });

  if (error || !data) return new Map();

  const map = new Map<string, string>();
  for (const row of data) {
    const partId = row.part_id as string | null;
    if (!partId || map.has(partId)) continue;
    const media = (row as { media: { url: string; thumbnail_url: string | null; kind: string; is_sensitive: boolean }[] | null }).media ?? [];
    const photo = media.find((m) => !m.is_sensitive && m.kind === 'photo');
    if (!photo) continue;
    const url = displayImageUrl(photo.url, photo.thumbnail_url) ?? photo.url;
    if (url) map.set(partId, url);
  }
  return map;
}

function toExplorePartCard(
  part: PartSearchResult,
  thumbs: Map<string, string>,
  priceRange: string | null,
  priceFromGoogle: boolean
): ExplorePartCard {
  return {
    ...part,
    source: 'catalogue',
    image_url: part.hero_image_url ?? thumbs.get(part.id) ?? null,
    price_range:
      priceRange ?? formatPriceRangeLabel(part.price_min, part.price_max),
    price_from_google: priceFromGoogle,
    product_url: null,
    store_label: null,
  };
}

export type ExplorePartSearchResult = {
  catalogue: ExplorePartCard[];
  discover: ExplorePartCard[];
};

function discoverPartToCard(row: DiscoverPartResult): ExplorePartCard {
  return {
    id: row.id,
    source: 'discover',
    brand: row.brand,
    name: row.name,
    category: 'other' as ModCategory,
    install_count: 0,
    is_approved: false,
    price_min: null,
    price_max: null,
    hero_image_url: null,
    image_url: row.image_url,
    price_range: row.price,
    price_from_google: true,
    product_url: row.product_url,
    store_label: row.source,
  };
}

function dedupeDiscoverAgainstCatalogue(
  catalogue: ExplorePartCard[],
  discoverRows: DiscoverPartResult[]
): ExplorePartCard[] {
  const catalogueKeys = new Set(
    catalogue.map((p) => `${p.brand} ${p.name}`.toLowerCase().replace(/\s+/g, ' '))
  );

  return discoverRows.map(discoverPartToCard).filter((d) => {
    const key = `${d.brand} ${d.name}`.toLowerCase().replace(/\s+/g, ' ');
    if (catalogueKeys.has(key)) return false;
    return ![...catalogueKeys].some(
      (k) => key.includes(k) || k.includes(key)
    );
  });
}

/** Map DB rows to cards using hero_image_url + DB prices only (no mod thumbnail fetch). */
export function catalogueRowsToExploreCards(parts: PartSearchResult[]): ExplorePartCard[] {
  return parts.map((p) => toExplorePartCard(p, new Map(), null, false));
}

/** Fast catalogue-only search for Explore first paint (no Google, no mod thumbnails). */
export async function searchExploreCatalogueOnly(
  query: string,
  limits?: { catalogue: number },
  filters?: PartListFilters
): Promise<ExplorePartCard[]> {
  const term = query.trim();
  if (term.length < 2 || term.startsWith('@')) return [];

  const limit = limits?.catalogue ?? 8;
  const rows = await searchPartsForExplore(term, limit, filters);
  return catalogueRowsToExploreCards(rows);
}

/** Google Shopping hits deduped against catalogue cards. */
export async function searchExploreDiscover(
  query: string,
  catalogue: ExplorePartCard[],
  limit = 10
): Promise<ExplorePartCard[]> {
  const term = query.trim();
  if (term.length < 2 || term.startsWith('@')) return [];

  const discoverRows = await searchDiscoverParts(term, limit).catch(() => []);
  return dedupeDiscoverAgainstCatalogue(catalogue, discoverRows);
}

export type SearchExplorePartsOptions = {
  /** When false, skips Google Shopping (catalogue only). Default true. */
  includeDiscover?: boolean;
  limits?: { catalogue: number; discover: number };
  filters?: PartListFilters;
};

/** Catalogue DB search + optional ephemeral Google Shopping (signed-in only). */
export async function searchExploreParts(
  query: string,
  viewerId: string | null,
  options?: SearchExplorePartsOptions
): Promise<ExplorePartSearchResult> {
  const term = query.trim();
  if (term.length < 2 || term.startsWith('@')) return { catalogue: [], discover: [] };

  const resolvedLimits = options?.limits ?? { catalogue: 8, discover: 10 };
  const includeDiscover = options?.includeDiscover !== false;

  const catalogue = await searchExploreCatalogueOnly(
    term,
    { catalogue: resolvedLimits.catalogue },
    options?.filters
  );

  const discover =
    includeDiscover && viewerId
      ? await searchExploreDiscover(term, catalogue, resolvedLimits.discover)
      : [];

  return { catalogue, discover };
}

/** Popular parts with install photos (DB prices only — fast path for Explore tab). */
export async function listPopularPartsForExplore(
  _viewerId: string | null,
  limit = 12,
  filters?: PartListFilters
): Promise<ExplorePartCard[]> {
  const parts = await listPopularParts(limit, filters);
  if (parts.length === 0) return [];

  const thumbs = await fetchPartThumbnailUrls(parts.map((p) => p.id));
  return parts.map((p) => toExplorePartCard(p, thumbs, null, false));
}

/** Background Google Shopping enrichment for visible popular-part cards. */
export async function enrichPartCardsWithShopping(
  cards: ExplorePartCard[],
  limit = 8
): Promise<ExplorePartCard[]> {
  if (cards.length === 0) return cards;

  const enrichCount = Math.min(cards.length, limit);
  const enriched = await Promise.all(
    cards.slice(0, enrichCount).map(async (card) => {
      try {
        const res = await fetchProductShopping({
          query: `${card.brand} ${card.name}`,
        });
        const analysis = analyzeShoppingOffers(res.shopping);
        if (!analysis) return card;
        return {
          ...card,
          price_range: formatPriceRangeLabel(analysis.min, analysis.max),
          price_from_google: true,
        };
      } catch {
        return card;
      }
    })
  );

  return [...enriched, ...cards.slice(enrichCount)];
}

/** Enrich search hits with thumbnails (catalogue prices only — avoid N Google calls). */
export async function enrichPartSearchResults(
  parts: PartSearchResult[]
): Promise<ExplorePartCard[]> {
  const thumbs = await fetchPartThumbnailUrls(parts.map((p) => p.id));
  return parts.map((p) => toExplorePartCard(p, thumbs, null, false));
}

/** Background install-photo thumbnails for fast catalogue search cards. */
export async function enrichExplorePartCardsThumbnails(
  cards: ExplorePartCard[]
): Promise<ExplorePartCard[]> {
  if (cards.length === 0) return cards;
  const thumbs = await fetchPartThumbnailUrls(cards.map((p) => p.id));
  return cards.map((p) => ({
    ...p,
    image_url: p.hero_image_url ?? thumbs.get(p.id) ?? p.image_url,
  }));
}

/**
 * Trending posts: most-reacted-to public posts in the last `days` days.
 * Reuses the same FeedPost shape as the Feed so we can render it with the
 * same card later if we want.
 */
export type BuildForSale = {
  id: string;
  year: number;
  make: string;
  model: string;
  nickname: string | null;
  cover_photo_url: string | null;
  asking_price: number | null;
};

export async function listBuildsForSale(limit = 12): Promise<BuildForSale[]> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('id, year, make, model, nickname, cover_photo_url, asking_price')
    .eq('is_public', true)
    .eq('is_for_sale', true)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function listTrendingPosts(
  viewerId: string | null,
  days = 30,
  limit = 6
): Promise<FeedPost[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('posts')
    .select(
      `
      id, user_id, body, reaction_count, comment_count, created_at,
      author:users!posts_user_id_fkey (
        id, handle, display_name, avatar_url,
        subscription_tier, is_identity_verified, is_workshop
      ),
      vehicle:vehicles!posts_vehicle_id_fkey ( id, year, make, model, nickname ),
      mod:mods!posts_mod_id_fkey (
        id, category, cost, install_date, custom_part_name, product_links,
        part:parts ( id, brand, name, affiliate_links ),
        media!media_mod_id_fkey ( url, thumbnail_url, kind, is_sensitive )
      )
    `
    )
    .gte('created_at', since)
    .order('reaction_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return [];

  type RawRow = {
    id: string;
    user_id: string;
    body: string | null;
    reaction_count: number;
    comment_count: number;
    created_at: string;
    author: FeedAuthor | null;
    vehicle:
      | {
          id: string;
          year: number;
          make: string;
          model: string;
          nickname: string | null;
        }
      | null;
    mod:
      | {
          id: string;
          category: Database['public']['Tables']['mods']['Row']['category'];
          cost: number | null;
          install_date: string;
          custom_part_name: string | null;
          product_links: unknown;
          part: { id: string; brand: string; name: string; affiliate_links: unknown } | null;
          media: {
            url: string;
            thumbnail_url: string | null;
            kind: string;
            is_sensitive: boolean;
          }[] | null;
        }
      | null;
  };

  const rows = (data ?? []) as RawRow[];
  const postIds = rows.map((r) => r.id);
  const likedSet = viewerId
    ? await fetchLikedPostIds(viewerId, postIds)
    : new Set<string>();

  const mapped = rows
    .filter((r) => r.author && r.vehicle)
    .map((r) => {
      const media = (r.mod?.media ?? [])
        .filter((m) => !m.is_sensitive && (m.kind === 'photo' || m.kind === 'video'))
        .map((m) => ({
          url: displayImageUrl(m.url, m.thumbnail_url) ?? m.url,
          kind: m.kind as 'photo' | 'video',
          thumbnail_url: m.thumbnail_url,
        }))
        .filter((m) => !!m.url);
      const firstPhoto = media.find((m) => m.kind === 'photo');
      return {
        id: r.id,
        user_id: r.user_id,
        body: r.body,
        reaction_count: r.reaction_count,
        comment_count: r.comment_count,
        created_at: r.created_at,
        author: r.author!,
        vehicle: r.vehicle!,
        mod: r.mod
          ? {
              id: r.mod.id,
              category: r.mod.category,
              cost: r.mod.cost,
              install_date: r.mod.install_date,
              custom_part_name: r.mod.custom_part_name,
              part: r.mod.part ?? null,
              photo_url: firstPhoto?.url ?? null,
              media,
              product_links: parseProductLinks(r.mod.product_links),
              tools: [],
            }
          : null,
        post_media: [] as FeedPost['post_media'],
        liked_by_me: likedSet.has(r.id),
      };
    });

  const standaloneIds = mapped.filter((p) => !p.mod).map((p) => p.id);
  const modIds = mapped.filter((p) => p.mod).map((p) => p.mod!.id);
  const [mediaMap, toolsMap] = await Promise.all([
    fetchPostMediaByPostIds(standaloneIds),
    fetchModToolsByModIds(modIds),
  ]);

  return mapped.map((p) => ({
    ...p,
    post_media: p.mod ? [] : (mediaMap.get(p.id) ?? []),
    mod: p.mod ? { ...p.mod, tools: toolsMap.get(p.mod.id) ?? [] } : null,
  }));
}

async function fetchLikedPostIds(
  viewerId: string,
  postIds: string[]
): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from('reactions')
    .select('target_id')
    .eq('user_id', viewerId)
    .eq('target_type', 'post')
    .eq('type', 'like')
    .in('target_id', postIds);
  if (error) return new Set();
  return new Set((data ?? []).map((r) => r.target_id));
}
