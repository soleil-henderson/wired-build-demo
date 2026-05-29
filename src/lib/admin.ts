import { supabase } from './supabase';
import type { Part } from './parts';

export async function isCurrentUserAdmin(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle();
  return !!data?.is_admin;
}

export async function listPendingParts(): Promise<Part[]> {
  const { data, error } = await supabase
    .from('parts')
    .select('*')
    .eq('source', 'community')
    .eq('is_approved', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function approvePart(partId: string): Promise<void> {
  const { error } = await supabase
    .from('parts')
    .update({ is_approved: true })
    .eq('id', partId);
  if (error) throw error;
}

export async function updatePartAffiliate(
  partId: string,
  affiliate: { url: string; label: string }
): Promise<void> {
  const { error } = await supabase
    .from('parts')
    .update({ affiliate_links: affiliate })
    .eq('id', partId);
  if (error) throw error;
}
