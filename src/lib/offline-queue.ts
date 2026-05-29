import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './supabase';
import { thumbnailUrlForPublicUrl } from './image-url';
import { uploadModPhoto } from './storage';

const KEY = '@wired_build/upload_queue';

export type QueuedModPhoto = {
  modId: string;
  ownerId: string;
  uri: string;
  mimeType?: string;
  width?: number;
  height?: number;
  createdAt: string;
};

export async function enqueueModPhotoUpload(item: Omit<QueuedModPhoto, 'createdAt'>): Promise<void> {
  const raw = await AsyncStorage.getItem(KEY);
  const queue: QueuedModPhoto[] = raw ? (JSON.parse(raw) as QueuedModPhoto[]) : [];
  queue.push({ ...item, createdAt: new Date().toISOString() });
  await AsyncStorage.setItem(KEY, JSON.stringify(queue));
}

export async function listQueuedModPhotoUploads(): Promise<QueuedModPhoto[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as QueuedModPhoto[]) : [];
}

export async function clearQueuedModPhotoUploads(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

/** Retry queued mod-photo uploads after a failed log-a-mod save. */
export async function processQueuedModPhotoUploads(): Promise<number> {
  const queue = await listQueuedModPhotoUploads();
  if (queue.length === 0) return 0;

  const remaining: QueuedModPhoto[] = [];
  let succeeded = 0;

  for (const item of queue) {
    try {
      const uploaded = await uploadModPhoto({
        uri: item.uri,
        ownerId: item.ownerId,
        mimeType: item.mimeType,
        width: item.width,
        height: item.height,
      });
      const { error } = await supabase.from('media').insert({
        owner_id: item.ownerId,
        mod_id: item.modId,
        url: uploaded.url,
        storage_key: uploaded.storage_key,
        thumbnail_url: thumbnailUrlForPublicUrl(uploaded.url),
        kind: 'photo' as const,
        width: uploaded.width,
        height: uploaded.height,
        is_sensitive: false,
      });
      if (error) throw error;
      succeeded += 1;
    } catch (err) {
      console.warn('[offline-queue] retry failed', err);
      remaining.push(item);
    }
  }

  await AsyncStorage.setItem(KEY, JSON.stringify(remaining));
  return succeeded;
}
