import { supabase } from './supabase';
import type { Database } from '@/types/database';

export type Mod = Database['public']['Tables']['mods']['Row'];

export type ModWithPart = Mod & {
  part: { id: string; brand: string; name: string } | null;
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
      part:parts ( id, brand, name ),
      media ( url, kind, is_sensitive )
    `
    )
    .eq('vehicle_id', vehicleId)
    .order('install_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;

  type RawMod = Mod & {
    part: { id: string; brand: string; name: string } | null;
    media: { url: string; kind: string; is_sensitive: boolean }[] | null;
  };

  return ((data ?? []) as RawMod[]).map(({ media, ...m }) => ({
    ...m,
    photo_url:
      media?.find((mm) => mm.kind === 'photo' && !mm.is_sensitive)?.url ?? null,
  }));
}

export type ModForEdit = ModWithPart & {
  vehicle_id: string;
};

/**
 * Load a single mod for the edit screen. RLS ensures only the vehicle
 * owner can read private mods on their own builds.
 */
export async function getModForEdit(modId: string): Promise<ModForEdit | null> {
  const { data, error } = await supabase
    .from('mods')
    .select(
      `
      *,
      part:parts ( id, brand, name ),
      media ( url, kind, is_sensitive )
    `
    )
    .eq('id', modId)
    .maybeSingle();

  if (error || !data) return null;

  type RawMod = Mod & {
    part: { id: string; brand: string; name: string } | null;
    media: { url: string; kind: string; is_sensitive: boolean }[] | null;
  };
  const m = data as RawMod;
  const { media, ...rest } = m;

  return {
    ...rest,
    part: m.part,
    photo_url:
      media?.find((mm) => mm.kind === 'photo' && !mm.is_sensitive)?.url ?? null,
  };
}

export type ModUpdateInput = {
  category: Database['public']['Tables']['mods']['Row']['category'];
  cost: number | null;
  cost_is_approximate: boolean;
  installer_type: Database['public']['Tables']['mods']['Row']['installer_type'];
  install_date: string;
  date_is_approximate: boolean;
  notes: string | null;
  privacy: Database['public']['Tables']['mods']['Row']['privacy'];
  custom_part_name: string | null;
};

/**
 * Update mod metadata. Part catalogue link is fixed after insert in v1 —
 * only `custom_part_name` is editable when there is no catalogue part.
 * Aggregates (total_spend, install_count) reconcile via the existing trigger.
 */
export async function updateMod(modId: string, input: ModUpdateInput): Promise<void> {
  const { error } = await supabase
    .from('mods')
    .update({
      category: input.category,
      cost: input.cost,
      cost_is_approximate: input.cost_is_approximate,
      installer_type: input.installer_type,
      install_date: input.install_date,
      date_is_approximate: input.date_is_approximate,
      notes: input.notes,
      privacy: input.privacy,
      custom_part_name: input.custom_part_name,
    })
    .eq('id', modId);

  if (error) throw error;
}

/**
 * Remove a mod and its attached media rows. Posts referencing the mod
 * cascade away; vehicle spend / part install_count triggers run on delete.
 */
export async function deleteMod(modId: string): Promise<void> {
  const { error: mediaErr } = await supabase.from('media').delete().eq('mod_id', modId);
  if (mediaErr) throw mediaErr;

  const { error } = await supabase.from('mods').delete().eq('id', modId);
  if (error) throw error;
}
