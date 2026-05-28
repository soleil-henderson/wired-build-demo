import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { supabase } from './supabase';

const MOD_PHOTOS_BUCKET = 'mod-photos';

/**
 * Cap on the longer edge of an uploaded photo. 1920px is plenty for feed
 * cards and the build-profile hero; anything bigger is wasted bandwidth.
 */
const MAX_EDGE_PX = 1920;

/**
 * JPEG quality for re-encoded uploads. 0.85 is the visual sweet spot —
 * indistinguishable from source on mod-photo content, ~5-10x smaller
 * than the iPhone HEIC original.
 */
const JPEG_QUALITY = 0.85;

export type UploadedPhoto = {
  url: string;
  storage_key: string;
  width: number | null;
  height: number | null;
};

/**
 * Resize + recompress on-device before upload.
 *
 * Why: iPhones produce 4-8MB HEIC files per shot. Uploading raw was
 * killing the Log-a-Mod UX over LTE, and the originals contain EXIF
 * with GPS coords we don't want to leak. Re-encoding through
 * expo-image-manipulator strips EXIF as a side effect.
 *
 * We only downscale when the longer edge exceeds MAX_EDGE_PX; smaller
 * inputs get re-encoded in place. Format is normalised to JPEG so the
 * CDN doesn't have to negotiate HEIC support, and the storage key
 * always ends in `.jpg`.
 */
async function prepareImageForUpload(input: {
  uri: string;
  width?: number | null;
  height?: number | null;
}): Promise<{ uri: string; width: number; height: number }> {
  const ctx = ImageManipulator.manipulate(input.uri);

  const w = input.width ?? 0;
  const h = input.height ?? 0;
  const longest = Math.max(w, h);
  if (longest > MAX_EDGE_PX) {
    if (w >= h) {
      ctx.resize({ width: MAX_EDGE_PX });
    } else {
      ctx.resize({ height: MAX_EDGE_PX });
    }
  }

  const img = await ctx.renderAsync();
  const result = await img.saveAsync({
    format: SaveFormat.JPEG,
    compress: JPEG_QUALITY,
  });

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
  };
}

/**
 * Upload a single mod photo from a local URI (as returned by
 * expo-image-picker) to the public `mod-photos` bucket. The image is
 * resized + recompressed to JPEG on-device before the network call —
 * see prepareImageForUpload() for the why.
 *
 * Storage key shape: `<ownerId>/<random-uuid>.jpg` — the leading owner-id
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
  const prepared = await prepareImageForUpload({
    uri: input.uri,
    width: input.width,
    height: input.height,
  });

  const key = `${input.ownerId}/${cryptoRandomId()}.jpg`;
  const file = new File(prepared.uri);
  const bytes = await file.arrayBuffer();

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
