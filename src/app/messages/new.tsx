import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ProfileAvatar } from '@/components/social/ProfileAvatar';
import { KeyboardSafeView } from '@/components/ui/KeyboardSafeView';
import { useAuth } from '@/lib/auth-context';
import { searchUsers, type UserSearchResult } from '@/lib/explore';
import { getOrCreateConversation } from '@/lib/messages';
import { colors } from '@/lib/theme';

export default function NewMessageScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);

  const runSearch = useCallback(async (term: string) => {
    if (!term.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const hits = await searchUsers(term, 12);
      setResults(hits.filter((u) => u.id !== session?.user.id));
    } finally {
      setSearching(false);
    }
  }, [session?.user.id]);

  async function startChat(user: UserSearchResult) {
    if (!session) return;
    setStarting(user.id);
    try {
      const conversationId = await getOrCreateConversation(user.id);
      router.replace(`/messages/${conversationId}`);
    } catch (err) {
      Alert.alert(
        'Could not start chat',
        err instanceof Error ? err.message : 'Try again.'
      );
    } finally {
      setStarting(null);
    }
  }

  return (
    <KeyboardSafeView className="flex-1 bg-white">
      <Stack.Screen options={{ title: 'New message' }} />

      <View className="border-b border-apple-border px-4 py-3">
        <View className="flex-row items-center">
          <Text className="mr-2 text-base text-apple-ink">To:</Text>
          <TextInput
            value={query}
            onChangeText={(v) => {
              setQuery(v);
              void runSearch(v);
            }}
            placeholder="Search people"
            placeholderTextColor={colors.tertiary}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            className="flex-1 py-1 text-base text-apple-ink"
          />
        </View>
      </View>

      {searching ? (
        <View className="items-center py-8">
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => void startChat(item)}
              disabled={starting === item.id}
              className="flex-row items-center gap-3 border-b border-apple-border px-4 py-3 active:bg-apple-bg2"
            >
              <ProfileAvatar uri={item.avatar_url} name={item.display_name} size={48} borderWidth={0} />
              <View className="min-w-0 flex-1">
                <Text className="font-semibold text-apple-ink">{item.display_name}</Text>
                <Text className="text-sm text-apple-secondary">@{item.handle}</Text>
              </View>
              {starting === item.id ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Ionicons name="chevron-forward" size={18} color={colors.tertiary} />
              )}
            </Pressable>
          )}
          ListEmptyComponent={
            query.trim() ? (
              <Text className="px-4 py-8 text-center text-sm text-apple-secondary">
                No people found for &ldquo;{query.trim()}&rdquo;
              </Text>
            ) : null
          }
        />
      )}
    </KeyboardSafeView>
  );
}
