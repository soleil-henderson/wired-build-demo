import * as ImagePicker from 'expo-image-picker';

import { listBlockedUserIds } from './blocks';
import { getOrCreateConversation } from './messages';
import {
  isValidStoryTextColor,
  isValidStoryTextStyle,
  type StoryTextColorId,
  type StoryTextStyleName,
} from './story-text-styles';
import { uploadModPhoto, uploadModVideo } from './storage';
import { supabase } from './supabase';

export type { StoryTextColorId, StoryTextStyleName } from './story-text-styles';

export const STORY_TTL_MS = 24 * 60 * 60 * 1000;
export const STORY_PHOTO_MS = 5000;
export const STORY_VIDEO_MAX_MS = 60_000;

export const STORY_EMOJI_STICKERS = [
  '🔥', '💯', '😂', '😍', '🙌', '👀', '🏎️', '⚡', '🛠️', '✨',
  '💪', '🤙', '😎', '🚀', '❤️', '👍', '🎉', '💨', '🏁', '😮',
];

export type StoryMediaKind = 'photo' | 'video';

/** @deprecated Use StoryTextStyleName */
export type StoryTextStyle = StoryTextStyleName;

export type StorySticker = {
  id: string;
  kind: 'emoji' | 'text';
  content: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  /** Font style (classic, modern, neon, typewriter, strong, serif). */
  text_style?: StoryTextStyleName | 'plain';
  /** Palette color id (white, yellow, red, …). */
  text_color?: StoryTextColorId;
};

export type StoryItem = {
  id: string;
  user_id: string;
  media_url: string;
  media_kind: StoryMediaKind;
  thumbnail_url: string | null;
  duration_ms: number | null;
  caption: string | null;
  stickers: StorySticker[];
  created_at: string;
  expires_at: string;
  viewed_by_me: boolean;
  liked_by_me: boolean;
  like_count: number;
};

export type StoryRing = {
  user_id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  preview_url: string | null;
  story_count: number;
  has_unviewed: boolean;
  is_self: boolean;
};

type RawStoryRow = {
  id: string;
  user_id: string;
  media_url: string;
  media_kind: StoryMediaKind;
  thumbnail_url: string | null;
  duration_ms: number | null;
  caption: string | null;
  stickers: unknown;
  created_at: string;
  expires_at: string;
  user: {
    id: string;
    handle: string;
    display_name: string;
    avatar_url: string | null;
    is_private: boolean;
  } | null;
};

function parseStickers(raw: unknown): StorySticker[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is StorySticker => {
    if (!s || typeof s !== 'object') return false;
    const row = s as StorySticker;
    return (
      typeof row.id === 'string' &&
      (row.kind === 'emoji' || row.kind === 'text') &&
      typeof row.content === 'string' &&
      typeof row.x === 'number' &&
      typeof row.y === 'number' &&
      typeof row.scale === 'number' &&
      typeof row.rotation === 'number' &&
      (row.text_style == null ||
        isValidStoryTextStyle(row.text_style) ||
        row.text_style === 'plain') &&
      (row.text_color == null || isValidStoryTextColor(row.text_color))
    );
  });
}

export function createStickerId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `sticker-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function pickStoryMedia(): Promise<ImagePicker.ImagePickerAsset | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Photo library access is required to post a story.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsEditing: true,
    quality: 0.85,
    videoMaxDuration: 60,
  });

  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0];
}

export type CreateStoryInput = {
  userId: string;
  asset: ImagePicker.ImagePickerAsset;
  caption?: string | null;
  stickers?: StorySticker[];
};

export async function createStoryFromAsset(input: CreateStoryInput): Promise<StoryItem> {
  const { userId, asset, caption, stickers = [] } = input;
  const isVideo = asset.type === 'video';
  const uploaded = isVideo
    ? await uploadModVideo({
        uri: asset.uri,
        ownerId: userId,
        mimeType: asset.mimeType,
        width: asset.width,
        height: asset.height,
      })
    : await uploadModPhoto({
        uri: asset.uri,
        ownerId: userId,
        mimeType: asset.mimeType,
        width: asset.width,
        height: asset.height,
      });

  const expiresAt = new Date(Date.now() + STORY_TTL_MS).toISOString();
  const durationMs = isVideo
    ? Math.min(asset.duration ?? STORY_VIDEO_MAX_MS / 1000, 60) * 1000
    : STORY_PHOTO_MS;

  const { data, error } = await supabase
    .from('stories')
    .insert({
      user_id: userId,
      media_url: uploaded.url,
      storage_key: uploaded.storage_key,
      media_kind: isVideo ? 'video' : 'photo',
      thumbnail_url: isVideo ? uploaded.url : null,
      duration_ms: durationMs,
      expires_at: expiresAt,
      caption: caption?.trim() || null,
      stickers,
    })
    .select('*')
    .single();

  if (error) throw error;

  return mapStoryRow(data, true, false, 0);
}

function mapStoryRow(
  row: {
    id: string;
    user_id: string;
    media_url: string;
    media_kind: string;
    thumbnail_url: string | null;
    duration_ms: number | null;
    caption: string | null;
    stickers: unknown;
    created_at: string;
    expires_at: string;
  },
  viewedByMe: boolean,
  likedByMe: boolean,
  likeCount: number
): StoryItem {
  return {
    id: row.id,
    user_id: row.user_id,
    media_url: row.media_url,
    media_kind: row.media_kind as StoryMediaKind,
    thumbnail_url: row.thumbnail_url,
    duration_ms: row.duration_ms,
    caption: row.caption,
    stickers: parseStickers(row.stickers),
    created_at: row.created_at,
    expires_at: row.expires_at,
    viewed_by_me: viewedByMe,
    liked_by_me: likedByMe,
    like_count: likeCount,
  };
}

export async function listStoryRings(viewerId: string | null): Promise<StoryRing[]> {
  if (!viewerId) return [];

  const now = new Date().toISOString();

  const [{ data: followRows }, blockedIds] = await Promise.all([
    supabase.from('follows').select('followee_id').eq('follower_id', viewerId),
    listBlockedUserIds(viewerId),
  ]);

  const blocked = new Set(blockedIds);
  const followeeIds = (followRows ?? []).map((r) => r.followee_id).filter((id) => !blocked.has(id));
  const visibleUserIds = [viewerId, ...followeeIds];

  const { data: storyRows, error } = await supabase
    .from('stories')
    .select(
      `
      id, user_id, media_url, media_kind, thumbnail_url, created_at, expires_at,
      user:users!stories_user_id_fkey ( id, handle, display_name, avatar_url, is_private )
    `
    )
    .gt('expires_at', now)
    .in('user_id', visibleUserIds)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const { data: viewRows } = await supabase
    .from('story_views')
    .select('story_id')
    .eq('viewer_id', viewerId);

  const viewedIds = new Set((viewRows ?? []).map((v) => v.story_id));

  const byUser = new Map<string, { stories: RawStoryRow[]; user: RawStoryRow['user'] }>();

  for (const row of (storyRows ?? []) as RawStoryRow[]) {
    if (!row.user?.handle) continue;
    const existing = byUser.get(row.user_id);
    if (existing) {
      existing.stories.push(row);
    } else {
      byUser.set(row.user_id, { stories: [row], user: row.user });
    }
  }

  const rings: StoryRing[] = [];

  for (const [userId, group] of byUser) {
    if (!group.user) continue;
    const stories = group.stories;
    const latest = stories[stories.length - 1];
    const preview =
      latest.media_kind === 'photo'
        ? latest.media_url
        : latest.thumbnail_url ?? latest.media_url;
    const hasUnviewed = stories.some((s) => !viewedIds.has(s.id));

    rings.push({
      user_id: userId,
      handle: group.user.handle,
      display_name: group.user.display_name,
      avatar_url: group.user.avatar_url,
      preview_url: preview,
      story_count: stories.length,
      has_unviewed: hasUnviewed,
      is_self: userId === viewerId,
    });
  }

  rings.sort((a, b) => {
    if (a.is_self) return -1;
    if (b.is_self) return 1;
    if (a.has_unviewed !== b.has_unviewed) return a.has_unviewed ? -1 : 1;
    return a.display_name.localeCompare(b.display_name);
  });

  if (!rings.some((r) => r.is_self)) {
    const { data: me } = await supabase
      .from('users')
      .select('id, handle, display_name, avatar_url')
      .eq('id', viewerId)
      .maybeSingle();
    if (me) {
      rings.unshift({
        user_id: me.id,
        handle: me.handle,
        display_name: me.display_name,
        avatar_url: me.avatar_url,
        preview_url: null,
        story_count: 0,
        has_unviewed: false,
        is_self: true,
      });
    }
  }

  return rings;
}

export async function listUserStories(
  ownerId: string,
  viewerId: string | null
): Promise<StoryItem[]> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .eq('user_id', ownerId)
    .gt('expires_at', now)
    .order('created_at', { ascending: true });

  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const storyIds = rows.map((s) => s.id);

  let viewedIds = new Set<string>();
  let likedIds = new Set<string>();
  const likeCounts = new Map<string, number>();

  if (viewerId) {
    const [{ data: views }, { data: myLikes }, { data: allLikes }] = await Promise.all([
      supabase.from('story_views').select('story_id').eq('viewer_id', viewerId).in('story_id', storyIds),
      supabase.from('story_likes').select('story_id').eq('user_id', viewerId).in('story_id', storyIds),
      supabase.from('story_likes').select('story_id').in('story_id', storyIds),
    ]);
    viewedIds = new Set((views ?? []).map((v) => v.story_id));
    likedIds = new Set((myLikes ?? []).map((l) => l.story_id));
    for (const like of allLikes ?? []) {
      likeCounts.set(like.story_id, (likeCounts.get(like.story_id) ?? 0) + 1);
    }
  }

  return rows.map((s) =>
    mapStoryRow(
      s,
      viewedIds.has(s.id),
      likedIds.has(s.id),
      likeCounts.get(s.id) ?? 0
    )
  );
}

export async function markStoryViewed(storyId: string, viewerId: string): Promise<void> {
  const { error } = await supabase.from('story_views').insert({
    story_id: storyId,
    viewer_id: viewerId,
  });
  if (error && error.code !== '23505') throw error;
}

export async function toggleStoryLike(
  storyId: string,
  userId: string,
  currentlyLiked: boolean
): Promise<boolean> {
  if (currentlyLiked) {
    const { error } = await supabase
      .from('story_likes')
      .delete()
      .eq('story_id', storyId)
      .eq('user_id', userId);
    if (error) throw error;
    return false;
  }

  const { error } = await supabase.from('story_likes').insert({
    story_id: storyId,
    user_id: userId,
  });
  if (error && error.code !== '23505') throw error;
  return true;
}

export async function replyToStory(
  story: StoryItem,
  senderId: string,
  body: string
): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Reply cannot be empty');
  if (story.user_id === senderId) throw new Error('Cannot reply to your own story');

  const conversationId = await getOrCreateConversation(story.user_id);

  const { error } = await supabase.from('direct_messages').insert({
    conversation_id: conversationId,
    sender_id: senderId,
    body: trimmed,
    message_type: 'story_reply',
    story_id: story.id,
  });
  if (error) throw error;
}

export async function deleteStory(storyId: string): Promise<void> {
  const { error } = await supabase.from('stories').delete().eq('id', storyId);
  if (error) throw error;
}

export function storyDurationMs(story: StoryItem): number {
  if (story.media_kind === 'video') {
    return Math.min(story.duration_ms ?? STORY_VIDEO_MAX_MS, STORY_VIDEO_MAX_MS);
  }
  return STORY_PHOTO_MS;
}
