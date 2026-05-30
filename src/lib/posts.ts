import type { CarouselMedia } from '@/components/ui/MediaCarousel';
import { displayImageUrl } from './image-url';
import { thumbnailUrlForPublicUrl } from './image-url';
import { deleteStorageObjects, uploadModPhoto, uploadModVideo } from './storage';
import { supabase } from './supabase';

const MOD_PHOTOS_BUCKET = 'mod-photos';

export type PendingPostMedia = {
  uri: string;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  kind: 'photo' | 'video';
};

export async function createStandalonePost(input: {
  userId: string;
  vehicleId: string;
  body: string | null;
  media: PendingPostMedia[];
}): Promise<string> {
  if (input.media.length === 0) {
    throw new Error('Add at least one photo or video.');
  }

  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      user_id: input.userId,
      vehicle_id: input.vehicleId,
      mod_id: null,
      body: input.body?.trim() || null,
    })
    .select('id')
    .single();

  if (error) throw error;

  try {
    await attachPostMedia(post.id, input.userId, input.media);
  } catch (err) {
    await supabase.from('posts').delete().eq('id', post.id);
    throw err;
  }

  return post.id;
}

export async function attachPostMedia(
  postId: string,
  ownerId: string,
  items: PendingPostMedia[]
): Promise<void> {
  const rows: {
    owner_id: string;
    post_id: string;
    url: string;
    storage_key: string;
    thumbnail_url: string | null;
    kind: 'photo' | 'video';
    width: number | null;
    height: number | null;
    is_sensitive: boolean;
  }[] = [];

  for (const item of items) {
    const uploaded =
      item.kind === 'video'
        ? await uploadModVideo({
            uri: item.uri,
            ownerId,
            mimeType: item.mimeType,
            width: item.width,
            height: item.height,
          })
        : await uploadModPhoto({
            uri: item.uri,
            ownerId,
            mimeType: item.mimeType,
            width: item.width,
            height: item.height,
          });

    rows.push({
      owner_id: ownerId,
      post_id: postId,
      url: uploaded.url,
      storage_key: uploaded.storage_key,
      thumbnail_url: thumbnailUrlForPublicUrl(uploaded.url),
      kind: item.kind,
      width: uploaded.width,
      height: uploaded.height,
      is_sensitive: false,
    });
  }

  if (rows.length === 0) return;

  const { error } = await supabase.from('media').insert(rows);
  if (error) throw error;
}

export async function collectPostStorageKeys(postId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('media')
    .select('storage_key')
    .eq('post_id', postId);
  if (error) return [];
  return (data ?? []).map((r) => r.storage_key).filter(Boolean);
}

export async function purgePostMedia(postId: string): Promise<void> {
  const keys = await collectPostStorageKeys(postId);
  await deleteStorageObjects(MOD_PHOTOS_BUCKET, keys);
}

export function mapPostMedia(
  media:
    | {
        url: string;
        thumbnail_url: string | null;
        kind: string;
        is_sensitive: boolean;
      }[]
    | null
    | undefined
): CarouselMedia[] {
  return (media ?? [])
    .filter((m) => !m.is_sensitive && (m.kind === 'photo' || m.kind === 'video'))
    .map((m) => ({
      url: displayImageUrl(m.url, m.thumbnail_url) ?? m.url,
      kind: m.kind as 'photo' | 'video',
      thumbnail_url: m.thumbnail_url,
    }))
    .filter((m) => !!m.url);
}

/** Standalone post media — fetched separately so feed works before migration is applied. */
export async function fetchPostMediaByPostIds(
  postIds: string[]
): Promise<Map<string, CarouselMedia[]>> {
  const map = new Map<string, CarouselMedia[]>();
  if (postIds.length === 0) return map;

  const { data, error } = await supabase
    .from('media')
    .select('post_id, url, thumbnail_url, kind, is_sensitive')
    .in('post_id', postIds);

  if (error) {
    console.warn('[posts] post media unavailable:', error.message);
    return map;
  }

  for (const row of data ?? []) {
    if (!row.post_id || row.is_sensitive) continue;
    if (row.kind !== 'photo' && row.kind !== 'video') continue;
    const item: CarouselMedia = {
      url: displayImageUrl(row.url, row.thumbnail_url) ?? row.url,
      kind: row.kind as 'photo' | 'video',
      thumbnail_url: row.thumbnail_url,
    };
    const list = map.get(row.post_id) ?? [];
    list.push(item);
    map.set(row.post_id, list);
  }

  return map;
}
