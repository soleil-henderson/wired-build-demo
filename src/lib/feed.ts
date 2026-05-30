import { displayImageUrl } from './image-url';
import { listBlockedUserIds } from './blocks';
import { deleteMod } from './mods';
import { parseProductLinks, type ModProductLinks } from './mod-products';
import type { ModToolSummary } from './mod-tools';
import { fetchModToolsByModIds } from './mod-tools';
import { purgePostMedia, fetchPostMediaByPostIds } from './posts';
import { supabase } from './supabase';
import type { Database, SubscriptionTier } from '@/types/database';
import type { CarouselMedia } from '@/components/ui/MediaCarousel';

export type FeedAuthor = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  subscription_tier: SubscriptionTier;
  is_identity_verified: boolean;
  is_workshop: boolean;
};

export type FeedModTool = ModToolSummary;

export type FeedMod = {
  id: string;
  category: Database['public']['Tables']['mods']['Row']['category'];
  cost: number | null;
  install_date: string;
  custom_part_name: string | null;
  part: { id: string; brand: string; name: string; affiliate_links: unknown } | null;
  photo_url: string | null;
  media: CarouselMedia[];
  product_links: ModProductLinks | null;
  tools: FeedModTool[];
};

export type FeedPost = {
  id: string;
  user_id: string;
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
  mod: FeedMod | null;
  post_media: CarouselMedia[];
  liked_by_me: boolean;
};

export const FEED_PAGE_SIZE = 20;

export type FeedMode = 'all' | 'following' | 'my-make';

export type FeedPage = {
  posts: FeedPost[];
  nextCursor: string | null;
};

const POST_SELECT = `
  id, user_id, body, reaction_count, comment_count, created_at,
  author:users!posts_user_id_fkey (
    id, handle, display_name, avatar_url,
    subscription_tier, is_identity_verified, is_workshop
  ),
  vehicle:vehicles!posts_vehicle_id_fkey!inner ( id, year, make, model, nickname ),
  mod:mods!posts_mod_id_fkey (
    id, category, cost, install_date, custom_part_name, product_links,
        part:parts ( id, brand, name, affiliate_links ),
    media!media_mod_id_fkey ( url, thumbnail_url, kind, is_sensitive )
  )
`;

export async function listFeed(
  viewerId: string | null,
  mode: FeedMode = 'all',
  cursor: string | null = null
): Promise<FeedPage> {
  let query = supabase
    .from('posts')
    .select(POST_SELECT)
    .order('created_at', { ascending: false })
    .limit(FEED_PAGE_SIZE);

  if (cursor) query = query.lt('created_at', cursor);

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
    query = query.in('vehicles.make', makes);
  }

  const { data, error } = await query;
  if (error) throw error;
  return pageFromRows((data ?? []) as RawFeedRow[], viewerId);
}

export async function listUserPosts(
  userId: string,
  viewerId: string | null,
  limit = 48
): Promise<FeedPost[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  const rows = (data ?? []) as RawFeedRow[];
  const postIds = rows.map((r) => r.id);
  const likedSet = viewerId ? await fetchLikedPostIds(viewerId, postIds) : new Set<string>();

  const mapped = rows
    .filter((r) => r.author && r.vehicle)
    .map((r) => mapFeedPost(r, likedSet.has(r.id)));

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

export async function getPost(
  postId: string,
  viewerId: string | null
): Promise<FeedPost | null> {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .eq('id', postId)
    .maybeSingle();

  if (error || !data) return null;
  const r = data as RawFeedRow;
  if (!r.author || !r.vehicle) return null;

  const likedSet = viewerId ? await fetchLikedPostIds(viewerId, [r.id]) : new Set<string>();
  const post = mapFeedPost(r, likedSet.has(r.id));

  if (!post.mod) {
    const mediaMap = await fetchPostMediaByPostIds([post.id]);
    return {
      ...post,
      post_media: mediaMap.get(post.id) ?? [],
    };
  }

  const toolsMap = await fetchModToolsByModIds([post.mod.id]);
  return {
    ...post,
    post_media: [],
    mod: { ...post.mod, tools: toolsMap.get(post.mod.id) ?? [] },
  };
}

export type PostUpdateInput = {
  body: string | null;
};

/** Update editable post fields. RLS restricts to the post author. */
export async function updatePost(postId: string, input: PostUpdateInput): Promise<void> {
  const { data, error } = await supabase
    .from('posts')
    .update({ body: input.body?.trim() || null })
    .eq('id', postId)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error(
      'Could not save post. Sign in again or confirm you own this post.'
    );
  }
}

/** Feed post created by DB trigger when a mod is public. */
export async function getPostIdForMod(modId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('posts')
    .select('id')
    .eq('mod_id', modId)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export async function deletePost(postId: string): Promise<void> {
  const { data: post, error: fetchErr } = await supabase
    .from('posts')
    .select('mod_id')
    .eq('id', postId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;

  if (post?.mod_id) {
    await deleteMod(post.mod_id);
    return;
  }

  await purgePostMedia(postId);

  const { error } = await supabase.from('posts').delete().eq('id', postId);
  if (error) throw error;
}

/** Standalone photo/video post — not tied to a logged mod. */
export function isModPost(post: FeedPost): boolean {
  return post.mod != null;
}

/** Photos/videos to show in the feed — mod media or standalone post media. */
export function resolvePostDisplayMedia(post: FeedPost): CarouselMedia[] {
  if (post.mod?.media?.length) return post.mod.media;
  if (post.mod?.photo_url) {
    return [{ url: post.mod.photo_url, kind: 'photo' as const }];
  }
  return post.post_media ?? [];
}

async function pageFromRows(
  rows: RawFeedRow[],
  viewerId: string | null
): Promise<FeedPage> {
  const postIds = rows.map((r) => r.id);
  const likedSet = viewerId ? await fetchLikedPostIds(viewerId, postIds) : new Set<string>();

  const mapped = rows
    .filter((r) => r.author && r.vehicle)
    .map((r) => mapFeedPost(r, likedSet.has(r.id)));

  const standaloneIds = mapped.filter((p) => !p.mod).map((p) => p.id);
  const modIds = mapped.filter((p) => p.mod).map((p) => p.mod!.id);
  const [mediaMap, toolsMap] = await Promise.all([
    fetchPostMediaByPostIds(standaloneIds),
    fetchModToolsByModIds(modIds),
  ]);

  const posts = mapped.map((p) => ({
    ...p,
    post_media: p.mod ? [] : (mediaMap.get(p.id) ?? []),
    mod: p.mod
      ? { ...p.mod, tools: toolsMap.get(p.mod.id) ?? [] }
      : null,
  }));

  const nextCursor =
    rows.length === FEED_PAGE_SIZE && posts.length > 0
      ? posts[posts.length - 1].created_at
      : null;

  return { posts, nextCursor };
}

function mapFeedPost(r: RawFeedRow, liked: boolean): FeedPost {
  const mod = r.mod ? mapMod(r.mod) : null;
  return {
    id: r.id,
    user_id: r.user_id,
    body: r.body,
    reaction_count: r.reaction_count,
    comment_count: r.comment_count,
    created_at: r.created_at,
    author: r.author!,
    vehicle: r.vehicle!,
    mod,
    post_media: [],
    liked_by_me: liked,
  };
}

function mapMod(raw: NonNullable<RawFeedRow['mod']>): FeedMod {
  const media = mapModMedia(raw.media);
  const firstPhoto = media.find((m) => m.kind === 'photo');
  return {
    id: raw.id,
    category: raw.category,
    cost: raw.cost,
    install_date: raw.install_date,
    custom_part_name: raw.custom_part_name,
    part: raw.part ?? null,
    photo_url: firstPhoto?.url ?? null,
    media,
    product_links: parseProductLinks(raw.product_links),
    tools: [],
  };
}

function mapModMedia(
  media: NonNullable<NonNullable<RawFeedRow['mod']>['media']> | null
): CarouselMedia[] {
  return (media ?? [])
    .filter((m) => !m.is_sensitive && (m.kind === 'photo' || m.kind === 'video'))
    .map((m) => ({
      url: displayImageUrl(m.url, m.thumbnail_url) ?? m.url,
      kind: m.kind as 'photo' | 'video',
      thumbnail_url: m.thumbnail_url,
    }))
    .filter((m) => !!m.url);
}

async function fetchFolloweeIds(viewerId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('followee_id')
    .eq('follower_id', viewerId);
  if (error) return [];
  return (data ?? []).map((r) => r.followee_id);
}

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
  if (error && error.code !== '23505') throw error;
  return true;
}

type RawFeedRow = {
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
    | ({
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
      })
    | null;
};
