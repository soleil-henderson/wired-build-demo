import { Pressable, ScrollView, Text, View } from 'react-native';

import { MOD_CATEGORY_OPTIONS } from '@/lib/mod-categories';
import type { ModCategory } from '@/types/database';
import { colors } from '@/lib/theme';

type Props = {
  category: ModCategory | null;
  onCategoryChange: (category: ModCategory | null) => void;
};

const ALL_TYPES: (ModCategory | null)[] = [null, ...MOD_CATEGORY_OPTIONS.map((o) => o.value)];

export function PartCategoryFilters({ category, onCategoryChange }: Props) {
  return (
    <View className="pb-1">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        {ALL_TYPES.map((value) => {
          const active = category === value;
          const label =
            value === null
              ? 'All types'
              : MOD_CATEGORY_OPTIONS.find((o) => o.value === value)?.label ?? value;
          return (
            <Pressable
              key={value ?? 'all'}
              onPress={() => onCategoryChange(value)}
              className={`rounded-full px-3 py-2 ${
                active ? 'bg-accent' : 'border border-apple-border bg-white'
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  active ? 'text-white' : 'text-apple-secondary'
                }`}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
