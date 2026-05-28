import { File } from 'expo-file-system';

import { supabase } from './supabase';

const MOD_PHOTOS_BUCKET = 'mod-photos';

export type UploadedPhoto = {
  url: string;
  storage_key: string;
  width: number | null;
  height: number | null;
};

function extensionFor(uri: string, mimeType?: string | null): string {
  if (mimeType) {
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
    if (mimeType.includes('png')) return 'png';
    if (mimeType.includes('webp')) return 'webp';
    if (mimeType.includes('heic')) return 'heic';
    if (mimeType.includes('avif')) return 'avif';
  }
  const fromUri = uri.split('?')[0].split('.').pop()?.toLowerCase();
  if (fromUri && fromUri.length <= 5) return fromUri;
  return 'jpg';
}

function mimeFor(ext: string): string {
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
      return 'image/heic';
    case 'avif':
      return 'image/avif';
    default:
      return 'image/jpeg';
  }
}

/**
 * Upload a single mod photo from a local URI (as returned by
 * expo-image-picker) to the public `mod-photos` bucket.
 *
 * Storage key shape: `<ownerId>/<random-uuid>.<ext>` — the leading owner-id
 * segment is what the bucket policies in migration 0005 check against
 * auth.uid().
 */
export async function uploadModPhoto(input: {
  uri: string;
  ownerId: string;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
}): Promise<UploadedPhoto> {
  const ext = extensionFor(input.uri, input.mimeType);
  const contentType = mimeFor(ext);
  const key = `${input.ownerId}/${cryptoRandomId()}.${ext}`;

  const file = new File(input.uri);
  const bytes = await file.arrayBuffer();

  const { error } = await supabase.storage
    .from(MOD_PHOTOS_BUCKET)
    .upload(key, bytes, {
      contentType,
      cacheControl: '31536000',
      upsert: false,
    });

  if (error) throw error;

  const { data: pub } = supabase.storage.from(MOD_PHOTOS_BUCKET).getPublicUrl(key);

  return {
    url: pub.publicUrl,
    storage_key: key,
    width: input.width ?? null,
    height: input.height ?? null,
  };
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
