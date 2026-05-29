import { supabase } from './supabase';

export type NotificationPreferences = {
  user_id: string;
  follows_enabled: boolean;
  reactions_enabled: boolean;
  comments_enabled: boolean;
  ownership_transfers_enabled: boolean;
};

export async function getNotificationPreferences(
  userId: string
): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  const defaults: NotificationPreferences = {
    user_id: userId,
    follows_enabled: true,
    reactions_enabled: true,
    comments_enabled: true,
    ownership_transfers_enabled: true,
  };

  const { data: inserted, error: insertErr } = await supabase
    .from('notification_preferences')
    .insert(defaults)
    .select()
    .single();

  if (insertErr) throw insertErr;
  return inserted;
}

export async function updateNotificationPreferences(
  userId: string,
  patch: Partial<Omit<NotificationPreferences, 'user_id'>>
): Promise<void> {
  const { error } = await supabase
    .from('notification_preferences')
    .upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() });
  if (error) throw error;
}
