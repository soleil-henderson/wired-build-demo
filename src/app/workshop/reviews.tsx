import { Stack } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useAuth } from '@/lib/auth-context';
import {
  listWorkshopReviews,
  replyToWorkshopReview,
  type WorkshopReview,
} from '@/lib/workshop-reviews';
import { useFocusData } from '@/lib/use-focus-data';
import { MentionText } from '@/components/social/MentionText';

export default function WorkshopReviewsManageScreen() {
  const { session } = useAuth();
  const [reviews, setReviews] = useState<WorkshopReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    const rows = await listWorkshopReviews(session.user.id);
    setReviews(rows);
    setLoading(false);
  }, [session]);

  useFocusData(
    ({ isInitial }) => {
      if (isInitial && reviews.length === 0) setLoading(true);
      return load();
    },
    [load]
  );

  async function handleReply(reviewId: string) {
    if (!session) return;
    const body = replyDraft[reviewId]?.trim();
    if (!body) return;
    setReplyingId(reviewId);
    try {
      await replyToWorkshopReview(reviewId, session.user.id, body);
      setReplyDraft((d) => ({ ...d, [reviewId]: '' }));
      await load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not reply');
    } finally {
      setReplyingId(null);
    }
  }

  return (
    <ScrollView className="flex-1 bg-apple-bg2" contentContainerClassName="pb-12">
      <Stack.Screen options={{ title: 'Reviews' }} />
      <ScreenHeader subtitle="Reply to customers who left feedback on your workshop." />
      {loading && reviews.length === 0 ? (
        <ActivityIndicator color="#FF6A2B" className="mt-8" />
      ) : reviews.length === 0 ? (
        <Text className="mx-6 mt-6 text-apple-secondary">No reviews yet.</Text>
      ) : (
        <View className="mx-6 mt-4 gap-4">
          {reviews.map((r) => (
            <View key={r.id} className="rounded-2xl border border-apple-border bg-white p-4">
              <View className="flex-row items-center justify-between">
                <Text className="font-semibold text-apple-ink">{r.reviewer.display_name}</Text>
                <Text className="text-accent">{'★'.repeat(r.rating)}</Text>
              </View>
              {r.body ? (
                <MentionText body={r.body} baseClassName="mt-2 text-sm text-apple-secondary" />
              ) : null}
              {r.reply_body ? (
                <View className="mt-3 rounded-xl bg-apple-bg2 p-3">
                  <Text className="text-xs font-semibold text-apple-secondary">Your reply</Text>
                  <Text className="mt-1 text-sm text-apple-ink">{r.reply_body}</Text>
                </View>
              ) : (
                <View className="mt-3">
                  <TextInput
                    value={replyDraft[r.id] ?? ''}
                    onChangeText={(t) => setReplyDraft((d) => ({ ...d, [r.id]: t }))}
                    placeholder="Write a reply…"
                    placeholderTextColor="#A1A1A6"
                    multiline
                    className="min-h-[72px] rounded-xl border border-apple-border px-3 py-2 text-base text-apple-ink"
                  />
                  <Pressable
                    onPress={() => void handleReply(r.id)}
                    disabled={replyingId === r.id}
                    className="mt-2 self-start rounded-lg bg-accent px-3 py-1.5"
                  >
                    <Text className="text-sm font-semibold text-white">Post reply</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
