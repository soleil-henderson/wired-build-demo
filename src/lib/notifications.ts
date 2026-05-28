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
  | (ActorPayload & { post_id: string; reaction_type: string })
  | (ActorPayload & {
      post_id: string;
      comment_id: string;
      preview: string;
      is_reply: boolean;
    });

export type NotificationRow = {
  id: string;
  user_id: string;
  type: NotificationType;
  payload: NotificationPayload;
  read_at: string | null;
  created_at: string;
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
