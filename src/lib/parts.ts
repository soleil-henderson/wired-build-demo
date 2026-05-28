import { supabase } from './supabase';
import type { Database, ModCategory } from '@/types/database';

export type Part = Database['public']['Tables']['parts']['Row'];

/**
 * Live autocomplete against the parts catalogue (Spec §4.1 step 2).
 * Searches approved parts where brand or name matches a fuzzy query.
 */
export async function searchParts(query: string, limit = 12): Promise<Part[]> {
  const term = query.trim();
  if (!term) return [];

  const escaped = term.replace(/[%_]/g, '\\$&');
  const pattern = `%${escaped}%`;

  const { data, error } = await supabase
    .from('parts')
    .select('*')
    .eq('is_approved', true)
    .or(`brand.ilike.${pattern},name.ilike.${pattern}`)
    .order('install_count', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

/**
 * Fetch one part by id. Used to pre-fill the Log-a-Mod form when promoting a
 * wishlist row to a mod.
 */
export async function getPartById(id: string): Promise<Part | null> {
  const { data, error } = await supabase
    .from('parts')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return null;
  return data;
}

/**
 * "Custom part not listed" (Spec §4.1 edge case).
 * Inserts a community-submitted part as is_approved=false so it lands in the
 * moderation queue. Returns the inserted row so the caller can link the mod to it.
 */
export async function submitCustomPart(input: {
  brand: string;
  name: string;
  category: ModCategory;
}): Promise<Part> {
  const { data, error } = await supabase
    .from('parts')
    .insert({
      brand: input.brand.trim(),
      name: input.name.trim(),
      category: input.category,
      source: 'community',
      is_approved: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
