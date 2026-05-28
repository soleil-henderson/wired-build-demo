import { uploadModPhoto, type UploadedPhoto } from './storage';
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

export type ModPhoto = {
  id: string;
  url: string;
};

export type ModForEdit = ModWithPart & {
  vehicle_id: string;
  photos: ModPhoto[];
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
      media ( id, url, kind, is_sensitive )
    `
    )
    .eq('id', modId)
    .maybeSingle();

  if (error || !data) return null;

  type RawMod = Mod & {
    part: { id: string; brand: string; name: string } | null;
    media: { id: string; url: string; kind: string; is_sensitive: boolean }[] | null;
  };
  const m = data as RawMod;
  const { media, ...rest } = m;

  const photos: ModPhoto[] =
    media
      ?.filter((mm) => mm.kind === 'photo' && !mm.is_sensitive)
      .map((mm) => ({ id: mm.id, url: mm.url })) ?? [];

  return {
    ...rest,
    part: m.part,
    photos,
    photo_url: photos[0]?.url ?? null,
  };
}

/** Remove one attached photo row (owner-only via RLS). */
export async function deleteModMedia(mediaId: string): Promise<void> {
  const { error } = await supabase.from('media').delete().eq('id', mediaId);
  if (error) throw error;
}

/**
 * Upload new photos and link them to an existing mod. Failures on
 * individual uploads are logged but do not abort the batch.
 */
export async function addModPhotos(
  modId: string,
  ownerId: string,
  items: { uri: string; width?: number | null; height?: number | null; mimeType?: string | null }[]
): Promise<void> {
  const uploaded: UploadedPhoto[] = [];
  for (const p of items) {
    try {
      const result = await uploadModPhoto({
        uri: p.uri,
        ownerId,
        mimeType: p.mimeType,
        width: p.width,
        height: p.height,
      });
      uploaded.push(result);
    } catch (err) {
      console.warn('[mods] photo upload failed', err);
    }
  }
  if (uploaded.length === 0) return;

  const { error } = await supabase.from('media').insert(
    uploaded.map((u) => ({
      owner_id: ownerId,
      mod_id: modId,
      url: u.url,
      storage_key: u.storage_key,
      kind: 'photo' as const,
      width: u.width,
      height: u.height,
      is_sensitive: false,
    }))
  );
  if (error) throw error;
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
