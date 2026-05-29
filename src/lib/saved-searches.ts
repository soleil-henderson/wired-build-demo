import { supabase } from './supabase';

export type SavedSearch = {
  id: string;
  query: string;
  created_at: string;
};

export async function listSavedSearches(userId: string): Promise<SavedSearch[]> {
  const { data, error } = await supabase
    .from('saved_searches')
    .select('id, query, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function saveSearch(userId: string, query: string): Promise<void> {
  const q = query.trim();
  if (!q) return;
  const { error } = await supabase.from('saved_searches').insert({
    user_id: userId,
    query: q,
  });
  if (error) throw error;
}

export async function removeSavedSearch(id: string): Promise<void> {
  const { error } = await supabase.from('saved_searches').delete().eq('id', id);
  if (error) throw error;
}
