import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { ProfileAvatar } from '@/components/social/ProfileAvatar';
import { shareEventInDm, type EventSummary } from '@/lib/events';
import { searchUsers, type UserSearchResult } from '@/lib/explore';
import { showAppAlert } from '@/lib/app-alert';
import { colors, inputClassName } from '@/lib/theme';

type Props = {
  visible: boolean;
  event: EventSummary;
  fromUserId: string;
  onClose: () => void;
};

export function EventShareSheet({ visible, event, fromUserId, onClose }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const [hits, setHits] = useState<UserSearchResult[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const token = useRef(0);

  useEffect(() => {
    if (visible) {
      setQuery('');
      setNote('');
      setHits([]);
    }
  }, [visible]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    const t = ++token.current;
    const handle = setTimeout(async () => {
      try {
        const users = await searchUsers(term, 8);
        if (token.current === t) {
          setHits(users.filter((u) => u.id !== fromUserId));
        }
      } catch {
        if (token.current === t) setHits([]);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query, fromUserId]);

  const share = useCallback(
    async (user: UserSearchResult) => {
      setBusy(user.id);
      try {
        const conversationId = await shareEventInDm({
          eventId: event.id,
          fromUserId,
          toUserId: user.id,
          note: note.trim() || null,
          event,
        });
        onClose();
        router.push(`/messages/${conversationId}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not share';
        showAppAlert('Share failed', message);
      } finally {
        setBusy(null);
      }
    },
    [event, fromUserId, note, onClose, router]
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-apple-bg2 pt-4">
        <View className="flex-row items-center justify-between px-4 pb-3">
          <Text className="text-lg font-bold text-apple-ink">Share in message</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text className="font-semibold text-signal-blue">Cancel</Text>
          </Pressable>
        </View>

        <Text className="mx-4 mb-3 text-sm text-apple-secondary" numberOfLines={2}>
          {event.title}
          {event.is_private ? ' · Invites will be sent automatically' : ''}
        </Text>

        <View className="px-4">
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Add a note (optional)"
            placeholderTextColor={colors.tertiary}
            className={`${inputClassName} mb-3`}
          />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search who to send to"
            placeholderTextColor={colors.tertiary}
            autoCapitalize="none"
            autoCorrect={false}
            className={inputClassName}
          />
        </View>

        {hits.length > 0 ? (
          <View className="mx-4 mt-3 rounded-xl border border-apple-border bg-white">
            {hits.map((u, i) => (
              <Pressable
                key={u.id}
                onPress={() => void share(u)}
                disabled={busy === u.id}
                className={`flex-row items-center gap-3 px-3 py-3 active:bg-apple-bg2 ${
                  i < hits.length - 1 ? 'border-b border-apple-border' : ''
                }`}
              >
                <ProfileAvatar uri={u.avatar_url} name={u.display_name} size={36} />
                <View className="min-w-0 flex-1">
                  <Text className="font-semibold text-apple-ink">{u.display_name}</Text>
                  <Text className="text-xs text-apple-secondary">@{u.handle}</Text>
                </View>
                {busy === u.id ? (
                  <ActivityIndicator color={colors.accent} size="small" />
                ) : (
                  <Text className="text-sm font-semibold text-signal-blue">Send</Text>
                )}
              </Pressable>
            ))}
          </View>
        ) : (
          <Text className="mx-4 mt-4 text-sm text-apple-secondary">
            Type at least 2 characters to find someone.
          </Text>
        )}
      </View>
    </Modal>
  );
}
