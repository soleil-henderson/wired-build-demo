import { Stack } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useAuth } from '@/lib/auth-context';
import {
  listWorkshopEnquiries,
  updateEnquiryStatus,
  type WorkshopEnquiry,
} from '@/lib/workshop-enquiries';
import { colors } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

export default function WorkshopEnquiriesScreen() {
  const { session } = useAuth();
  const [items, setItems] = useState<WorkshopEnquiry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) return;
    const rows = await listWorkshopEnquiries(session.user.id);
    setItems(rows);
    setLoading(false);
  }, [session]);

  useFocusData(
    ({ isInitial }) => {
      if (isInitial && items.length === 0) setLoading(true);
      return load();
    },
    [load]
  );

  return (
    <ScrollView className="flex-1 bg-apple-bg2" contentContainerClassName="pb-12">
      <Stack.Screen options={{ title: 'Enquiries' }} />
      <ScreenHeader subtitle="Quote requests from your public workshop profile." />
      {loading && items.length === 0 ? (
        <ActivityIndicator color={colors.accent} className="mt-8" />
      ) : items.length === 0 ? (
        <Text className="mx-6 mt-6 text-apple-secondary">No enquiries yet.</Text>
      ) : (
        <View className="mx-6 mt-4 gap-3">
          {items.map((e) => (
            <View key={e.id} className="rounded-2xl border border-apple-border bg-white p-4">
              <View className="flex-row items-center justify-between">
                <Text className="font-semibold text-apple-ink">{e.sender_name}</Text>
                <Text
                  className={`text-xs font-semibold uppercase ${
                    e.status === 'new' ? 'text-accent' : 'text-apple-tertiary'
                  }`}
                >
                  {e.status}
                </Text>
              </View>
              <Pressable onPress={() => Linking.openURL(`mailto:${e.sender_email}`)}>
                <Text className="mt-1 text-sm text-accent">{e.sender_email}</Text>
              </Pressable>
              {e.sender_phone ? (
                <Pressable onPress={() => Linking.openURL(`tel:${e.sender_phone}`)}>
                  <Text className="text-sm text-apple-secondary">{e.sender_phone}</Text>
                </Pressable>
              ) : null}
              <Text className="mt-2 text-sm text-apple-secondary">{e.message}</Text>
              {e.status === 'new' && session ? (
                <Pressable
                  onPress={async () => {
                    await updateEnquiryStatus(e.id, session.user.id, 'read');
                    load();
                  }}
                  className="mt-3 self-start"
                >
                  <Text className="text-sm font-semibold text-signal-blue">Mark read</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
