import { Stack, useFocusEffect } from 'expo-router';
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
import { useAuth } from '@/lib/auth-context';
import { listSavedSearches, removeSavedSearch, type SavedSearch } from '@/lib/saved-searches';

export default function SavedSearchesScreen() {
  const { session } = useAuth();
  const [items, setItems] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const list = await listSavedSearches(session.user.id);
      setItems(list);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  return (
    <ScrollView className="flex-1 bg-ink-950" contentContainerClassName="pb-12">
      <Stack.Screen options={{ title: 'Saved searches' }} />
      <ScreenHeader
        eyebrow="EXPLORE"
        title="Saved searches"
        subtitle="Member perk — quick access to Explore queries you saved."
      />
      {loading ? (
        <ActivityIndicator color="#F5A524" className="mt-8" />
      ) : items.length === 0 ? (
        <Text className="mx-6 mt-6 text-ink-300">
          No saved searches yet. Run a search on Explore and tap Save this search.
        </Text>
      ) : (
        <View className="mx-6 mt-6 gap-2">
          {items.map((item) => (
            <View
              key={item.id}
              className="flex-row items-center justify-between rounded-xl border border-ink-700 bg-ink-900 px-4 py-3"
            >
              <Text className="flex-1 font-medium text-white">{item.query}</Text>
              <Pressable
                onPress={() => {
                  Alert.alert('Remove search?', item.query, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Remove',
                      style: 'destructive',
                      onPress: async () => {
                        await removeSavedSearch(item.id);
                        await load();
                      },
                    },
                  ]);
                }}
              >
                <Text className="text-signal-red text-sm">Remove</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
