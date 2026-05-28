import { supabase } from './supabase';
import type { Database } from '@/types/database';

export type FeedPost = {
  id: string;
  body: string | null;
  reaction_count: number;
  comment_count: number;
  created_at: string;
  author: {
    id: string;
    handle: string;
    display_name: string;
    avatar_url: string | null;
  };
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
    part: { brand: string; name: string } | null;
    photo_url: string | null;
  } | null;
  liked_by_me: boolean;
};

const PAGE_SIZE = 30;

/**
 * Reverse-chronological feed of recent public posts (Spec §4.4).
 *
 * MVP scope: shows posts from anyone on a public vehicle, newest first.
 * Once `follows` is wired up to a Profile page (next turn), we'll add a
 * `followed-only` mode and the trending slice scoped to the user's make.
 */
export async function listFeed(viewerId: string | null): Promise<FeedPost[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(
      `
      id, body, reaction_count, comment_count, created_at,
      author:users!posts_user_id_fkey ( id, handle, display_name, avatar_url ),
      vehicle:vehicles!posts_vehicle_id_fkey ( id, year, make, model, nickname ),
      mod:mods!posts_mod_id_fkey (
        id, category, cost, install_date, custom_part_name,
        part:parts ( brand, name ),
        media ( url, kind, is_sensitive )
      )
    `
    )
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);

  if (error) throw error;
  const rows = (data ?? []) as RawFeedRow[];

  const postIds = rows.map((r) => r.id);
  const likedSet = viewerId ? await fetchLikedPostIds(viewerId, postIds) : new Set<string>();

  return rows
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
            photo_url:
              r.mod.media?.find((m) => m.kind === 'photo' && !m.is_sensitive)?.url ?? null,
          }
        : null,
      liked_by_me: likedSet.has(r.id),
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
  author:
    | {
        id: string;
        handle: string;
        display_name: string;
        avatar_url: string | null;
      }
    | null;
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
        part: { brand: string; name: string } | null;
        media: { url: string; kind: string; is_sensitive: boolean }[] | null;
      })
    | null;
};
