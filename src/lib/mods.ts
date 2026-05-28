import { supabase } from './supabase';
import type { Database } from '@/types/database';

export type Mod = Database['public']['Tables']['mods']['Row'];

export type ModWithPart = Mod & {
  part: { brand: string; name: string } | null;
};

/**
 * Fetch the reverse-chronological mod timeline for a vehicle (Spec §4.3).
 * Returns mods with their joined part info for display.
 */
export async function listVehicleMods(vehicleId: string): Promise<ModWithPart[]> {
  const { data, error } = await supabase
    .from('mods')
    .select('*, part:parts(brand, name)')
    .eq('vehicle_id', vehicleId)
    .order('install_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as ModWithPart[];
}
