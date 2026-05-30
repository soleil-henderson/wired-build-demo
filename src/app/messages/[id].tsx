import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { DmEventShareCard } from '@/components/events/DmEventShareCard';
import { ProfileAvatar } from '@/components/social/ProfileAvatar';
import { KeyboardStickyFooter } from '@/components/ui/KeyboardSafeView';
import { useAuth } from '@/lib/auth-context';
import {
  formatAudioDuration,
  getConversationWithPeer,
  listMessages,
  markConversationRead,
  pickDmImage,
  sendAudioMessage,
  sendImageMessage,
  sendMessage,
  subscribeToConversationMessages,
  toggleMessageLike,
  type DirectMessage,
  type MessagePeer,
} from '@/lib/messages';
import { useUnreadMessages } from '@/lib/unread-messages-context';
import { colors } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';
import { promptSaveDmImage } from '@/lib/save-remote-image';

const DM_BUBBLE_MAX_WIDTH_PCT = 0.82;
const DM_IMAGE_MAX = 260;

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const { refresh: refreshUnread } = useUnreadMessages();
  const [peer, setPeer] = useState<MessagePeer | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  const listRef = useRef<FlatList<DirectMessage>>(null);
  const recordingRef = useRef<import('expo-av').Audio.Recording | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!session || !id) return;
    try {
      const meta = await getConversationWithPeer(id, session.user.id);
      if (!meta) {
        setPeer(null);
        return;
      }
      setPeer(meta.peer);
      const rows = await listMessages(id, session.user.id);
      setMessages(rows);
      await markConversationRead(id, session.user.id);
      await refreshUnread();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not load chat');
    } finally {
      setLoading(false);
    }
  }, [id, session, refreshUnread]);

  const resetEntity = useCallback(() => {
    setPeer(null);
    setMessages([]);
    setLoading(true);
  }, []);

  useFocusData(
    async ({ isInitial }) => {
      if (isInitial && messages.length === 0) setLoading(true);
      await load();
    },
    [load],
    { cacheKey: id, onCacheKeyChange: resetEntity }
  );

  useEffect(() => {
    if (!id || !session) return;
    return subscribeToConversationMessages(id, async (row) => {
      const enriched = await listMessages(id, session.user.id);
      setMessages(enriched);
      if (row.sender_id !== session.user.id) {
        void markConversationRead(id, session.user.id);
        void refreshUnread();
      }
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    });
  }, [id, session, refreshUnread]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      void recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

  async function handleSend() {
    if (!session || !id || !draft.trim() || sending) return;
    const body = draft.trim();
    setDraft('');
    setSending(true);
    try {
      const msg = await sendMessage(id, session.user.id, body);
      setMessages((current) => [...current, msg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (err) {
      setDraft(body);
      Alert.alert('Send failed', err instanceof Error ? err.message : 'Could not send');
    } finally {
      setSending(false);
    }
  }

  async function handlePickImage() {
    if (!session || !id || sending) return;
    setSending(true);
    try {
      const asset = await pickDmImage();
      if (!asset) return;
      const msg = await sendImageMessage(id, session.user.id, asset);
      setMessages((current) => [...current, msg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (err) {
      Alert.alert('Send failed', err instanceof Error ? err.message : 'Could not send image');
    } finally {
      setSending(false);
    }
  }

  async function startRecording() {
    if (!session || !id || recording || sending) return;
    try {
      const { Audio } = require('expo-av') as typeof import('expo-av');
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Microphone needed', 'Allow microphone access to send voice messages.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;
      setRecording(true);
      setRecordingMs(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingMs((ms) => ms + 100);
      }, 100);
    } catch (err) {
      Alert.alert('Recording failed', err instanceof Error ? err.message : 'Try again');
    }
  }

  async function stopRecording(send: boolean) {
    if (!session || !id || !recordingRef.current) return;
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    const durationMs = recordingMs;
    setRecording(false);
    setRecordingMs(0);

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (!send || !uri || durationMs < 500) return;

      setSending(true);
      const msg = await sendAudioMessage(id, session.user.id, uri, durationMs);
      setMessages((current) => [...current, msg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (err) {
      Alert.alert('Send failed', err instanceof Error ? err.message : 'Could not send voice memo');
    } finally {
      setSending(false);
    }
  }

  async function handleToggleLike(message: DirectMessage) {
    if (!session) return;
    const previouslyLiked = message.liked_by_me;
    setMessages((current) =>
      current.map((m) =>
        m.id === message.id
          ? {
              ...m,
              liked_by_me: !previouslyLiked,
              like_count: Math.max(0, m.like_count + (previouslyLiked ? -1 : 1)),
            }
          : m
      )
    );
    try {
      await toggleMessageLike(message.id, session.user.id, previouslyLiked);
    } catch {
      setMessages((current) =>
        current.map((m) =>
          m.id === message.id
            ? {
                ...m,
                liked_by_me: previouslyLiked,
                like_count: Math.max(0, m.like_count + (previouslyLiked ? 1 : -1)),
              }
            : m
        )
      );
    }
  }

  if (loading && messages.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Stack.Screen options={{ title: 'Chat' }} />
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!peer) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Stack.Screen options={{ title: 'Chat' }} />
        <Text className="text-apple-secondary">Conversation not found.</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="font-semibold text-accent">Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen
        options={{
          title: peer.display_name,
          headerRight: () => (
            <Pressable
              onPress={() => router.push(`/user/${peer.handle}`)}
              hitSlop={8}
              className="mr-1 active:opacity-70"
            >
              <ProfileAvatar uri={peer.avatar_url} name={peer.display_name} size={32} borderWidth={0} />
            </Pressable>
          ),
        }}
      />

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerClassName="px-4 py-4"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            isMine={item.sender_id === session?.user.id}
            onToggleLike={() => void handleToggleLike(item)}
          />
        )}
        ListEmptyComponent={
          <View className="items-center py-16">
            <ProfileAvatar uri={peer.avatar_url} name={peer.display_name} size={72} borderWidth={0} />
            <Text className="mt-3 text-lg font-semibold text-apple-ink">{peer.display_name}</Text>
            <Text className="mt-1 text-sm text-apple-secondary">@{peer.handle}</Text>
            <Text className="mt-4 text-sm text-apple-tertiary">Start the conversation</Text>
          </View>
        }
      />

      <KeyboardStickyFooter className="border-t border-apple-border bg-white">
        {recording ? (
          <View className="flex-row items-center gap-3 px-4 py-3">
            <View className="h-2 w-2 rounded-full bg-red-500" />
            <Text className="flex-1 text-sm font-semibold text-apple-ink">
              Recording {formatAudioDuration(recordingMs)}
            </Text>
            <Pressable onPress={() => void stopRecording(false)} className="px-2 py-1">
              <Text className="text-sm font-semibold text-apple-secondary">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => void stopRecording(true)}
              className="rounded-full bg-accent px-4 py-2"
            >
              <Text className="text-sm font-semibold text-white">Send</Text>
            </Pressable>
          </View>
        ) : (
          <View className="flex-row items-end gap-2 px-3 pt-2">
            <Pressable
              onPress={() => void handlePickImage()}
              disabled={sending}
              className="mb-1 h-9 w-9 items-center justify-center active:opacity-70 disabled:opacity-40"
            >
              <Ionicons name="image-outline" size={22} color={colors.secondary} />
            </Pressable>
            <Pressable
              onPress={() => void startRecording()}
              disabled={sending}
              className="mb-1 h-9 w-9 items-center justify-center active:opacity-70 disabled:opacity-40"
            >
              <Ionicons name="mic-outline" size={22} color={colors.secondary} />
            </Pressable>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Message…"
              placeholderTextColor={colors.tertiary}
              multiline
              maxLength={2000}
              className="max-h-28 flex-1 rounded-2xl bg-apple-bg2 px-4 py-2.5 text-[15px] text-apple-ink"
            />
            <Pressable
              onPress={() => void handleSend()}
              disabled={!draft.trim() || sending}
              className="mb-1 h-9 w-9 items-center justify-center active:opacity-70 disabled:opacity-40"
            >
              {sending ? (
                <ActivityIndicator color={colors.accent} size="small" />
              ) : (
                <Ionicons
                  name="send"
                  size={22}
                  color={draft.trim() ? colors.accent : colors.tertiary}
                />
              )}
            </Pressable>
          </View>
        )}
      </KeyboardStickyFooter>
    </View>
  );
}

function MessageBubble({
  message,
  isMine,
  onToggleLike,
}: {
  message: DirectMessage;
  isMine: boolean;
  onToggleLike: () => void;
}) {
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      runOnJS(onToggleLike)();
    });

  const content = renderMessageContent(message, isMine);

  return (
    <View className={`mb-3 w-full ${isMine ? 'items-end' : 'items-start'}`}>
      <GestureDetector gesture={doubleTap}>
        <View className={`max-w-[82%] ${isMine ? 'self-end' : 'self-start'}`}>
          {content}
        </View>
      </GestureDetector>
      {message.like_count > 0 || message.liked_by_me ? (
        <Pressable
          onPress={onToggleLike}
          className={`mt-1.5 flex-row items-center gap-1 ${isMine ? 'self-end' : 'self-start'}`}
        >
          <Ionicons
            name="heart"
            size={12}
            color={message.liked_by_me ? colors.accent : colors.tertiary}
          />
          {message.like_count > 0 ? (
            <Text className="text-[11px] text-apple-tertiary">{message.like_count}</Text>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}

function bubbleShell(isMine: boolean, extra = '') {
  return `overflow-hidden rounded-[18px] ${
    isMine ? 'rounded-br-[5px] bg-accent' : 'rounded-bl-[5px] bg-apple-bg2'
  } ${extra}`;
}

function renderMessageContent(message: DirectMessage, isMine: boolean) {
  const textClass = `text-[15px] leading-[21px] ${isMine ? 'text-white' : 'text-apple-ink'}`;

  if (message.message_type === 'image' && message.media_url) {
    return <DmImageBubble uri={message.media_url} isMine={isMine} />;
  }

  if (message.message_type === 'audio' && message.media_url) {
    return <AudioBubble uri={message.media_url} durationMs={message.audio_duration_ms} isMine={isMine} />;
  }

  if (message.message_type === 'event_share' && message.event_preview) {
    return (
      <DmEventShareCard
        preview={message.event_preview}
        note={message.body}
        isMine={isMine}
      />
    );
  }

  if (message.message_type === 'story_reply') {
    return (
      <View className={`${bubbleShell(isMine)} px-4 py-3`}>
        {message.story_preview_url ? (
          <Pressable
            onLongPress={() => promptSaveDmImage(message.story_preview_url!)}
            delayLongPress={350}
            className="mb-2.5 self-start overflow-hidden rounded-lg"
          >
            <Image
              source={{ uri: message.story_preview_url }}
              style={{ width: 64, height: 64 }}
              contentFit="cover"
            />
          </Pressable>
        ) : null}
        <Text className={`mb-1.5 text-xs font-semibold ${isMine ? 'text-white/80' : 'text-apple-secondary'}`}>
          Replied to your story
        </Text>
        {message.body ? <Text className={textClass}>{message.body}</Text> : null}
      </View>
    );
  }

  return (
    <View className={`${bubbleShell(isMine)} px-4 py-3`}>
      <Text className={textClass}>{message.body}</Text>
    </View>
  );
}

function DmImageBubble({ uri, isMine }: { uri: string; isMine: boolean }) {
  const width = Math.min(
    Dimensions.get('window').width * DM_BUBBLE_MAX_WIDTH_PCT,
    DM_IMAGE_MAX
  );

  return (
    <Pressable
      onLongPress={() => promptSaveDmImage(uri)}
      delayLongPress={350}
      className={bubbleShell(isMine)}
    >
      <Image source={{ uri }} style={{ width, height: width }} contentFit="cover" />
    </Pressable>
  );
}

function AudioBubble({
  uri,
  durationMs,
  isMine,
}: {
  uri: string;
  durationMs: number | null;
  isMine: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const soundRef = useRef<import('expo-av').Audio.Sound | null>(null);

  async function togglePlay() {
    try {
      const { Audio } = require('expo-av') as typeof import('expo-av');
      if (playing && soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
        setPlaying(false);
        return;
      }
      const { sound } = await Audio.Sound.createAsync({ uri });
      soundRef.current = sound;
      setPlaying(true);
      sound.setOnPlaybackStatusUpdate((status) => {
        if ('didJustFinish' in status && status.didJustFinish) {
          setPlaying(false);
          void sound.unloadAsync();
          soundRef.current = null;
        }
      });
      await sound.playAsync();
    } catch {
      setPlaying(false);
    }
  }

  return (
    <Pressable
      onPress={() => void togglePlay()}
      className={`min-w-[148px] flex-row items-center gap-3 px-4 py-3 ${bubbleShell(isMine)}`}
    >
      <Ionicons name={playing ? 'pause' : 'play'} size={18} color={isMine ? '#fff' : colors.ink} />
      <View className={`h-1 flex-1 max-w-[96px] rounded-full ${isMine ? 'bg-white/40' : 'bg-apple-border'}`} />
      <Text className={`text-sm font-semibold ${isMine ? 'text-white' : 'text-apple-ink'}`}>
        {formatAudioDuration(durationMs)}
      </Text>
    </Pressable>
  );
}
