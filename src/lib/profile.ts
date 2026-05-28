import { supabase } from './supabase';
import type { Database } from '@/types/database';

export type UserProfileRow = Database['public']['Tables']['users']['Row'];

/** Matches `users_handle_format` in the schema. */
export const HANDLE_PATTERN = /^[a-z0-9_]{3,30}$/;

export function normalizeHandle(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

export function validateHandle(handle: string): string | null {
  if (!HANDLE_PATTERN.test(handle)) {
    return 'Handle must be 3–30 characters: lowercase letters, numbers, underscores only.';
  }
  return null;
}

export async function getMyProfile(userId: string): Promise<UserProfileRow | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type ProfileUpdateInput = {
  handle: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
};

/**
 * Update the signed-in user's public profile fields. RLS restricts this
 * to `auth.uid() = id`. Handle uniqueness is enforced by the DB — we map
 * `23505` to a friendly message.
 */
export async function updateProfile(
  userId: string,
  input: ProfileUpdateInput
): Promise<UserProfileRow> {
  const handle = normalizeHandle(input.handle);
  const handleErr = validateHandle(handle);
  if (handleErr) throw new Error(handleErr);

  const displayName = input.display_name.trim();
  if (!displayName) throw new Error('Display name is required.');

  const { data, error } = await supabase
    .from('users')
    .update({
      handle,
      display_name: displayName,
      bio: input.bio?.trim() || null,
      avatar_url: input.avatar_url,
    })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('That handle is already taken. Try another.');
    }
    throw error;
  }

  return data;
}
