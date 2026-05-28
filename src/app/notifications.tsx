import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/lib/auth-context';
import {
  listNotifications,
  markAllRead,
  markRead,
  type NotificationPayload,
  type NotificationRow,
} from '@/lib/notifications';

export default function NotificationsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (markRead = true) => {
      if (!session) {
        setLoading(false);
        return;
      }
      try {
        const data = await listNotifications(session.user.id);
        setRows(data);
        if (markRead && data.some((r) => !r.read_at)) {
          await markAllRead(session.user.id);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not load notifications';
        Alert.alert('Error', message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [session]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleOpen(row: NotificationRow) {
    if (!row.read_at) {
      try {
        await markRead(row.id);
      } catch {
        // silent — visiting the inbox already marks-all-read on load
      }
    }
    const target = routeFor(row);
    if (target) router.push(target);
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-ink-950">
        <Stack.Screen options={{ title: 'Notifications' }} />
        <ActivityIndicator color="#F5A524" />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-ink-950"
      contentContainerClassName="pb-12"
      refreshControl={
        <RefreshControl
          tintColor="#F5A524"
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load(false);
          }}
        />
      }
    >
      <Stack.Screen options={{ title: 'Notifications' }} />

      {rows.length === 0 ? (
        <View className="mx-6 mt-12 rounded-2xl border border-ink-700 bg-ink-900 p-6">
          <Text className="text-base font-semibold text-ink-200">All caught up</Text>
          <Text className="mt-1 text-ink-300">
            New follows, comments and likes on your posts will land here.
          </Text>
        </View>
      ) : (
        <View>
          {rows.map((row, idx) => (
            <Pressable
              key={row.id}
              onPress={() => handleOpen(row)}
              className={`flex-row gap-3 border-b border-ink-700/60 px-5 py-4 ${
                row.read_at ? '' : 'bg-ink-900'
              } ${idx === 0 ? 'border-t border-ink-700/60' : ''} active:bg-ink-800`}
            >
              <NotificationAvatar payload={row.payload} />
              <View className="flex-1">
                <Text className="text-sm text-ink-200">
                  <Actor payload={row.payload} />
                  <Text> </Text>
                  <Text>{labelFor(row)}</Text>
                </Text>
                {previewFor(row) ? (
                  <Text className="mt-1 text-sm text-ink-300" numberOfLines={2}>
                    {previewFor(row)}
                  </Text>
                ) : null}
                <Text className="mt-1 text-[11px] text-ink-300">
                  {formatRelative(row.created_at)}
                </Text>
              </View>
              {!row.read_at ? (
                <View className="mt-2 h-2 w-2 rounded-full bg-accent" />
              ) : null}
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function NotificationAvatar({ payload }: { payload: NotificationPayload }) {
  const url = payload.actor_avatar_url;
  if (url) {
    return <Image source={{ uri: url }} className="h-10 w-10 rounded-full bg-ink-700" />;
  }
  const letter = (payload.actor_display_name || payload.actor_handle || '?')[0].toUpperCase();
  return (
    <View className="h-10 w-10 items-center justify-center rounded-full bg-ink-700">
      <Text className="font-bold text-white">{letter}</Text>
    </View>
  );
}

function Actor({ payload }: { payload: NotificationPayload }) {
  return <Text className="font-semibold text-white">{payload.actor_display_name}</Text>;
}

function labelFor(row: NotificationRow): string {
  switch (row.type) {
    case 'follow':
      return 'started following you.';
    case 'reaction':
      return 'liked your post.';
    case 'comment': {
      const isReply = 'is_reply' in row.payload && row.payload.is_reply;
      return isReply ? 'replied to your comment.' : 'commented on your post.';
    }
    case 'price_alert':
      return 'price alert.';
    case 'verification':
      return 'verification update.';
    default:
      return '';
  }
}

function previewFor(row: NotificationRow): string | null {
  if (row.type === 'comment' && 'preview' in row.payload) {
    return row.payload.preview;
  }
  return null;
}

function routeFor(row: NotificationRow): `/post/${string}` | `/user/${string}` | null {
  if (row.type === 'follow') {
    return `/user/${row.payload.actor_handle}`;
  }
  if ('post_id' in row.payload) {
    return `/post/${row.payload.post_id}`;
  }
  return null;
}

function formatRelative(iso: string) {
  try {
    const ms = Date.now() - new Date(iso).getTime();
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}
