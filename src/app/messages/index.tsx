import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ProfileAvatar } from '@/components/social/ProfileAvatar';
import { useAuth } from '@/lib/auth-context';
import {
  formatMessageTime,
  listConversations,
  type ConversationPreview,
} from '@/lib/messages';
import { useUnreadMessages } from '@/lib/unread-messages-context';
import { colors } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

export default function MessagesInboxScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const { refresh: refreshUnread } = useUnreadMessages();
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    if (!session) {
      setLoading(false);
      return;
    }
    try {
      const rows = await listConversations(session.user.id);
      setConversations(rows);
      await refreshUnread();
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session, refreshUnread]);

  useFocusData(
    async ({ isInitial }) => {
      if (isInitial && conversations.length === 0) setLoading(true);
      await load();
    },
    [load]
  );

  const filtered = query.trim()
    ? conversations.filter(
        (c) =>
          c.peer.handle.toLowerCase().includes(query.trim().toLowerCase()) ||
          c.peer.display_name.toLowerCase().includes(query.trim().toLowerCase())
      )
    : conversations;

  return (
    <View className="flex-1 bg-apple-bg2">
      <Stack.Screen
        options={{
          title: session?.user.email ? `@${session.user.email.split('@')[0]}` : 'Messages',
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/messages/new')}
              hitSlop={8}
              className="mr-1 active:opacity-70"
            >
              <Ionicons name="create-outline" size={24} color={colors.ink} />
            </Pressable>
          ),
        }}
      />

      <View className="px-4 py-2">
        <View className="flex-row items-center rounded-xl bg-apple-bg2 px-3">
          <Ionicons name="search" size={16} color={colors.tertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor={colors.tertiary}
            autoCapitalize="none"
            autoCorrect={false}
            className="ml-2 flex-1 py-2.5 text-[15px] text-apple-ink"
          />
        </View>
      </View>

      {loading && conversations.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : filtered.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="paper-plane-outline" size={48} color={colors.tertiary} />
          <Text className="mt-4 text-lg font-semibold text-apple-ink">Your messages</Text>
          <Text className="mt-2 text-center text-sm text-apple-secondary">
            Send private photos and messages to builders you follow.
          </Text>
          <Pressable
            onPress={() => router.push('/messages/new')}
            className="mt-5 rounded-lg bg-accent px-5 py-2.5 active:opacity-90"
          >
            <Text className="font-semibold text-white">Send message</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              tintColor={colors.accent}
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          renderItem={({ item }) => (
            <ConversationRow
              item={item}
              onPress={() => router.push(`/messages/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  );
}

function ConversationRow({
  item,
  onPress,
}: {
  item: ConversationPreview;
  onPress: () => void;
}) {
  const preview = item.last_message_body ?? 'Say hello';
  const time = formatMessageTime(item.last_message_at);
  const unread = item.unread_count > 0;

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 border-b border-apple-border px-4 py-3 active:bg-apple-bg2"
    >
      <ProfileAvatar uri={item.peer.avatar_url} name={item.peer.display_name} size={56} borderWidth={0} />
      <View className="min-w-0 flex-1">
        <Text className={`text-[15px] ${unread ? 'font-bold' : 'font-semibold'} text-apple-ink`}>
          {item.peer.display_name}
        </Text>
        <Text
          className={`mt-0.5 text-sm ${unread ? 'font-semibold text-apple-ink' : 'text-apple-secondary'}`}
          numberOfLines={1}
        >
          {preview}
        </Text>
      </View>
      <View className="items-end">
        <Text className={`text-xs ${unread ? 'font-semibold text-accent' : 'text-apple-tertiary'}`}>
          {time}
        </Text>
        {unread ? <View className="mt-1.5 h-2 w-2 rounded-full bg-accent" /> : null}
      </View>
    </Pressable>
  );
}
