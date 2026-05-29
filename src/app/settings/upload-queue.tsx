import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import {
  clearQueuedModPhotoUploads,
  listQueuedModPhotoUploads,
  processQueuedModPhotoUploads,
  type QueuedModPhoto,
} from '@/lib/offline-queue';

export default function UploadQueueScreen() {
  const [queue, setQueue] = useState<QueuedModPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const items = await listQueuedModPhotoUploads();
    setQueue(items);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleRetry() {
    setRetrying(true);
    try {
      const n = await processQueuedModPhotoUploads();
      await refresh();
      Alert.alert('Uploads', n > 0 ? `${n} photo(s) uploaded.` : 'No uploads completed.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Retry failed';
      Alert.alert('Error', message);
    } finally {
      setRetrying(false);
    }
  }

  async function handleClear() {
    await clearQueuedModPhotoUploads();
    await refresh();
  }

  return (
    <ScrollView className="flex-1 bg-ink-950" contentContainerClassName="pb-12">
      <Stack.Screen options={{ title: 'Pending uploads' }} />
      <ScreenHeader
        eyebrow="SETTINGS"
        title="Pending photo uploads"
        subtitle="Photos saved offline while logging a mod. Retry when you are back online."
      />

      {loading ? (
        <ActivityIndicator className="mt-8" color="#F5A524" />
      ) : queue.length === 0 ? (
        <Text className="mx-6 mt-6 text-ink-300">No pending uploads.</Text>
      ) : (
        <View className="mx-6 mt-6 gap-2">
          {queue.map((item, i) => (
            <View
              key={`${item.modId}-${i}`}
              className="rounded-xl border border-ink-700 bg-ink-900 px-4 py-3"
            >
              <Text className="text-white">Mod {item.modId.slice(0, 8)}…</Text>
              <Text className="mt-1 text-xs text-ink-300">
                Queued {new Date(item.createdAt).toLocaleString()}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View className="mx-6 mt-8 gap-3">
        <Pressable
          onPress={handleRetry}
          disabled={retrying || queue.length === 0}
          className="rounded-xl bg-accent py-3 active:bg-accent-dark disabled:opacity-50"
        >
          <Text className="text-center font-semibold text-ink-950">
            {retrying ? 'Retrying…' : 'Retry all uploads'}
          </Text>
        </Pressable>
        {queue.length > 0 ? (
          <Pressable
            onPress={() =>
              Alert.alert('Clear queue?', 'Remove pending uploads without uploading.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Clear', style: 'destructive', onPress: handleClear },
              ])
            }
            className="rounded-xl border border-ink-700 py-3"
          >
            <Text className="text-center font-semibold text-ink-200">Clear queue</Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}
