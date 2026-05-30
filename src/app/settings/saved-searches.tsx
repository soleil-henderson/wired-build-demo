import { Stack, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useSubscriptionTier } from '@/hooks/use-subscription-tier';
import { useAuth } from '@/lib/auth-context';
import { listSavedSearches, removeSavedSearch, type SavedSearch } from '@/lib/saved-searches';
import { canSaveSearches } from '@/lib/subscription';
import { useFocusData } from '@/lib/use-focus-data';

export default function SavedSearchesScreen() {
  const { session } = useAuth();
  const { tier, loading: tierLoading } = useSubscriptionTier();
  const router = useRouter();
  const [items, setItems] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) return;
    if (!canSaveSearches(tier)) {
      setItems([]);
      setLoading(false);
      return;
    }
    try {
      const list = await listSavedSearches(session.user.id);
      setItems(list);
    } finally {
      setLoading(false);
    }
  }, [session, tier]);

  useFocusData(
    ({ isInitial }) => {
      if (isInitial && items.length === 0) setLoading(true);
      return load();
    },
    [load]
  );

  if (!tierLoading && !canSaveSearches(tier)) {
    return (
      <ScrollView className="flex-1 bg-apple-bg2" contentContainerClassName="pb-12">
        <Stack.Screen options={{ title: 'Saved searches' }} />
        <ScreenHeader subtitle="Member perk — quick access to Explore queries you saved." />
        <View className="mx-6 mt-8 gap-4">
          <Text className="text-apple-secondary">
            Saved searches are available on Member ($5/mo) and above. Upgrade to save Explore
            queries and reopen them from Settings.
          </Text>
          <Pressable
            onPress={() => router.push('/profile/subscription')}
            className="self-start rounded-xl bg-accent px-4 py-2.5"
          >
            <Text className="font-semibold text-white">View plans</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1 bg-apple-bg2" contentContainerClassName="pb-12">
      <Stack.Screen options={{ title: 'Saved searches' }} />
      <ScreenHeader subtitle="Member perk — quick access to Explore queries you saved." />
      {loading && items.length === 0 ? (
        <ActivityIndicator color="#FF6A2B" className="mt-8" />
      ) : items.length === 0 ? (
        <Text className="mx-6 mt-6 text-apple-secondary">
          No saved searches yet. Run a search on Explore and tap Save this search.
        </Text>
      ) : (
        <View className="mx-6 mt-6 gap-2">
          {items.map((item) => (
            <View
              key={item.id}
              className="flex-row items-center justify-between rounded-xl border border-apple-border bg-white px-4 py-3"
            >
              <Text className="flex-1 font-medium text-apple-ink">{item.query}</Text>
              <Pressable
                onPress={() => {
                  Alert.alert('Remove search?', item.query, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Remove',
                      style: 'destructive',
                      onPress: async () => {
                        await removeSavedSearch(item.id);
                        load();
                      },
                    },
                  ]);
                }}
              >
                <Text className="text-sm font-semibold text-signal-red">Remove</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
