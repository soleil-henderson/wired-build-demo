import { supabase } from './supabase';
import type { SubscriptionTier } from '@/types/database';

export type FollowStatus = 'none' | 'following' | 'requested';

export async function isFollowing(
  followerId: string,
  followeeId: string
): Promise<boolean> {
  if (followerId === followeeId) return false;
  const { count, error } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', followerId)
    .eq('followee_id', followeeId);
  if (error) return false;
  return (count ?? 0) > 0;
}

export async function hasPendingFollowRequest(
  requesterId: string,
  targetId: string
): Promise<boolean> {
  if (requesterId === targetId) return false;
  const { count, error } = await supabase
    .from('follow_requests')
    .select('*', { count: 'exact', head: true })
    .eq('requester_id', requesterId)
    .eq('target_id', targetId);
  if (error) return false;
  return (count ?? 0) > 0;
}

export async function getFollowStatus(
  viewerId: string,
  targetId: string
): Promise<FollowStatus> {
  if (viewerId === targetId) return 'none';
  if (await isFollowing(viewerId, targetId)) return 'following';
  if (await hasPendingFollowRequest(viewerId, targetId)) return 'requested';
  return 'none';
}

/** Follow, unfollow, request, or cancel a pending request (via server RPC). */
export async function toggleFollowStatus(
  followerId: string,
  followeeId: string
): Promise<FollowStatus> {
  if (followerId === followeeId) {
    throw new Error("Can't follow yourself");
  }

  const { data, error } = await supabase.rpc('toggle_follow', {
    p_target_id: followeeId,
  });
  if (error) throw error;

  const status = (data as { status?: FollowStatus } | null)?.status;
  if (status === 'following' || status === 'requested' || status === 'none') {
    return status;
  }
  throw new Error('Unexpected follow response');
}

/** @deprecated Use toggleFollowStatus */
export async function toggleFollow(
  followerId: string,
  followeeId: string,
  currentlyFollowing: boolean
): Promise<boolean> {
  const status = await toggleFollowStatus(followerId, followeeId);
  return status === 'following';
}

export async function acceptFollowRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('accept_follow_request', {
    p_request_id: requestId,
  });
  if (error) throw error;
}

export async function declineFollowRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('decline_follow_request', {
    p_request_id: requestId,
  });
  if (error) throw error;
}

export type FollowCounts = {
  followers: number;
  following: number;
};

export async function getFollowCounts(userId: string): Promise<FollowCounts> {
  const [{ count: followers }, { count: following }] = await Promise.all([
    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('followee_id', userId),
    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId),
  ]);
  return {
    followers: followers ?? 0,
    following: following ?? 0,
  };
}

export type FollowUser = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  subscription_tier: SubscriptionTier;
  is_identity_verified: boolean;
  is_workshop: boolean;
};

export async function listFollowers(userId: string): Promise<FollowUser[]> {
  const { data, error } = await supabase
    .from('follows')
    .select(
      `
      follower:users!follows_follower_id_fkey (
        id, handle, display_name, avatar_url,
        subscription_tier, is_identity_verified, is_workshop
      )
    `
    )
    .eq('followee_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return mapFollowUsers(data ?? [], 'follower');
}

export async function listFollowing(userId: string): Promise<FollowUser[]> {
  const { data, error } = await supabase
    .from('follows')
    .select(
      `
      followee:users!follows_followee_id_fkey (
        id, handle, display_name, avatar_url,
        subscription_tier, is_identity_verified, is_workshop
      )
    `
    )
    .eq('follower_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return mapFollowUsers(data ?? [], 'followee');
}

function mapFollowUsers(
  rows: Record<string, FollowUser | FollowUser[] | null>[],
  key: 'follower' | 'followee'
): FollowUser[] {
  const out: FollowUser[] = [];
  for (const row of rows) {
    const u = row[key];
    const user = Array.isArray(u) ? u[0] : u;
    if (user?.handle) out.push(user);
  }
  return out;
}
