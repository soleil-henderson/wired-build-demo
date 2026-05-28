import { supabase } from './supabase';
import type { Database } from '@/types/database';

export type Mod = Database['public']['Tables']['mods']['Row'];

export type ModWithPart = Mod & {
  part: { brand: string; name: string } | null;
  photo_url: string | null;
};

/**
 * Fetch the reverse-chronological mod timeline for a vehicle (Spec §4.3).
 * Includes the joined part info and the first non-sensitive attached photo
 * so the timeline cards can render a thumbnail without an N+1 query.
 */
export async function listVehicleMods(vehicleId: string): Promise<ModWithPart[]> {
  const { data, error } = await supabase
    .from('mods')
    .select(
      `
      *,
      part:parts ( brand, name ),
      media ( url, kind, is_sensitive )
    `
    )
    .eq('vehicle_id', vehicleId)
    .order('install_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;

  type RawMod = Mod & {
    part: { brand: string; name: string } | null;
    media: { url: string; kind: string; is_sensitive: boolean }[] | null;
  };

  return ((data ?? []) as RawMod[]).map(({ media, ...m }) => ({
    ...m,
    photo_url:
      media?.find((mm) => mm.kind === 'photo' && !mm.is_sensitive)?.url ?? null,
  }));
}
