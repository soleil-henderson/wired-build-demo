import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { EVENT_KIND_LABELS, type EventKind } from '@/lib/events';
import { colors, inputClassName } from '@/lib/theme';

const KINDS: (EventKind | null)[] = [null, 'meetup', 'trip', 'show', 'other'];

type Props = {
  kind: EventKind | null;
  locationQuery: string;
  onKindChange: (kind: EventKind | null) => void;
  onLocationQueryChange: (q: string) => void;
};

export function EventFiltersBar({
  kind,
  locationQuery,
  onKindChange,
  onLocationQueryChange,
}: Props) {
  return (
    <View className="gap-3 px-4 pb-2">
      <TextInput
        value={locationQuery}
        onChangeText={onLocationQueryChange}
        placeholder="Filter by location (e.g. Blue Mountains)"
        placeholderTextColor={colors.tertiary}
        autoCapitalize="words"
        autoCorrect={false}
        className={inputClassName}
      />
      <ScrollRow>
        {KINDS.map((k) => {
          const active = kind === k;
          const label = k ? EVENT_KIND_LABELS[k] : 'All types';
          return (
            <Pressable
              key={k ?? 'all'}
              onPress={() => onKindChange(k)}
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
      </ScrollRow>
    </View>
  );
}

function ScrollRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingRight: 8 }}
    >
      {children}
    </ScrollView>
  );
}
