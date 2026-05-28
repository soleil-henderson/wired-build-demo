import { uploadReceipt } from './storage';
import { supabase } from './supabase';

/** Internal URL convention for private receipt objects (not a fetchable URL). */
export const RECEIPT_URL_PREFIX = 'receipts://';

export function receiptUrlForStorageKey(storageKey: string): string {
  return `${RECEIPT_URL_PREFIX}${storageKey}`;
}

export function storageKeyFromReceiptUrl(url: string): string | null {
  if (!url.startsWith(RECEIPT_URL_PREFIX)) return null;
  return url.slice(RECEIPT_URL_PREFIX.length);
}

export async function getReceiptSignedUrl(
  storageKey: string,
  expiresSec = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from('receipts')
    .createSignedUrl(storageKey, expiresSec);
  if (error) throw error;
  return data.signedUrl;
}

/**
 * Upload a receipt image, create a sensitive `media` row, and link it on
 * the mod via `receipt_media_id`.
 */
export async function attachReceiptToMod(input: {
  modId: string;
  ownerId: string;
  uri: string;
  width?: number | null;
  height?: number | null;
}): Promise<string> {
  const uploaded = await uploadReceipt({
    uri: input.uri,
    ownerId: input.ownerId,
    width: input.width,
    height: input.height,
  });

  const { data: row, error: mediaErr } = await supabase
    .from('media')
    .insert({
      owner_id: input.ownerId,
      mod_id: input.modId,
      url: receiptUrlForStorageKey(uploaded.storage_key),
      storage_key: uploaded.storage_key,
      kind: 'receipt',
      width: uploaded.width,
      height: uploaded.height,
      is_sensitive: true,
    })
    .select('id')
    .single();

  if (mediaErr) throw mediaErr;

  const { error: linkErr } = await supabase
    .from('mods')
    .update({ receipt_media_id: row.id })
    .eq('id', input.modId);

  if (linkErr) throw linkErr;

  return row.id;
}

/** Unlink and delete the receipt media row (owner-only via RLS). */
export async function removeReceiptFromMod(
  modId: string,
  receiptMediaId: string
): Promise<void> {
  const { error: unlinkErr } = await supabase
    .from('mods')
    .update({ receipt_media_id: null })
    .eq('id', modId);
  if (unlinkErr) throw unlinkErr;

  const { error } = await supabase.from('media').delete().eq('id', receiptMediaId);
  if (error) throw error;
}
