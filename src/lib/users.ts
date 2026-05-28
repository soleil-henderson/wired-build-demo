import { supabase } from './supabase';
import type { Database } from '@/types/database';

export type UserProfile = Database['public']['Tables']['users']['Row'];
export type VehicleSummary = Pick<
  Database['public']['Tables']['vehicles']['Row'],
  'id' | 'year' | 'make' | 'model' | 'trim' | 'nickname' | 'cover_photo_url' | 'total_spend'
> & {
  mod_count: number;
};

export async function getUserByHandle(handle: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('handle', handle)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function getUserById(id: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return null;
  return data;
}

/**
 * List a user's vehicles that are visible to the current viewer.
 * RLS handles the public-or-own filter; we just ask for everything and
 * the database returns what the viewer is allowed to see.
 */
export async function listUserVehicles(userId: string): Promise<VehicleSummary[]> {
  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select(
      'id, year, make, model, trim, nickname, cover_photo_url, total_spend'
    )
    .eq('current_owner_id', userId)
    .order('created_at', { ascending: false });

  if (error || !vehicles) return [];

  const counts = await Promise.all(
    vehicles.map(async (v) => {
      const { count } = await supabase
        .from('mods')
        .select('id', { count: 'exact', head: true })
        .eq('vehicle_id', v.id);
      return count ?? 0;
    })
  );

  return vehicles.map((v, i) => ({ ...v, mod_count: counts[i] }));
}
