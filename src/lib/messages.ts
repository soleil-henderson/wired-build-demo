import * as ImagePicker from 'expo-image-picker';

import { supabase } from './supabase';
import type { Database } from '@/types/database';
import { uploadDmAudio, uploadModPhoto } from './storage';

export type ConversationRow = Database['public']['Tables']['conversations']['Row'];
export type DirectMessageRow = Database['public']['Tables']['direct_messages']['Row'];
export type DmMessageType = DirectMessageRow['message_type'];

export type MessagePeer = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
};

export type ConversationPreview = ConversationRow & {
  peer: MessagePeer;
  unread_count: number;
};

export type DmEventPreview = {
  id: string;
  title: string;
  kind: string;
  location_name: string;
  starts_at: string;
  is_private: boolean;
};

export type DirectMessage = DirectMessageRow & {
  liked_by_me: boolean;
  like_count: number;
  story_preview_url?: string | null;
  event_preview?: DmEventPreview | null;
};

type UserSnippet = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
};

function peerFromConversation(c: ConversationRow, meId: string, low: UserSnippet, high: UserSnippet): MessagePeer {
  return c.user_low_id === meId ? high : low;
}

export async function getOrCreateConversation(otherUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_conversation', {
    p_other_user_id: otherUserId,
  });
  if (error) throw error;
  return data as string;
}

export async function listConversations(userId: string): Promise<ConversationPreview[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select(
      `
      *,
      user_low:users!conversations_user_low_id_fkey(id, handle, display_name, avatar_url),
      user_high:users!conversations_user_high_id_fkey(id, handle, display_name, avatar_url)
    `
    )
    .or(`user_low_id.eq.${userId},user_high_id.eq.${userId}`)
    .order('last_message_at', { ascending: false });
  if (error) throw error;

  const rows = data ?? [];
  const previews: ConversationPreview[] = [];

  for (const row of rows) {
    const low = row.user_low as UserSnippet | null;
    const high = row.user_high as UserSnippet | null;
    if (!low || !high) continue;

    const { user_low, user_high, ...conversation } = row;
    const unread = await countUnreadInConversation(conversation.id, userId);
    previews.push({
      ...(conversation as ConversationRow),
      peer: peerFromConversation(conversation as ConversationRow, userId, low, high),
      unread_count: unread,
    });
  }

  return previews;
}

async function countUnreadInConversation(conversationId: string, userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('direct_messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversationId)
    .neq('sender_id', userId)
    .is('read_at', null);
  if (error) return 0;
  return count ?? 0;
}

export async function getUnreadMessageCount(userId: string): Promise<number> {
  const { data: convos, error } = await supabase
    .from('conversations')
    .select('id')
    .or(`user_low_id.eq.${userId},user_high_id.eq.${userId}`);
  if (error || !convos?.length) return 0;

  const ids = convos.map((c) => c.id);
  const { count, error: msgErr } = await supabase
    .from('direct_messages')
    .select('id', { count: 'exact', head: true })
    .in('conversation_id', ids)
    .neq('sender_id', userId)
    .is('read_at', null);
  if (msgErr) return 0;
  return count ?? 0;
}

export async function getConversationWithPeer(
  conversationId: string,
  userId: string
): Promise<{ conversation: ConversationRow; peer: MessagePeer } | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select(
      `
      *,
      user_low:users!conversations_user_low_id_fkey(id, handle, display_name, avatar_url),
      user_high:users!conversations_user_high_id_fkey(id, handle, display_name, avatar_url)
    `
    )
    .eq('id', conversationId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const low = data.user_low as UserSnippet | null;
  const high = data.user_high as UserSnippet | null;
  if (!low || !high) return null;

  const conv = data as ConversationRow & { user_low: UserSnippet; user_high: UserSnippet };
  if (conv.user_low_id !== userId && conv.user_high_id !== userId) return null;

  const { user_low, user_high, ...conversation } = conv;
  return {
    conversation: conversation as ConversationRow,
    peer: peerFromConversation(conversation as ConversationRow, userId, low, high),
  };
}

async function attachMessageMeta(
  rows: DirectMessageRow[],
  viewerId: string
): Promise<DirectMessage[]> {
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const storyIds = rows.map((r) => r.story_id).filter(Boolean) as string[];
  const eventIds = rows.map((r) => r.event_id).filter(Boolean) as string[];

  const [{ data: myLikes }, { data: allLikes }, { data: stories }, { data: events }] =
    await Promise.all([
      supabase.from('message_likes').select('message_id').eq('user_id', viewerId).in('message_id', ids),
      supabase.from('message_likes').select('message_id').in('message_id', ids),
      storyIds.length
        ? supabase
            .from('stories')
            .select('id, media_url, thumbnail_url, media_kind')
            .in('id', storyIds)
        : Promise.resolve({
            data: [] as {
              id: string;
              media_url: string;
              thumbnail_url: string | null;
              media_kind: string;
            }[],
          }),
      eventIds.length
        ? supabase
            .from('events')
            .select('id, title, kind, location_name, starts_at, is_private')
            .in('id', eventIds)
        : Promise.resolve({
            data: [] as {
              id: string;
              title: string;
              kind: string;
              location_name: string;
              starts_at: string;
              is_private: boolean;
            }[],
          }),
    ]);

  const likedByMe = new Set((myLikes ?? []).map((l) => l.message_id));
  const likeCounts = new Map<string, number>();
  for (const like of allLikes ?? []) {
    likeCounts.set(like.message_id, (likeCounts.get(like.message_id) ?? 0) + 1);
  }

  const storyPreview = new Map<string, string>();
  for (const story of stories ?? []) {
    storyPreview.set(
      story.id,
      story.media_kind === 'photo' ? story.media_url : story.thumbnail_url ?? story.media_url
    );
  }

  const eventPreview = new Map<string, DmEventPreview>();
  for (const ev of events ?? []) {
    eventPreview.set(ev.id, ev);
  }

  return rows.map((row) => ({
    ...row,
    liked_by_me: likedByMe.has(row.id),
    like_count: likeCounts.get(row.id) ?? 0,
    story_preview_url: row.story_id ? storyPreview.get(row.story_id) ?? null : null,
    event_preview: row.event_id ? eventPreview.get(row.event_id) ?? null : null,
  }));
}

export async function sendEventShareMessage(input: {
  conversationId: string;
  senderId: string;
  eventId: string;
  body?: string | null;
}): Promise<DirectMessage> {
  const { data, error } = await supabase
    .from('direct_messages')
    .insert({
      conversation_id: input.conversationId,
      sender_id: input.senderId,
      message_type: 'event_share',
      event_id: input.eventId,
      body: input.body?.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  const enriched = await attachMessageMeta([data], input.senderId);
  return enriched[0] ?? { ...data, liked_by_me: false, like_count: 0 };
}

export async function listMessages(conversationId: string, viewerId: string, limit = 80): Promise<DirectMessage[]> {
  const { data, error } = await supabase
    .from('direct_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return attachMessageMeta(data ?? [], viewerId);
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string
): Promise<DirectMessage> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Message cannot be empty');

  const { data, error } = await supabase
    .from('direct_messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      body: trimmed,
      message_type: 'text',
    })
    .select()
    .single();
  if (error) throw error;
  return { ...data, liked_by_me: false, like_count: 0 };
}

export async function sendImageMessage(
  conversationId: string,
  senderId: string,
  asset: ImagePicker.ImagePickerAsset
): Promise<DirectMessage> {
  const uploaded = await uploadModPhoto({
    uri: asset.uri,
    ownerId: senderId,
    mimeType: asset.mimeType,
    width: asset.width,
    height: asset.height,
  });

  const { data, error } = await supabase
    .from('direct_messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      message_type: 'image',
      media_url: uploaded.url,
      storage_key: uploaded.storage_key,
    })
    .select()
    .single();
  if (error) throw error;
  return { ...data, liked_by_me: false, like_count: 0 };
}

export async function sendAudioMessage(
  conversationId: string,
  senderId: string,
  uri: string,
  durationMs: number
): Promise<DirectMessage> {
  const uploaded = await uploadDmAudio({ uri, ownerId: senderId });

  const { data, error } = await supabase
    .from('direct_messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      message_type: 'audio',
      media_url: uploaded.url,
      storage_key: uploaded.storage_key,
      audio_duration_ms: durationMs,
    })
    .select()
    .single();
  if (error) throw error;
  return { ...data, liked_by_me: false, like_count: 0 };
}

export async function toggleMessageLike(
  messageId: string,
  userId: string,
  currentlyLiked: boolean
): Promise<boolean> {
  if (currentlyLiked) {
    const { error } = await supabase
      .from('message_likes')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', userId);
    if (error) throw error;
    return false;
  }

  const { error } = await supabase.from('message_likes').insert({
    message_id: messageId,
    user_id: userId,
  });
  if (error && error.code !== '23505') throw error;
  return true;
}

export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('direct_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', userId)
    .is('read_at', null);
  if (error) throw error;
}

export function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatAudioDuration(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return '0:00';
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export function subscribeToConversationMessages(
  conversationId: string,
  onInsert: (message: DirectMessageRow) => void
) {
  const channel = supabase
    .channel(`dm:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        onInsert(payload.new as DirectMessageRow);
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function pickDmImage(): Promise<ImagePicker.ImagePickerAsset | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Photo library access is required to send images.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.85,
  });

  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0];
}
