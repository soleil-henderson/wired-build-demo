import { supabase } from './supabase';

export type BlockedUser = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  blocked_at: string;
};

export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase.from('user_blocks').insert({
    blocker_id: blockerId,
    blocked_id: blockedId,
  });
  if (error) throw error;
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase
    .from('user_blocks')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);
  if (error) throw error;
}

export async function listBlockedUserIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_blocks')
    .select('blocked_id')
    .eq('blocker_id', userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.blocked_id);
}

export async function listBlockedUsers(userId: string): Promise<BlockedUser[]> {
  const { data, error } = await supabase
    .from('user_blocks')
    .select(
      `
      created_at,
      blocked:users!user_blocks_blocked_id_fkey (
        id, handle, display_name, avatar_url
      )
    `
    )
    .eq('blocker_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const out: BlockedUser[] = [];
  for (const row of data ?? []) {
    const raw = row.blocked;
    const u = Array.isArray(raw) ? raw[0] : raw;
    if (!u?.id || !u.handle) continue;
    out.push({
      id: u.id,
      handle: u.handle,
      display_name: u.display_name,
      avatar_url: u.avatar_url,
      blocked_at: row.created_at,
    });
  }
  return out;
}
