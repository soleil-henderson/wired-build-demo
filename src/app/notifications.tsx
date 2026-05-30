import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  SectionList,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppleCard } from '@/components/apple/AppleCard';
import { FollowButton } from '@/components/social/FollowButton';
import { useAuth } from '@/lib/auth-context';
import { acceptFollowRequest, declineFollowRequest } from '@/lib/follows';
import {
  deleteNotification,
  listNotificationsEnriched,
  markAllRead,
  markRead,
  type EnrichedNotificationRow,
  type NotificationPayload,
  type NotificationRow,
} from '@/lib/notifications';
import { useTheme } from '@/lib/theme-context';
import { useUnreadNotifications } from '@/lib/unread-notifications-context';
import { colors } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

type NotificationSection = {
  title: string;
  data: EnrichedNotificationRow[];
};

export default function NotificationsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();
  const { refresh: refreshUnread } = useUnreadNotifications();
  const [rows, setRows] = useState<EnrichedNotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(
    async (markReadOnLoad = true) => {
      if (!session) {
        setLoading(false);
        return;
      }
      try {
        const data = await listNotificationsEnriched(session.user.id);
        setRows(data);
        if (markReadOnLoad && data.some((r) => !r.read_at)) {
          await markAllRead(session.user.id);
          await refreshUnread();
          setRows((prev) =>
            prev.map((r) => ({ ...r, read_at: r.read_at ?? new Date().toISOString() }))
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not load notifications';
        Alert.alert('Error', message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [session, refreshUnread]
  );

  useFocusData(
    async ({ isInitial }) => {
      if (isInitial && rows.length === 0) setLoading(true);
      await load();
    },
    [load]
  );

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => notificationMatchesQuery(row, term));
  }, [rows, query]);

  const sections = useMemo(() => groupNotifications(filteredRows), [filteredRows]);

  async function handleOpen(row: NotificationRow) {
    if (!row.read_at) {
      try {
        await markRead(row.id);
        setRows((prev) =>
          prev.map((r) =>
            r.id === row.id ? { ...r, read_at: new Date().toISOString() } : r
          )
        );
        await refreshUnread();
      } catch {
        // non-fatal
      }
    }
    const target = routeFor(row);
    if (target) router.push(target);
  }

  async function handleDismiss(row: NotificationRow) {
    try {
      await deleteNotification(row.id);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      await refreshUnread();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not remove';
      Alert.alert('Error', message);
    }
  }

  const listHeader = (
    <View className="px-4 pb-2 pt-2">
      <AppleCard style={{ padding: 0, overflow: 'hidden' }}>
        <View className="flex-row items-center gap-3 px-4 py-3">
          <Ionicons name="search" size={18} color={theme.colors.tertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search notifications"
            placeholderTextColor={theme.colors.tertiary}
            autoCapitalize="none"
            autoCorrect={false}
            className="flex-1 py-0.5 text-[15px] text-apple-ink"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={theme.colors.tertiary} />
            </Pressable>
          ) : null}
        </View>
      </AppleCard>
    </View>
  );

  if (loading && rows.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-apple-bg2">
        <Stack.Screen options={{ title: 'Notifications' }} />
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-apple-bg2">
      <Stack.Screen options={{ title: 'Notifications' }} />
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={listHeader}
        contentContainerClassName={filteredRows.length === 0 ? 'flex-grow pb-12' : 'pb-12'}
        refreshControl={
          <RefreshControl
            tintColor={colors.accent}
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(false);
            }}
          />
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center px-8 pt-12">
            <View
              className="mb-5 h-[72px] w-[72px] items-center justify-center rounded-full border border-apple-border bg-apple-surface"
            >
              <Ionicons name="heart-outline" size={32} color={theme.colors.ink} />
            </View>
            <Text className="text-xl font-bold text-apple-ink">
              {query.trim() ? 'No matches' : 'Activity On Your Posts'}
            </Text>
            <Text className="mt-2 text-center text-[15px] leading-[22px] text-apple-secondary">
              {query.trim()
                ? 'Try searching by username or notification type.'
                : "When someone likes or comments on your posts, or follows you, you'll see it here."}
            </Text>
          </View>
        }
        renderSectionHeader={({ section: { title } }) => (
          <View className="bg-apple-bg2 px-4 pb-2 pt-4">
            <Text className="text-base font-bold text-apple-ink">{title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <NotificationRowItem
            row={item}
            onPress={() => handleOpen(item)}
            onOpenProfile={() => router.push(`/user/${item.payload.actor_handle}`)}
            onFollowRequestHandled={() => load(false)}
            onLongPress={() => {
              Alert.alert('Remove notification?', undefined, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Remove',
                  style: 'destructive',
                  onPress: () => handleDismiss(item),
                },
              ]);
            }}
          />
        )}
      />
    </View>
  );
}

function NotificationRowItem({
  row,
  onPress,
  onOpenProfile,
  onLongPress,
  onFollowRequestHandled,
}: {
  row: EnrichedNotificationRow;
  onPress: () => void;
  onOpenProfile: () => void;
  onLongPress: () => void;
  onFollowRequestHandled: () => void;
}) {
  const payload = row.payload;
  const handle = payload.actor_handle;
  const unread = !row.read_at;
  const requestId =
    row.type === 'follow_request' && 'request_id' in payload
      ? String(payload.request_id)
      : null;

  return (
    <View
      className="flex-row items-center gap-3 px-4 py-2.5"
      style={{ backgroundColor: unread ? colors.blueSoft : colors.bg2 }}
    >
      <Pressable onPress={onOpenProfile} className="shrink-0 active:opacity-80">
        <AvatarWithBadge type={row.type} payload={payload} />
      </Pressable>

      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        className="min-w-0 flex-1 active:opacity-90"
      >
        <Text className="text-[14px] leading-[19px] text-apple-ink" numberOfLines={3}>
          <Text className="font-semibold">{handle} </Text>
          <Text className="text-apple-ink">{actionText(row)}</Text>
          <Text className="text-apple-secondary"> {formatCompactTime(row.created_at)}</Text>
        </Text>
      </Pressable>

      <View className="shrink-0">
        <NotificationTrailingAction
          row={row}
          requestId={requestId}
          onPress={onPress}
          onFollowRequestHandled={onFollowRequestHandled}
        />
      </View>
    </View>
  );
}

function NotificationTrailingAction({
  row,
  requestId,
  onPress,
  onFollowRequestHandled,
}: {
  row: EnrichedNotificationRow;
  requestId: string | null;
  onPress: () => void;
  onFollowRequestHandled: () => void;
}) {
  const payload = row.payload;

  if (row.type === 'follow_request' && requestId) {
    return <FollowRequestActions requestId={requestId} onDone={onFollowRequestHandled} />;
  }

  if (row.type === 'follow') {
    return (
      <FollowButton userId={payload.actor_id} handle={payload.actor_handle} size="sm" />
    );
  }

  if (row.type === 'reaction') {
    return (
      <Pressable
        onPress={onPress}
        accessibilityLabel="View liked post"
        className="h-11 w-11 items-center justify-center rounded-[10px]"
        style={{ backgroundColor: '#FFE8EA' }}
      >
        <Ionicons name="heart" size={20} color="#FF3040" />
      </Pressable>
    );
  }

  if (row.type === 'comment') {
    return (
      <Pressable
        onPress={onPress}
        accessibilityLabel="View comment"
        className="h-11 w-11 items-center justify-center rounded-[10px]"
        style={{ backgroundColor: colors.blueSoft }}
      >
        <Ionicons name="chatbubble" size={20} color={colors.blue} />
      </Pressable>
    );
  }

  if (row.type === 'ownership_transfer') {
    return (
      <Pressable onPress={onPress} accessibilityLabel="View transferred build">
        <View
          className="h-11 w-11 items-center justify-center rounded-[10px]"
          style={{ backgroundColor: colors.amberSoft }}
        >
          <Ionicons name="car-sport" size={20} color={colors.amber} />
        </View>
      </Pressable>
    );
  }

  if (row.post_thumbnail_url) {
    return (
      <Pressable onPress={onPress} accessibilityLabel="View post">
        <Image
          source={{ uri: row.post_thumbnail_url }}
          className="h-11 w-11 rounded-[10px] bg-apple-bg2"
          resizeMode="cover"
        />
      </Pressable>
    );
  }

  return null;
}

function AvatarWithBadge({
  type,
  payload,
}: {
  type: NotificationRow['type'];
  payload: NotificationPayload;
}) {
  const badge = badgeFor(type);
  const url = payload.actor_avatar_url;
  const letter = (payload.actor_handle || payload.actor_display_name || '?')[0]?.toUpperCase() ?? '?';

  return (
    <View className="relative h-11 w-11 shrink-0">
      {url ? (
        <Image source={{ uri: url }} className="h-11 w-11 rounded-full bg-apple-bg2" />
      ) : (
        <View
          className="h-11 w-11 items-center justify-center rounded-full bg-apple-surface"
        >
          <Text className="text-base font-bold text-apple-secondary">{letter}</Text>
        </View>
      )}
      <View
        className="absolute -bottom-0.5 -right-0.5 h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-apple-bg2"
        style={{ backgroundColor: badge.bg }}
      >
        <Ionicons name={badge.icon} size={11} color="#fff" />
      </View>
    </View>
  );
}

function badgeFor(type: NotificationRow['type']): {
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
} {
  switch (type) {
    case 'reaction':
      return { icon: 'heart', bg: '#FF3040' };
    case 'comment':
      return { icon: 'chatbubble', bg: colors.blue };
    case 'follow':
      return { icon: 'person-add', bg: colors.accent };
    case 'follow_request':
      return { icon: 'person-add', bg: colors.blue };
    case 'follow_accepted':
      return { icon: 'checkmark-circle', bg: colors.green };
    case 'ownership_transfer':
      return { icon: 'car-sport', bg: colors.amber };
    default:
      return { icon: 'notifications', bg: colors.secondary };
  }
}

function notificationMatchesQuery(row: EnrichedNotificationRow, term: string): boolean {
  const payload = row.payload;
  const haystack = [
    payload.actor_handle,
    payload.actor_display_name,
    actionText(row),
    row.type.replace(/_/g, ' '),
    'preview' in payload && payload.preview ? payload.preview : '',
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(term);
}

function actionText(row: NotificationRow): string {
  switch (row.type) {
    case 'follow':
      return 'started following you.';
    case 'follow_request':
      return 'requested to follow you.';
    case 'follow_accepted':
      return 'accepted your follow request.';
    case 'reaction':
      return 'liked your post.';
    case 'comment': {
      const preview =
        'preview' in row.payload && row.payload.preview
          ? `: "${row.payload.preview.trim()}"`
          : '';
      const isReply = 'is_reply' in row.payload && row.payload.is_reply;
      return isReply
        ? `replied to your comment${preview}.`
        : `commented on your post${preview}.`;
    }
    case 'ownership_transfer':
      return 'transferred a build to you.';
    case 'price_alert':
      return 'price alert on a saved part.';
    case 'verification':
      return 'verification status updated.';
    default:
      return 'sent you a notification.';
  }
}

function routeFor(
  row: NotificationRow
): `/post/${string}` | `/user/${string}` | `/vehicle/${string}` | null {
  if (row.type === 'follow' || row.type === 'follow_request' || row.type === 'follow_accepted') {
    return `/user/${row.payload.actor_handle}`;
  }
  if (row.type === 'ownership_transfer' && 'vehicle_id' in row.payload) {
    return `/vehicle/${(row.payload as { vehicle_id: string }).vehicle_id}`;
  }
  if ('post_id' in row.payload) {
    return `/post/${row.payload.post_id}`;
  }
  return null;
}

function groupNotifications(rows: EnrichedNotificationRow[]): NotificationSection[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 7);

  const today: EnrichedNotificationRow[] = [];
  const week: EnrichedNotificationRow[] = [];
  const earlier: EnrichedNotificationRow[] = [];

  const sorted = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));

  for (const row of sorted) {
    const d = new Date(row.created_at);
    if (d >= startOfToday) {
      today.push(row);
    } else if (d >= startOfWeek) {
      week.push(row);
    } else {
      earlier.push(row);
    }
  }

  return [
    { title: 'Today', data: today },
    { title: 'This week', data: week },
    { title: 'Earlier', data: earlier },
  ].filter((s) => s.data.length > 0);
}

function FollowRequestActions({
  requestId,
  onDone,
}: {
  requestId: string;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function accept() {
    setBusy(true);
    try {
      await acceptFollowRequest(requestId);
      onDone();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not accept');
    } finally {
      setBusy(false);
    }
  }

  async function decline() {
    setBusy(true);
    try {
      await declineFollowRequest(requestId);
      onDone();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not decline');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="flex-row gap-2">
      <Pressable
        onPress={() => void accept()}
        disabled={busy}
        className="rounded-lg bg-accent px-3 py-1.5 active:opacity-90 disabled:opacity-60"
      >
        <Text className="text-xs font-semibold text-white">Confirm</Text>
      </Pressable>
      <Pressable
        onPress={() => void decline()}
        disabled={busy}
        className="rounded-lg border border-apple-border bg-apple-surface px-3 py-1.5 active:opacity-80 disabled:opacity-60"
      >
        <Text className="text-xs font-semibold text-apple-ink">Delete</Text>
      </Pressable>
    </View>
  );
}

/** Instagram-style compact time: 2m, 5h, 3d, 2w */
function formatCompactTime(iso: string): string {
  try {
    const ms = Date.now() - new Date(iso).getTime();
    const s = Math.floor(ms / 1000);
    if (s < 60) return 'now';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d`;
    const w = Math.floor(d / 7);
    if (w < 5) return `${w}w`;
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}
