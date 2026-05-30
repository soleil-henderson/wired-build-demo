import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ProfileAvatar } from '@/components/social/ProfileAvatar';
import {
  inviteUserToEvent,
  listEventInvites,
  removeEventInvite,
  type EventInviteRow,
} from '@/lib/events';
import { searchUsers, type UserSearchResult } from '@/lib/explore';
import { showAppAlert } from '@/lib/app-alert';
import { colors, inputClassName } from '@/lib/theme';

type Props = {
  visible: boolean;
  eventId: string;
  hostId: string;
  onClose: () => void;
  onChanged?: () => void;
};

export function EventInviteSheet({
  visible,
  eventId,
  hostId,
  onClose,
  onChanged,
}: Props) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<UserSearchResult[]>([]);
  const [invites, setInvites] = useState<EventInviteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const token = useRef(0);

  const loadInvites = useCallback(async () => {
    setLoading(true);
    try {
      setInvites(await listEventInvites(eventId));
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (visible) {
      setQuery('');
      setHits([]);
      void loadInvites();
    }
  }, [visible, loadInvites]);

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
        if (token.current === t) setHits(users);
      } catch {
        if (token.current === t) setHits([]);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  const invitedIds = new Set(invites.map((i) => i.user_id));

  async function handleInvite(user: UserSearchResult) {
    setBusy(user.id);
    try {
      await inviteUserToEvent(eventId, hostId, user.id);
      await loadInvites();
      onChanged?.();
      setQuery('');
      setHits([]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not invite';
      showAppAlert('Invite failed', message);
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove(userId: string) {
    setBusy(userId);
    try {
      await removeEventInvite(eventId, userId);
      await loadInvites();
      onChanged?.();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-apple-bg2 pt-4">
        <View className="flex-row items-center justify-between px-4 pb-3">
          <Text className="text-lg font-bold text-apple-ink">Invite people</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text className="font-semibold text-signal-blue">Done</Text>
          </Pressable>
        </View>

        <View className="px-4">
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by handle or name"
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
                onPress={() => void handleInvite(u)}
                disabled={busy === u.id || invitedIds.has(u.id)}
                className={`flex-row items-center gap-3 px-3 py-3 active:bg-apple-bg2 ${
                  i < hits.length - 1 ? 'border-b border-apple-border' : ''
                }`}
              >
                <ProfileAvatar uri={u.avatar_url} name={u.display_name} size={36} />
                <View className="min-w-0 flex-1">
                  <Text className="font-semibold text-apple-ink">{u.display_name}</Text>
                  <Text className="text-xs text-apple-secondary">@{u.handle}</Text>
                </View>
                {invitedIds.has(u.id) ? (
                  <Text className="text-xs font-semibold text-apple-tertiary">Invited</Text>
                ) : busy === u.id ? (
                  <ActivityIndicator color={colors.accent} size="small" />
                ) : (
                  <Ionicons name="person-add-outline" size={20} color={colors.blue} />
                )}
              </Pressable>
            ))}
          </View>
        ) : null}

        <Text className="mx-4 mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-apple-secondary">
          Invited ({invites.length})
        </Text>
        {loading ? (
          <ActivityIndicator color={colors.accent} className="mt-4" />
        ) : invites.length === 0 ? (
          <Text className="mx-4 text-sm text-apple-secondary">
            No invites yet — search above to invite people (required for private events to see the listing).
          </Text>
        ) : (
          <View className="mx-4 rounded-xl border border-apple-border bg-white">
            {invites.map((inv, i) => (
              <View
                key={inv.user_id}
                className={`flex-row items-center gap-3 px-3 py-3 ${
                  i < invites.length - 1 ? 'border-b border-apple-border' : ''
                }`}
              >
                <ProfileAvatar uri={inv.avatar_url} name={inv.display_name} size={36} />
                <View className="min-w-0 flex-1">
                  <Text className="font-semibold text-apple-ink">{inv.display_name}</Text>
                  <Text className="text-xs text-apple-secondary">@{inv.handle}</Text>
                </View>
                <Pressable
                  onPress={() => void handleRemove(inv.user_id)}
                  disabled={busy === inv.user_id}
                  hitSlop={8}
                >
                  <Ionicons name="close-circle-outline" size={22} color={colors.tertiary} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}
