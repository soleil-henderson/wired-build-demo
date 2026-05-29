import { supabase } from './supabase';
import type { Database } from '@/types/database';
import type { FeedAuthor, FeedPost } from './feed';

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
  'id' | 'brand' | 'name' | 'category' | 'install_count' | 'is_approved'
>;

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

export async function searchPartsForExplore(
  query: string,
  limit = 8
): Promise<PartSearchResult[]> {
  const term = query.trim();
  if (!term) return [];
  const escaped = term.replace(/[%_]/g, '\\$&');
  const pattern = `%${escaped}%`;
  const { data, error } = await supabase
    .from('parts')
    .select('id, brand, name, category, install_count, is_approved')
    .eq('is_approved', true)
    .or(`brand.ilike.${pattern},name.ilike.${pattern}`)
    .order('install_count', { ascending: false })
    .limit(limit);
  if (error) return [];
  return data ?? [];
}

export async function listPopularParts(limit = 12): Promise<PartSearchResult[]> {
  const { data, error } = await supabase
    .from('parts')
    .select('id, brand, name, category, install_count, is_approved')
    .eq('is_approved', true)
    .order('install_count', { ascending: false })
    .order('name')
    .limit(limit);
  if (error) return [];
  return data ?? [];
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
      id, body, reaction_count, comment_count, created_at,
      author:users!posts_user_id_fkey (
        id, handle, display_name, avatar_url,
        subscription_tier, is_identity_verified, is_workshop
      ),
      vehicle:vehicles!posts_vehicle_id_fkey ( id, year, make, model, nickname ),
      mod:mods!posts_mod_id_fkey (
        id, category, cost, install_date, custom_part_name,
        part:parts ( id, brand, name ),
        media!media_mod_id_fkey ( url, kind, is_sensitive )
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
          part: { id: string; brand: string; name: string } | null;
          media: { url: string; kind: string; is_sensitive: boolean }[] | null;
        }
      | null;
  };

  const rows = (data ?? []) as RawRow[];
  const postIds = rows.map((r) => r.id);
  const likedSet = viewerId
    ? await fetchLikedPostIds(viewerId, postIds)
    : new Set<string>();

  return rows
    .filter((r) => r.author && r.vehicle)
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
              r.mod.media?.find((m) => m.kind === 'photo' && !m.is_sensitive)?.url ??
              null,
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
