import { supabase } from './supabase';

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

export async function toggleFollow(
  followerId: string,
  followeeId: string,
  currentlyFollowing: boolean
): Promise<boolean> {
  if (followerId === followeeId) {
    throw new Error("Can't follow yourself");
  }
  if (currentlyFollowing) {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('followee_id', followeeId);
    if (error) throw error;
    return false;
  }
  const { error } = await supabase.from('follows').insert({
    follower_id: followerId,
    followee_id: followeeId,
  });
  if (error && error.code !== '23505') throw error; // ignore "already follows"
  return true;
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
