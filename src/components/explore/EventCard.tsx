import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { AppleCard } from '@/components/apple/AppleCard';
import {
  EVENT_KIND_LABELS,
  formatEventWhen,
  type EventSummary,
} from '@/lib/events';
import { colors } from '@/lib/theme';

const KIND_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  meetup: 'people-outline',
  trip: 'map-outline',
  show: 'ribbon-outline',
  other: 'calendar-outline',
};

type Props = {
  event: EventSummary;
  compact?: boolean;
  onPress: () => void;
};

export function EventCard({ event, compact, onPress }: Props) {
  const icon = KIND_ICONS[event.kind] ?? 'calendar-outline';

  return (
    <Pressable onPress={onPress} className="active:opacity-90">
      <AppleCard style={{ padding: compact ? 12 : 14 }}>
        <View className="flex-row items-start gap-3">
          <View
            className="h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: colors.blueSoft }}
          >
            <Ionicons name={icon} size={20} color={colors.blue} />
          </View>
          <View className="min-w-0 flex-1">
            <View className="flex-row items-center gap-2">
              <Text
                className="flex-1 text-[15px] font-bold text-apple-ink"
                numberOfLines={compact ? 1 : 2}
              >
                {event.title}
              </Text>
              {event.is_private ? (
                <Ionicons name="lock-closed" size={14} color={colors.tertiary} />
              ) : null}
              {event.viewer_attending ? (
                <View
                  className="rounded-full px-2 py-0.5"
                  style={{ backgroundColor: colors.green + '22' }}
                >
                  <Text className="text-[10px] font-bold" style={{ color: colors.green }}>
                    Going
                  </Text>
                </View>
              ) : null}
            </View>
            <Text className="mt-0.5 text-[13px] text-apple-secondary" numberOfLines={1}>
              {formatEventWhen(event.starts_at, event.ends_at)}
            </Text>
            <Text className="mt-0.5 text-[13px] text-apple-secondary" numberOfLines={1}>
              {event.location_name}
            </Text>
            {!compact ? (
              <View className="mt-2 flex-row flex-wrap items-center gap-2">
                <Text className="text-[11px] font-semibold uppercase tracking-wide text-apple-tertiary">
                  {EVENT_KIND_LABELS[event.kind]}
                </Text>
                <Text className="text-[12px] text-apple-tertiary">·</Text>
                <Text className="text-[12px] text-apple-tertiary">
                  @{event.host.handle}
                </Text>
                <Text className="text-[12px] text-apple-tertiary">·</Text>
                <Text className="text-[12px] text-apple-tertiary">
                  {event.attendee_count} going
                </Text>
              </View>
            ) : (
              <Text className="mt-1 text-[12px] text-apple-tertiary">
                {event.attendee_count} going · @{event.host.handle}
              </Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.tertiary} />
        </View>
      </AppleCard>
    </Pressable>
  );
}
