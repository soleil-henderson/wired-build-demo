import {
  collectVehicleStorageKeys,
  purgeVehicleStorage,
} from './vehicle-storage';
import { supabase } from './supabase';
import type { Database } from '@/types/database';

export type VehicleEditRow = Pick<
  Database['public']['Tables']['vehicles']['Row'],
  | 'id'
  | 'nickname'
  | 'cover_photo_url'
  | 'is_public'
  | 'year'
  | 'make'
  | 'model'
  | 'trim'
  | 'vin'
  | 'current_owner_id'
>;

export async function getVehicleForEdit(
  vehicleId: string
): Promise<VehicleEditRow | null> {
  const { data, error } = await supabase
    .from('vehicles')
    .select(
      'id, nickname, cover_photo_url, is_public, year, make, model, trim, vin, current_owner_id'
    )
    .eq('id', vehicleId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type VehicleUpdateInput = {
  nickname: string | null;
  cover_photo_url: string | null;
  is_public: boolean;
};

/**
 * Update editable vehicle fields. RLS restricts to current owner.
 * VIN / year / make / model are immutable after creation.
 */
export async function updateVehicle(
  vehicleId: string,
  input: VehicleUpdateInput
): Promise<void> {
  const { error } = await supabase
    .from('vehicles')
    .update({
      nickname: input.nickname,
      cover_photo_url: input.cover_photo_url,
      is_public: input.is_public,
    })
    .eq('id', vehicleId);
  if (error) throw error;
}

/**
 * Permanently remove a vehicle the caller owns. Cascades delete mods,
 * wishlist rows, posts, and ownership history via FK rules. Best-effort
 * purge of mod-photos + receipts from storage runs after the DB delete.
 */
export async function deleteVehicle(vehicleId: string): Promise<void> {
  const storageKeys = await collectVehicleStorageKeys(vehicleId);

  const { error } = await supabase.from('vehicles').delete().eq('id', vehicleId);
  if (error) throw error;

  await purgeVehicleStorage(storageKeys);
}
