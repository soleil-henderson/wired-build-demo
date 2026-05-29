import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Switch, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth-context';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from '@/lib/notification-preferences';

export default function NotificationSettingsScreen() {
  const { session } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) return;
    const p = await getNotificationPreferences(session.user.id);
    setPrefs(p);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(
    key: keyof Omit<NotificationPreferences, 'user_id'>,
    value: boolean
  ) {
    if (!session || !prefs) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    await updateNotificationPreferences(session.user.id, { [key]: value });
  }

  if (loading || !prefs) {
    return (
      <View className="flex-1 items-center justify-center bg-apple-bg2">
        <Stack.Screen options={{ title: 'Notifications' }} />
        <ActivityIndicator color="#FF6A2B" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-apple-bg2 px-6 pt-6">
      <Stack.Screen options={{ title: 'Notifications' }} />
      <Text className="text-apple-secondary">Choose which alerts you receive as push notifications.</Text>
      <View className="mt-6 gap-4">
        <PrefRow
          label="New followers"
          value={prefs.follows_enabled}
          onChange={(v) => toggle('follows_enabled', v)}
        />
        <PrefRow
          label="Reactions on your posts"
          value={prefs.reactions_enabled}
          onChange={(v) => toggle('reactions_enabled', v)}
        />
        <PrefRow
          label="Comments"
          value={prefs.comments_enabled}
          onChange={(v) => toggle('comments_enabled', v)}
        />
        <PrefRow
          label="Ownership transfers"
          value={prefs.ownership_transfers_enabled}
          onChange={(v) => toggle('ownership_transfers_enabled', v)}
        />
      </View>
    </View>
  );
}

function PrefRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View className="flex-row items-center justify-between rounded-xl border border-apple-border bg-white px-4 py-3">
      <Text className="text-apple-ink">{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: '#F5A524' }} />
    </View>
  );
}
