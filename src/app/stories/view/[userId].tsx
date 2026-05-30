import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image as RNImage,
  Keyboard,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StoryOverlays } from '@/components/stories/StoryOverlays';
import { ProfileAvatar } from '@/components/social/ProfileAvatar';
import { KeyboardStickyFooter } from '@/components/ui/KeyboardSafeView';
import { useAuth } from '@/lib/auth-context';
import {
  deleteStory,
  listUserStories,
  markStoryViewed,
  replyToStory,
  storyDurationMs,
  toggleStoryLike,
  type StoryItem,
} from '@/lib/stories';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function StoryViewerScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [replyDraft, setReplyDraft] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [owner, setOwner] = useState<{
    handle: string;
    display_name: string;
    avatar_url: string | null;
  } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef<number | null>(null);
  const heartScale = useSharedValue(0);
  const heartOpacity = useSharedValue(0);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [items, userRes] = await Promise.all([
        listUserStories(userId, session?.user.id ?? null),
        supabase
          .from('users')
          .select('handle, display_name, avatar_url')
          .eq('id', userId)
          .maybeSingle(),
      ]);
      setStories(items);
      setOwner(userRes.data);
      if (items.length === 0) {
        router.back();
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not load stories');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [userId, session?.user.id, router]);

  useEffect(() => {
    load();
  }, [load]);

  const story = stories[index];

  const goNext = useCallback(() => {
    if (index < stories.length - 1) {
      setIndex((i) => i + 1);
      setProgress(0);
    } else {
      router.back();
    }
  }, [index, stories.length, router]);

  const goPrev = useCallback(() => {
    if (index > 0) {
      setIndex((i) => i - 1);
      setProgress(0);
    }
  }, [index]);

  useEffect(() => {
    if (!story || !session || paused) return;
    void markStoryViewed(story.id, session.user.id).catch(() => {});

    const duration = storyDurationMs(story);
    startedRef.current = Date.now();
    setProgress(0);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (!startedRef.current) return;
      const elapsed = Date.now() - startedRef.current;
      const pct = Math.min(elapsed / duration, 1);
      setProgress(pct);
      if (pct >= 1) {
        if (timerRef.current) clearInterval(timerRef.current);
        goNext();
      }
    }, 50);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [story, session, paused, goNext]);

  const heartStyle = useAnimatedStyle(() => ({
    opacity: heartOpacity.value,
    transform: [{ scale: heartScale.value }],
  }));

  function flashHeart() {
    heartOpacity.value = 1;
    heartScale.value = 0.4;
    heartScale.value = withSequence(
      withSpring(1.2, { damping: 8 }),
      withTiming(0, { duration: 250 })
    );
    heartOpacity.value = withSequence(withTiming(1, { duration: 80 }), withTiming(0, { duration: 350 }));
  }

  async function handleToggleLike() {
    if (!story || !session || story.user_id === session.user.id) return;
    const previouslyLiked = story.liked_by_me;
    setStories((current) =>
      current.map((s) =>
        s.id === story.id
          ? {
              ...s,
              liked_by_me: !previouslyLiked,
              like_count: Math.max(0, s.like_count + (previouslyLiked ? -1 : 1)),
            }
          : s
      )
    );
    if (!previouslyLiked) flashHeart();
    try {
      await toggleStoryLike(story.id, session.user.id, previouslyLiked);
    } catch (err) {
      setStories((current) =>
        current.map((s) =>
          s.id === story.id
            ? {
                ...s,
                liked_by_me: previouslyLiked,
                like_count: Math.max(0, s.like_count + (previouslyLiked ? 1 : -1)),
              }
            : s
        )
      );
      Alert.alert('Like failed', err instanceof Error ? err.message : 'Try again');
    }
  }

  async function handleSendReply() {
    if (!story || !session || story.user_id === session.user.id) return;
    const body = replyDraft.trim();
    if (!body || sendingReply) return;
    setSendingReply(true);
    Keyboard.dismiss();
    try {
      await replyToStory(story, session.user.id, body);
      setReplyDraft('');
      Alert.alert('Sent', `Reply sent to ${owner?.display_name ?? 'them'}`);
    } catch (err) {
      Alert.alert('Reply failed', err instanceof Error ? err.message : 'Could not send reply');
    } finally {
      setSendingReply(false);
    }
  }

  async function handleDelete() {
    if (!story || story.user_id !== session?.user.id) return;
    Alert.alert('Delete story?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteStory(story.id);
            const next = stories.filter((s) => s.id !== story.id);
            if (next.length === 0) {
              router.back();
              return;
            }
            setStories(next);
            setIndex((i) => Math.min(i, next.length - 1));
            setProgress(0);
          } catch (err) {
            Alert.alert('Delete failed', err instanceof Error ? err.message : 'Try again');
          }
        },
      },
    ]);
  }

  if (loading || !story || !owner) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  const isOwner = session?.user.id === story.user_id;

  return (
    <View className="flex-1 bg-black">
      <Stack.Screen options={{ headerShown: false }} />

      {story.media_kind === 'video' ? (
        <StoryVideo uri={story.media_url} paused={paused} onEnded={goNext} />
      ) : (
        <RNImage
          source={{ uri: story.media_url }}
          style={{ width: SCREEN_W, height: SCREEN_H }}
          resizeMode="cover"
        />
      )}

      <StoryOverlays stickers={story.stickers} />

      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            alignSelf: 'center',
            top: '42%',
          },
          heartStyle,
        ]}
      >
        <Ionicons name="heart" size={96} color="#fff" />
      </Animated.View>

      <SafeAreaView className="absolute inset-x-0 top-0" edges={['top']}>
        <View className="flex-row gap-1 px-2 pt-2">
          {stories.map((s, i) => (
            <View key={s.id} className="h-[2px] flex-1 overflow-hidden rounded-full bg-white/30">
              <View
                className="h-full bg-white"
                style={{
                  width: i < index ? '100%' : i === index ? `${progress * 100}%` : '0%',
                }}
              />
            </View>
          ))}
        </View>

        <View className="mt-3 flex-row items-center justify-between px-3">
          <Pressable
            onPress={() => router.push(`/user/${owner.handle}`)}
            className="flex-row items-center gap-2 active:opacity-80"
          >
            <ProfileAvatar
              uri={owner.avatar_url}
              name={owner.display_name}
              size={36}
              borderWidth={0}
            />
            <Text className="font-semibold text-white">{owner.display_name}</Text>
            <Text className="text-sm text-white/70">{formatStoryTime(story.created_at)}</Text>
          </Pressable>
          <View className="flex-row items-center gap-3">
            {isOwner && story.like_count > 0 ? (
              <View className="flex-row items-center gap-1">
                <Ionicons name="heart" size={16} color="#fff" />
                <Text className="text-sm font-semibold text-white">{story.like_count}</Text>
              </View>
            ) : null}
            {isOwner ? (
              <Pressable onPress={() => void handleDelete()} hitSlop={12}>
                <Ionicons name="trash-outline" size={22} color="#fff" />
              </Pressable>
            ) : (
              <Pressable onPress={() => void handleToggleLike()} hitSlop={12}>
                <Ionicons
                  name={story.liked_by_me ? 'heart' : 'heart-outline'}
                  size={24}
                  color={story.liked_by_me ? colors.accent : '#fff'}
                />
              </Pressable>
            )}
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Ionicons name="close" size={28} color="#fff" />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      {!isOwner ? (
        <KeyboardStickyFooter className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-black/60">
          <View className="flex-row items-end gap-2 px-3 py-2">
            <TextInput
              value={replyDraft}
              onChangeText={setReplyDraft}
              placeholder={`Reply to ${owner.display_name}…`}
              placeholderTextColor="rgba(255,255,255,0.55)"
              maxLength={500}
              className="max-h-24 flex-1 rounded-full bg-white/15 px-4 py-2.5 text-[15px] text-white"
              onFocus={() => setPaused(true)}
              onBlur={() => setPaused(false)}
            />
            <Pressable
              onPress={() => void handleSendReply()}
              disabled={!replyDraft.trim() || sendingReply}
              className="mb-1 h-9 w-9 items-center justify-center disabled:opacity-40"
            >
              {sendingReply ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons
                  name="send"
                  size={22}
                  color={replyDraft.trim() ? '#fff' : 'rgba(255,255,255,0.4)'}
                />
              )}
            </Pressable>
          </View>
        </KeyboardStickyFooter>
      ) : null}

      <Pressable
        className="absolute bottom-24 left-0 top-24 w-1/3"
        onPress={goPrev}
        onLongPress={() => setPaused(true)}
        onPressOut={() => setPaused(false)}
      />
      <Pressable
        className="absolute bottom-24 right-0 top-24 w-2/3"
        onPress={goNext}
        onLongPress={() => setPaused(true)}
        onPressOut={() => setPaused(false)}
      />
    </View>
  );
}

function StoryVideo({
  uri,
  paused,
  onEnded,
}: {
  uri: string;
  paused: boolean;
  onEnded: () => void;
}) {
  try {
    const { Video, ResizeMode } = require('expo-av') as typeof import('expo-av');
    return (
      <Video
        source={{ uri }}
        style={{ width: SCREEN_W, height: SCREEN_H }}
        resizeMode={ResizeMode.COVER}
        shouldPlay={!paused}
        isLooping={false}
        onPlaybackStatusUpdate={(status) => {
          if ('didJustFinish' in status && status.didJustFinish) onEnded();
        }}
      />
    );
  } catch {
    return (
      <View className="flex-1 items-center justify-center">
        <Image source={{ uri }} style={{ width: SCREEN_W, height: SCREEN_H }} contentFit="contain" />
      </View>
    );
  }
}

function formatStoryTime(iso: string): string {
  try {
    const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
    if (h < 1) return 'Just now';
    if (h < 24) return `${h}h`;
    return '1d';
  } catch {
    return '';
  }
}
