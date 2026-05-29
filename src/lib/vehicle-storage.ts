import { storageKeyFromReceiptUrl } from './receipts';
import {
  deleteStorageObjects,
  storageKeyFromModPhotoPublicUrl,
} from './storage';
import { supabase } from './supabase';

export type VehicleStorageKeys = {
  modPhotoKeys: string[];
  receiptKeys: string[];
};

/**
 * Gather storage object keys for a vehicle before it is deleted from the DB.
 * Must run while mod + media rows still exist (mod_id is set null on mod
 * delete, but rows remain until we explicitly remove them).
 */
export async function collectVehicleStorageKeys(
  vehicleId: string
): Promise<VehicleStorageKeys> {
  const modPhotoKeys = new Set<string>();
  const receiptKeys = new Set<string>();

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('cover_photo_url')
    .eq('id', vehicleId)
    .maybeSingle();

  if (vehicle?.cover_photo_url) {
    const key = storageKeyFromModPhotoPublicUrl(vehicle.cover_photo_url);
    if (key) modPhotoKeys.add(key);
  }

  const { data: mods, error: modsErr } = await supabase
    .from('mods')
    .select('id, receipt_media_id')
    .eq('vehicle_id', vehicleId);
  if (modsErr) throw modsErr;

  const modIds = (mods ?? []).map((m) => m.id);
  const receiptMediaIds = (mods ?? [])
    .map((m) => m.receipt_media_id)
    .filter((id): id is string => !!id);

  if (modIds.length > 0) {
    const { data: media, error: mediaErr } = await supabase
      .from('media')
      .select('storage_key, kind, url')
      .in('mod_id', modIds);
    if (mediaErr) throw mediaErr;

    for (const row of media ?? []) {
      addMediaRowToKeys(row, modPhotoKeys, receiptKeys);
    }
  }

  if (receiptMediaIds.length > 0) {
    const { data: receiptRows, error: recErr } = await supabase
      .from('media')
      .select('storage_key, url')
      .in('id', receiptMediaIds);
    if (recErr) throw recErr;
    for (const row of receiptRows ?? []) {
      if (row.storage_key) receiptKeys.add(row.storage_key);
      else {
        const fromUrl = storageKeyFromReceiptUrl(row.url);
        if (fromUrl) receiptKeys.add(fromUrl);
      }
    }
  }

  const { data: docs, error: docsErr } = await supabase
    .from('vehicle_documents')
    .select('storage_key')
    .eq('vehicle_id', vehicleId);
  if (docsErr) throw docsErr;
  for (const doc of docs ?? []) {
    if (doc.storage_key) receiptKeys.add(doc.storage_key);
  }

  return {
    modPhotoKeys: [...modPhotoKeys],
    receiptKeys: [...receiptKeys],
  };
}

const BATCH_SIZE = 50;

async function deleteKeysInBatches(bucket: string, keys: string[]): Promise<void> {
  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    await deleteStorageObjects(bucket, keys.slice(i, i + BATCH_SIZE));
  }
}

/** Remove mod-photo and receipt objects (vehicle delete or single mod delete). */
export async function purgeVehicleStorage(keys: VehicleStorageKeys): Promise<void> {
  await deleteKeysInBatches('mod-photos', keys.modPhotoKeys);
  await deleteKeysInBatches('receipts', keys.receiptKeys);
}

function addMediaRowToKeys(
  row: { storage_key: string; kind: string; url: string },
  modPhotoKeys: Set<string>,
  receiptKeys: Set<string>
): void {
  if (row.kind === 'receipt') {
    if (row.storage_key) receiptKeys.add(row.storage_key);
    else {
      const fromUrl = storageKeyFromReceiptUrl(row.url);
      if (fromUrl) receiptKeys.add(fromUrl);
    }
  } else if (row.kind === 'photo') {
    const key =
      row.storage_key ||
      (row.url ? storageKeyFromModPhotoPublicUrl(row.url) : null);
    if (key) modPhotoKeys.add(key);
  }
}

/** Storage keys for one mod (photos + receipt) before the mod row is deleted. */
export async function collectModStorageKeys(modId: string): Promise<VehicleStorageKeys> {
  const modPhotoKeys = new Set<string>();
  const receiptKeys = new Set<string>();

  const { data: mod, error: modErr } = await supabase
    .from('mods')
    .select('receipt_media_id')
    .eq('id', modId)
    .maybeSingle();
  if (modErr) throw modErr;

  const { data: byModId, error: mediaErr } = await supabase
    .from('media')
    .select('id, storage_key, kind, url')
    .eq('mod_id', modId);
  if (mediaErr) throw mediaErr;

  const seenIds = new Set<string>();
  for (const row of byModId ?? []) {
    seenIds.add(row.id);
    addMediaRowToKeys(row, modPhotoKeys, receiptKeys);
  }

  if (mod?.receipt_media_id && !seenIds.has(mod.receipt_media_id)) {
    const { data: receiptRow } = await supabase
      .from('media')
      .select('storage_key, kind, url')
      .eq('id', mod.receipt_media_id)
      .maybeSingle();
    if (receiptRow) addMediaRowToKeys(receiptRow, modPhotoKeys, receiptKeys);
  }

  return {
    modPhotoKeys: [...modPhotoKeys],
    receiptKeys: [...receiptKeys],
  };
}
