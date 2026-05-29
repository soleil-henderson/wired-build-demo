import { displayImageUrl } from './image-url';
import { listBlockedUserIds } from './blocks';
import { supabase } from './supabase';
import type { Database, SubscriptionTier } from '@/types/database';

export type FeedAuthor = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  subscription_tier: SubscriptionTier;
  is_identity_verified: boolean;
  is_workshop: boolean;
};

export type FeedPost = {
  id: string;
  body: string | null;
  reaction_count: number;
  comment_count: number;
  created_at: string;
  author: FeedAuthor;
  vehicle: {
    id: string;
    year: number;
    make: string;
    model: string;
    nickname: string | null;
  };
  mod: {
    id: string;
    category: Database['public']['Tables']['mods']['Row']['category'];
    cost: number | null;
    install_date: string;
    custom_part_name: string | null;
    part: { id: string; brand: string; name: string } | null;
    photo_url: string | null;
  } | null;
  liked_by_me: boolean;
};

export const FEED_PAGE_SIZE = 20;

export type FeedMode = 'all' | 'following' | 'my-make';

export type FeedPage = {
  posts: FeedPost[];
  /**
   * Pass this back into the next `listFeed` call to get the following
   * page. `null` means we've reached the end.
   */
  nextCursor: string | null;
};

/**
 * Reverse-chronological feed of recent public posts (Spec §4.4).
 *
 * - mode='all'        Posts from anyone whose vehicle is public.
 * - mode='following'  Only posts authored by users the viewer follows.
 *   If the viewer has no follows yet, returns an empty page.
 * - mode='my-make'    Only posts whose vehicle.make matches one of the
 *   viewer's own garage makes. If the viewer has no vehicles yet,
 *   returns an empty page. Uses a `!inner` join + foreign-table filter
 *   so we don't have to round-trip vehicle ids.
 *
 * Pagination is keyset on `created_at` — we ask for rows strictly older
 * than the cursor and return the oldest one in the page as the next
 * cursor. Keyset is stable under new inserts (unlike offset), which is
 * critical when fresh mods land in the feed every few seconds.
 */
export async function listFeed(
  viewerId: string | null,
  mode: FeedMode = 'all',
  cursor: string | null = null
): Promise<FeedPage> {
  // `!inner` is a no-op for the existing modes (posts.vehicle_id is NOT
  // NULL) but is required for `my-make` so the foreign-table filter on
  // vehicle.make actually restricts the parent set.
  let query = supabase
    .from('posts')
    .select(
      `
      id, body, reaction_count, comment_count, created_at,
      author:users!posts_user_id_fkey (
        id, handle, display_name, avatar_url,
        subscription_tier, is_identity_verified, is_workshop
      ),
      vehicle:vehicles!posts_vehicle_id_fkey!inner ( id, year, make, model, nickname ),
      mod:mods!posts_mod_id_fkey (
        id, category, cost, install_date, custom_part_name,
        part:parts ( id, brand, name ),
        media!media_mod_id_fkey ( url, thumbnail_url, kind, is_sensitive )
      )
    `
    )
    .order('created_at', { ascending: false })
    .limit(FEED_PAGE_SIZE);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  if (viewerId) {
    const blockedIds = await listBlockedUserIds(viewerId);
    if (blockedIds.length > 0) {
      query = query.not('user_id', 'in', `(${blockedIds.join(',')})`);
    }
  }

  if (mode === 'following') {
    if (!viewerId) return { posts: [], nextCursor: null };
    const followeeIds = await fetchFolloweeIds(viewerId);
    if (followeeIds.length === 0) return { posts: [], nextCursor: null };
    query = query.in('user_id', followeeIds);
  } else if (mode === 'my-make') {
    if (!viewerId) return { posts: [], nextCursor: null };
    const makes = await fetchViewerMakes(viewerId);
    if (makes.length === 0) return { posts: [], nextCursor: null };
    // Foreign-table filter via the embedded path. supabase-js threads
    // this through as `vehicles.make=in.(...)` in the request, which
    // PostgREST applies as part of the inner join.
    query = query.in('vehicles.make', makes);
  }

  const { data, error } = await query;

  if (error) throw error;
  const rows = (data ?? []) as RawFeedRow[];

  const postIds = rows.map((r) => r.id);
  const likedSet = viewerId ? await fetchLikedPostIds(viewerId, postIds) : new Set<string>();

  const posts = rows
    .filter((r) => r.author && r.vehicle) // RLS should already guarantee these
    .map((r) => ({
      id: r.id,
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
            photo_url: (() => {
              const m = r.mod.media?.find((mm) => mm.kind === 'photo' && !mm.is_sensitive);
              return displayImageUrl(m?.url ?? null, m?.thumbnail_url ?? null);
            })(),
          }
        : null,
      liked_by_me: likedSet.has(r.id),
    }));

  // A short page means we've hit the end. Otherwise the last item's
  // timestamp is the cursor for the next request.
  const nextCursor =
    rows.length === FEED_PAGE_SIZE && posts.length > 0
      ? posts[posts.length - 1].created_at
      : null;

  return { posts, nextCursor };
}

/**
 * Fetch a single post with the same shape as the feed. Used by the post
 * detail screen.
 */
export async function getPost(
  postId: string,
  viewerId: string | null
): Promise<FeedPost | null> {
  const { data, error } = await supabase
    .from('posts')
    .select(
      `
      id, body, reaction_count, comment_count, created_at,
      author:users!posts_user_id_fkey (
        id, handle, display_name, avatar_url,
        subscription_tier, is_identity_verified, is_workshop
      ),
      vehicle:vehicles!posts_vehicle_id_fkey ( id, year, make, model, nickname ),
      mod:mods!posts_mod_id_fkey (
        id, category, cost, install_date, custom_part_name,
        part:parts ( id, brand, name ),
        media!media_mod_id_fkey ( url, thumbnail_url, kind, is_sensitive )
      )
    `
    )
    .eq('id', postId)
    .maybeSingle();

  if (error || !data) return null;
  const r = data as RawFeedRow;
  if (!r.author || !r.vehicle) return null;

  const likedSet = viewerId ? await fetchLikedPostIds(viewerId, [r.id]) : new Set<string>();

  return {
    id: r.id,
    body: r.body,
    reaction_count: r.reaction_count,
    comment_count: r.comment_count,
    created_at: r.created_at,
    author: r.author,
    vehicle: r.vehicle,
    mod: r.mod
      ? {
          id: r.mod.id,
          category: r.mod.category,
          cost: r.mod.cost,
          install_date: r.mod.install_date,
          custom_part_name: r.mod.custom_part_name,
          part: r.mod.part ?? null,
          photo_url: (() => {
            const m = r.mod.media?.find((mm) => mm.kind === 'photo' && !mm.is_sensitive);
            return displayImageUrl(m?.url ?? null, m?.thumbnail_url ?? null);
          })(),
        }
      : null,
    liked_by_me: likedSet.has(r.id),
  };
}

async function fetchFolloweeIds(viewerId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('followee_id')
    .eq('follower_id', viewerId);
  if (error) return [];
  return (data ?? []).map((r) => r.followee_id);
}

/**
 * Distinct makes from the viewer's own garage. Used to scope the feed to
 * "vehicles like mine" — a 4WD owner mostly cares about other 4WDs of the
 * same platform.
 */
async function fetchViewerMakes(viewerId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('make')
    .eq('current_owner_id', viewerId);
  if (error || !data) return [];
  const set = new Set<string>();
  for (const row of data) {
    if (row.make) set.add(row.make);
  }
  return [...set];
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

/**
 * Optimistic-friendly like/unlike. Returns the new like state.
 * The reactions trigger keeps posts.reaction_count in sync server-side.
 */
export async function togglePostLike(
  postId: string,
  viewerId: string,
  currentlyLiked: boolean
): Promise<boolean> {
  if (currentlyLiked) {
    const { error } = await supabase
      .from('reactions')
      .delete()
      .eq('user_id', viewerId)
      .eq('target_type', 'post')
      .eq('target_id', postId)
      .eq('type', 'like');
    if (error) throw error;
    return false;
  }
  const { error } = await supabase.from('reactions').insert({
    user_id: viewerId,
    target_type: 'post',
    target_id: postId,
    type: 'like',
  });
  if (error && error.code !== '23505') {
    // 23505 = unique violation = we already liked it. Treat as success.
    throw error;
  }
  return true;
}

// Internal row shape from the join. PostgREST returns FK-joins as
// arrays-or-objects depending on cardinality; we declare both to be safe.
type RawFeedRow = {
  id: string;
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
    | ({
        id: string;
        category: Database['public']['Tables']['mods']['Row']['category'];
        cost: number | null;
        install_date: string;
        custom_part_name: string | null;
        part: { id: string; brand: string; name: string } | null;
        media: {
          url: string;
          thumbnail_url: string | null;
          kind: string;
          is_sensitive: boolean;
        }[] | null;
      })
    | null;
};
