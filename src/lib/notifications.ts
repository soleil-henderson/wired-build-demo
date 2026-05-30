import { displayImageUrl } from './image-url';
import { supabase } from './supabase';
import type { Database } from '@/types/database';

export type NotificationType = Database['public']['Enums']['notification_type'];

type ActorPayload = {
  actor_id: string;
  actor_handle: string;
  actor_display_name: string;
  actor_avatar_url: string | null;
};

export type NotificationPayload =
  | (ActorPayload & { /* follow */ })
  | (ActorPayload & { request_id: string })
  | (ActorPayload & { post_id: string; reaction_type: string })
  | (ActorPayload & {
      post_id: string;
      comment_id: string;
      preview: string;
      is_reply: boolean;
    })
  | (ActorPayload & {
      vehicle_id: string;
      note: string | null;
    });

export type NotificationRow = {
  id: string;
  user_id: string;
  type: NotificationType;
  payload: NotificationPayload;
  read_at: string | null;
  created_at: string;
};

export type EnrichedNotificationRow = NotificationRow & {
  post_thumbnail_url: string | null;
};

export async function listNotifications(
  userId: string,
  limit = 50
): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as NotificationRow[];
}

/** Notifications with post thumbnails for likes/comments (Instagram-style right preview). */
export async function listNotificationsEnriched(
  userId: string,
  limit = 50
): Promise<EnrichedNotificationRow[]> {
  const rows = await listNotifications(userId, limit);
  const postIds = [
    ...new Set(
      rows
        .filter((r) => r.type === 'reaction' || r.type === 'comment')
        .map((r) => (r.payload as { post_id: string }).post_id)
        .filter(Boolean)
    ),
  ];

  const thumbByPost = new Map<string, string | null>();
  if (postIds.length > 0) {
    const { data, error } = await supabase
      .from('posts')
      .select(
        `
        id,
        mod:mods!posts_mod_id_fkey (
          media!media_mod_id_fkey ( url, thumbnail_url, kind, is_sensitive )
        )
      `
      )
      .in('id', postIds);
    if (!error && data) {
      for (const row of data) {
        const mod = row.mod as {
          media?: {
            url: string;
            thumbnail_url: string | null;
            kind: string;
            is_sensitive: boolean;
          }[];
        } | null;
        const firstPhoto = (mod?.media ?? []).find(
          (m) => !m.is_sensitive && m.kind === 'photo'
        );
        thumbByPost.set(
          row.id,
          firstPhoto
            ? displayImageUrl(firstPhoto.url, firstPhoto.thumbnail_url) ??
                firstPhoto.url
            : null
        );
      }
    }
  }

  return rows.map((r) => ({
    ...r,
    post_thumbnail_url:
      r.type === 'reaction' || r.type === 'comment'
        ? thumbByPost.get((r.payload as { post_id: string }).post_id) ?? null
        : null,
  }));
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) return 0;
  return count ?? 0;
}

export async function markAllRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) throw error;
}

export async function markRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .is('read_at', null);
  if (error) throw error;
}

export async function deleteNotification(notificationId: string): Promise<void> {
  const { error } = await supabase.from('notifications').delete().eq('id', notificationId);
  if (error) throw error;
}
