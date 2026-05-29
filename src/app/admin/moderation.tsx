import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/lib/auth-context';
import { approvePart, isCurrentUserAdmin, listPendingParts } from '@/lib/admin';
import type { Part } from '@/lib/parts';

export default function ModerationScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) return;
    const admin = await isCurrentUserAdmin(session.user.id);
    setAllowed(admin);
    if (!admin) {
      setLoading(false);
      return;
    }
    const list = await listPendingParts();
    setParts(list);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleApprove(partId: string) {
    try {
      await approvePart(partId);
      setParts((p) => p.filter((x) => x.id !== partId));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not approve';
      Alert.alert('Error', message);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-apple-bg2">
        <Stack.Screen options={{ title: 'Moderation' }} />
        <ActivityIndicator color="#FF6A2B" />
      </View>
    );
  }

  if (!allowed) {
    return (
      <View className="flex-1 items-center justify-center bg-apple-bg2 px-6">
        <Stack.Screen options={{ title: 'Moderation' }} />
        <Text className="text-center text-apple-secondary">Admin access required.</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-accent">Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-apple-bg2" contentContainerClassName="px-6 py-6 pb-24">
      <Stack.Screen options={{ title: 'Moderation' }} />
      <Text className="text-2xl font-bold text-apple-ink">Custom parts queue</Text>
      {parts.length === 0 ? (
        <Text className="mt-4 text-apple-secondary">No pending submissions.</Text>
      ) : (
        parts.map((p) => (
          <View
            key={p.id}
            className="mt-4 rounded-2xl border border-apple-border bg-white p-4"
          >
            <Text className="font-semibold text-apple-ink">
              {p.brand} — {p.name}
            </Text>
            <Text className="mt-1 text-xs uppercase text-apple-secondary">{p.category}</Text>
            <Pressable
              onPress={() => handleApprove(p.id)}
              className="mt-3 self-start rounded-lg bg-accent px-4 py-2"
            >
              <Text className="font-semibold text-white">Approve</Text>
            </Pressable>
          </View>
        ))
      )}
    </ScrollView>
  );
}
