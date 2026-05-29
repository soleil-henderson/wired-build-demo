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
  | 'is_for_sale'
  | 'asking_price'
  | 'manual_build_value'
  | 'manual_build_value_note'
  | 'build_value'
  | 'valuation_source'
>;

export async function getVehicleForEdit(
  vehicleId: string
): Promise<VehicleEditRow | null> {
  const { data, error } = await supabase
    .from('vehicles')
    .select(
      'id, nickname, cover_photo_url, is_public, is_for_sale, asking_price, year, make, model, trim, vin, current_owner_id, manual_build_value, manual_build_value_note, build_value, valuation_source'
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
  is_for_sale: boolean;
  asking_price: number | null;
  manual_build_value: number | null;
  manual_build_value_note: string | null;
};

/**
 * Update editable vehicle fields. RLS restricts to current owner.
 * VIN / year / make / model are immutable after creation.
 */
export async function updateVehicle(
  vehicleId: string,
  input: VehicleUpdateInput
): Promise<void> {
  const { data, error } = await supabase
    .from('vehicles')
    .update({
      nickname: input.nickname,
      cover_photo_url: input.cover_photo_url,
      is_public: input.is_public,
      is_for_sale: input.is_for_sale,
      asking_price: input.asking_price,
      manual_build_value: input.manual_build_value,
      manual_build_value_note: input.manual_build_value_note,
      manual_build_value_at:
        input.manual_build_value != null && input.manual_build_value > 0
          ? new Date().toISOString()
          : null,
    })
    .eq('id', vehicleId)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error(
      'Could not save changes. Sign in again or confirm you still own this build.'
    );
  }

  const { error: recalcError } = await supabase.rpc('recalc_vehicle_total_spend', {
    p_vehicle_id: vehicleId,
  });
  if (recalcError) {
    console.warn('[vehicles] recalc_vehicle_total_spend failed', recalcError.message);
  }
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
