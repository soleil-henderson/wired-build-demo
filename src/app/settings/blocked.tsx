import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';

import { ProfileAvatar } from '@/components/social/ProfileAvatar';
import { useAuth } from '@/lib/auth-context';
import { listBlockedUsers, unblockUser, type BlockedUser } from '@/lib/blocks';
import { colors } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

export default function BlockedAccountsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) {
      setLoading(false);
      return;
    }
    try {
      const rows = await listBlockedUsers(session.user.id);
      setBlocked(rows);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not load blocked accounts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useFocusData(
    ({ isInitial }) => {
      if (isInitial && blocked.length === 0) setLoading(true);
      return load();
    },
    [load]
  );

  function confirmUnblock(user: BlockedUser) {
    if (!session) return;
    Alert.alert(
      'Unblock account?',
      `@${user.handle} will be able to see your profile and interact with you again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            setUnblockingId(user.id);
            try {
              await unblockUser(session.user.id, user.id);
              setBlocked((current) => current.filter((b) => b.id !== user.id));
            } catch (err) {
              Alert.alert(
                'Unblock failed',
                err instanceof Error ? err.message : 'Could not unblock user'
              );
            } finally {
              setUnblockingId(null);
            }
          },
        },
      ]
    );
  }

  if (loading && blocked.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-apple-bg2">
        <Stack.Screen options={{ title: 'Blocked accounts' }} />
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-apple-bg2">
      <Stack.Screen options={{ title: 'Blocked accounts' }} />

      {blocked.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-white">
            <Ionicons name="hand-left-outline" size={28} color={colors.tertiary} />
          </View>
          <Text className="text-lg font-semibold text-apple-ink">No blocked accounts</Text>
          <Text className="mt-2 text-center text-sm text-apple-secondary">
            When you block someone, they won&apos;t appear here until you block them from their
            profile.
          </Text>
        </View>
      ) : (
        <>
          <Text className="px-4 pb-3 pt-4 text-sm text-apple-secondary">
            Blocked people can&apos;t see your posts, message you, or follow you.
          </Text>
          <FlatList
            data={blocked}
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
              <View className="flex-row items-center gap-3 border-b border-apple-border bg-white px-4 py-3.5">
                <Pressable
                  onPress={() => router.push(`/user/${item.handle}`)}
                  className="min-w-0 flex-1 flex-row items-center gap-3 active:opacity-80"
                >
                  <ProfileAvatar
                    uri={item.avatar_url}
                    name={item.display_name}
                    size={48}
                    borderWidth={0}
                  />
                  <View className="min-w-0 flex-1">
                    <Text className="font-semibold text-apple-ink" numberOfLines={1}>
                      {item.display_name}
                    </Text>
                    <Text className="text-sm text-apple-secondary">@{item.handle}</Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => confirmUnblock(item)}
                  disabled={unblockingId === item.id}
                  className="rounded-lg border border-apple-border px-3 py-1.5 active:bg-apple-bg2 disabled:opacity-60"
                >
                  {unblockingId === item.id ? (
                    <ActivityIndicator color={colors.accent} size="small" />
                  ) : (
                    <Text className="text-sm font-semibold text-apple-ink">Unblock</Text>
                  )}
                </Pressable>
              </View>
            )}
          />
        </>
      )}
    </View>
  );
}
