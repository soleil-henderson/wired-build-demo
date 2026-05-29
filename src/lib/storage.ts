import { prepareImageForUpload, readUploadBytes } from './image-bytes';
import { supabase } from './supabase';

const MOD_PHOTOS_BUCKET = 'mod-photos';
const RECEIPTS_BUCKET = 'receipts';

export type UploadedPhoto = {
  url: string;
  storage_key: string;
  width: number | null;
  height: number | null;
};

export async function uploadModPhoto(input: {
  uri: string;
  ownerId: string;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
}): Promise<UploadedPhoto> {
  const prepared = await prepareImageForUpload({
    uri: input.uri,
    width: input.width,
    height: input.height,
  });

  const key = `${input.ownerId}/${cryptoRandomId()}.jpg`;
  const bytes = await readUploadBytes(prepared.uri);

  const { error } = await supabase.storage
    .from(MOD_PHOTOS_BUCKET)
    .upload(key, bytes, {
      contentType: 'image/jpeg',
      cacheControl: '31536000',
      upsert: false,
    });

  if (error) throw error;

  const { data: pub } = supabase.storage.from(MOD_PHOTOS_BUCKET).getPublicUrl(key);

  return {
    url: pub.publicUrl,
    storage_key: key,
    width: prepared.width,
    height: prepared.height,
  };
}

const AVATAR_MAX_EDGE_PX = 512;

/**
 * Profile avatar — same bucket as mod photos (public CDN), smaller cap.
 * Key: `<ownerId>/avatar-<uuid>.jpg` so a user can rotate avatars without
 * overwriting an in-use mod photo key.
 */
export async function uploadAvatar(input: {
  uri: string;
  ownerId: string;
  width?: number | null;
  height?: number | null;
}): Promise<string> {
  const prepared = await prepareImageForUpload({
    uri: input.uri,
    width: input.width,
    height: input.height,
    maxEdgePx: AVATAR_MAX_EDGE_PX,
  });

  const key = `${input.ownerId}/avatar-${cryptoRandomId()}.jpg`;
  const bytes = await readUploadBytes(prepared.uri);

  const { error } = await supabase.storage
    .from(MOD_PHOTOS_BUCKET)
    .upload(key, bytes, {
      contentType: 'image/jpeg',
      cacheControl: '31536000',
      upsert: false,
    });

  if (error) throw error;

  const { data: pub } = supabase.storage.from(MOD_PHOTOS_BUCKET).getPublicUrl(key);
  return pub.publicUrl;
}

export type UploadedReceipt = {
  storage_key: string;
  width: number;
  height: number;
};

/**
 * Tax-sensitive receipt scan — private `receipts` bucket (Spec §7.1).
 * Same on-device resize + JPEG path as mod photos; never public CDN.
 */
export async function uploadReceipt(input: {
  uri: string;
  ownerId: string;
  width?: number | null;
  height?: number | null;
}): Promise<UploadedReceipt> {
  const prepared = await prepareImageForUpload({
    uri: input.uri,
    width: input.width,
    height: input.height,
  });

  const key = `${input.ownerId}/${cryptoRandomId()}.jpg`;
  const bytes = await readUploadBytes(prepared.uri);

  const { error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .upload(key, bytes, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw error;

  return {
    storage_key: key,
    width: prepared.width,
    height: prepared.height,
  };
}

/**
 * Private file upload (receipts bucket) — PDFs and images for vehicle docs.
 * Key: `<ownerId>/<prefix>-<uuid>.<ext>`
 */
export async function uploadPrivateFile(input: {
  uri: string;
  ownerId: string;
  fileName: string;
  mimeType: string;
  prefix?: string;
}): Promise<string> {
  const ext = extensionForUpload(input.fileName, input.mimeType);
  const prefix = input.prefix ?? 'file';
  const key = `${input.ownerId}/${prefix}-${cryptoRandomId()}.${ext}`;
  const bytes = await readUploadBytes(input.uri);

  if (bytes.byteLength > 10 * 1024 * 1024) {
    throw new Error('File must be 10 MB or smaller.');
  }

  const { error } = await supabase.storage.from(RECEIPTS_BUCKET).upload(key, bytes, {
    contentType: input.mimeType,
    cacheControl: '3600',
    upsert: false,
  });

  if (error) throw error;
  return key;
}

function extensionForUpload(fileName: string, mimeType: string): string {
  const fromName = fileName.split('.').pop()?.toLowerCase();
  if (fromName === 'jpeg') return 'jpg';
  if (fromName && ['pdf', 'jpg', 'png', 'webp', 'heic'].includes(fromName)) {
    return fromName;
  }
  switch (mimeType) {
    case 'application/pdf':
      return 'pdf';
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
      return 'heic';
    default:
      return 'bin';
  }
}

const COVER_MAX_EDGE_PX = 1920;

/**
 * Vehicle cover hero — public CDN, same bucket as mod photos.
 * Key: `<ownerId>/cover-<uuid>.jpg`
 */
export async function uploadCoverPhoto(input: {
  uri: string;
  ownerId: string;
  width?: number | null;
  height?: number | null;
}): Promise<string> {
  const prepared = await prepareImageForUpload({
    uri: input.uri,
    width: input.width,
    height: input.height,
    maxEdgePx: COVER_MAX_EDGE_PX,
  });

  const key = `${input.ownerId}/cover-${cryptoRandomId()}.jpg`;
  const bytes = await readUploadBytes(prepared.uri);

  const { error } = await supabase.storage
    .from(MOD_PHOTOS_BUCKET)
    .upload(key, bytes, {
      contentType: 'image/jpeg',
      cacheControl: '31536000',
      upsert: false,
    });

  if (error) throw error;

  const { data: pub } = supabase.storage.from(MOD_PHOTOS_BUCKET).getPublicUrl(key);
  return pub.publicUrl;
}

/**
 * Extract object path from a public mod-photos CDN URL, if we uploaded it.
 * Returns null for external URLs or unparseable paths.
 */
export function storageKeyFromModPhotoPublicUrl(publicUrl: string): string | null {
  const marker = '/mod-photos/';
  const idx = publicUrl.indexOf(marker);
  if (idx < 0) return null;
  return publicUrl.slice(idx + marker.length).split('?')[0] || null;
}

/** Best-effort delete — storage cleanup should not block DB updates. */
export async function deleteStorageObjects(
  bucket: string,
  storageKeys: string[]
): Promise<void> {
  if (storageKeys.length === 0) return;
  const { error } = await supabase.storage.from(bucket).remove(storageKeys);
  if (error) console.warn(`[storage] delete from ${bucket} failed`, error.message);
}

function cryptoRandomId(): string {
  // expo / RN provides global crypto.randomUUID() on SDK 49+.
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  // Fallback: 16 hex chars from Math.random.
  let out = '';
  for (let i = 0; i < 16; i++) {
    out += Math.floor(Math.random() * 16).toString(16);
  }
  return out;
}
