import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { AppleCard } from '@/components/apple/AppleCard';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useAuth } from '@/lib/auth-context';
import { listSavedItems, unsaveItem, type SavedItemPreview } from '@/lib/saves';
import { colors } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';
import type { SavedTargetType } from '@/types/database';

const TYPE_LABEL: Record<SavedTargetType, string> = {
  post: 'Posts',
  mod: 'Mods',
  vehicle: 'Builds',
};

const TYPE_ICON: Record<SavedTargetType, keyof typeof Ionicons.glyphMap> = {
  post: 'images-outline',
  mod: 'construct-outline',
  vehicle: 'car-sport-outline',
};

export default function SavedItemsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<SavedItemPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<SavedTargetType | 'all'>('all');

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const list = await listSavedItems(session.user.id);
      setItems(list);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useFocusData(
    ({ isInitial }) => {
      if (isInitial && items.length === 0) setLoading(true);
      return load();
    },
    [load]
  );

  const filtered = useMemo(
    () => (filter === 'all' ? items : items.filter((item) => item.target_type === filter)),
    [filter, items]
  );

  const counts = useMemo(() => {
    const map: Record<SavedTargetType, number> = { post: 0, mod: 0, vehicle: 0 };
    for (const item of items) map[item.target_type] += 1;
    return map;
  }, [items]);

  async function handleRemove(item: SavedItemPreview) {
    Alert.alert('Remove from saved?', item.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await unsaveItem(item.target_type, item.target_id);
            setItems((prev) => prev.filter((row) => row.id !== item.id));
          } catch (err) {
            Alert.alert(
              'Remove failed',
              err instanceof Error ? err.message : 'Could not remove saved item'
            );
          }
        },
      },
    ]);
  }

  return (
    <ScrollView className="flex-1 bg-apple-bg2" contentContainerClassName="pb-12">
      <Stack.Screen options={{ title: 'Saved' }} />
      <ScreenHeader subtitle="Posts, mods, and builds you bookmarked." />

      <View className="mx-4 mb-4 flex-row flex-wrap gap-2">
        <FilterChip
          label={`All (${items.length})`}
          active={filter === 'all'}
          onPress={() => setFilter('all')}
        />
        {(Object.keys(TYPE_LABEL) as SavedTargetType[]).map((type) => (
          <FilterChip
            key={type}
            label={`${TYPE_LABEL[type]} (${counts[type]})`}
            active={filter === type}
            onPress={() => setFilter(type)}
          />
        ))}
      </View>

      {loading && items.length === 0 ? (
        <ActivityIndicator color={colors.accent} className="mt-8" />
      ) : filtered.length === 0 ? (
        <Text className="mx-6 mt-2 text-apple-secondary">
          {items.length === 0
            ? 'Nothing saved yet. Tap the bookmark icon on a post, mod, or public build.'
            : 'No saved items in this category.'}
        </Text>
      ) : (
        <View className="mx-4 gap-2">
          {filtered.map((item) => (
            <AppleCard key={item.id} style={{ padding: 0, overflow: 'hidden' }}>
              <Pressable
                onPress={() => router.push(item.href as never)}
                className="flex-row items-center gap-3 p-3 active:opacity-80"
              >
                {item.image_url ? (
                  <Image
                    source={{ uri: item.image_url }}
                    className="h-14 w-14 rounded-xl bg-apple-bg2"
                    contentFit="cover"
                  />
                ) : (
                  <View className="h-14 w-14 items-center justify-center rounded-xl bg-apple-bg2">
                    <Ionicons name={TYPE_ICON[item.target_type]} size={22} color={colors.tertiary} />
                  </View>
                )}
                <View className="min-w-0 flex-1">
                  <Text className="text-[11px] font-semibold uppercase tracking-wider text-accent">
                    {TYPE_LABEL[item.target_type]}
                  </Text>
                  <Text className="text-[15px] font-semibold text-apple-ink" numberOfLines={2}>
                    {item.title}
                  </Text>
                  {item.subtitle ? (
                    <Text className="mt-0.5 text-sm text-apple-secondary" numberOfLines={1}>
                      {item.subtitle}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => handleRemove(item)}
                  hitSlop={8}
                  className="p-2 active:opacity-70"
                >
                  <Ionicons name="bookmark" size={20} color={colors.accent} />
                </Pressable>
              </Pressable>
            </AppleCard>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full px-3 py-1.5 active:opacity-80 ${
        active ? 'bg-accent' : 'border border-apple-border bg-white'
      }`}
    >
      <Text
        className={`text-xs font-semibold ${active ? 'text-white' : 'text-apple-secondary'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
