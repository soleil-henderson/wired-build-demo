import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { EventCard } from '@/components/explore/EventCard';
import { AppleCard } from '@/components/apple/AppleCard';
import type { EventSummary } from '@/lib/events';
import { colors } from '@/lib/theme';

type Props = {
  events: EventSummary[];
  onCreatePress: () => void;
};

const CARD_WIDTH = 280;

export function EventsSection({ events, onCreatePress }: Props) {
  const router = useRouter();

  return (
    <View>
      <View className="mb-3 flex-row items-center justify-between px-4">
        <View className="flex-row items-center gap-2">
          <Text
            className="text-[22px] font-bold text-apple-ink"
            style={{ letterSpacing: -0.44 }}
          >
            Events
          </Text>
          <Ionicons name="calendar" size={20} color={colors.accent} />
        </View>
        <View className="flex-row items-center gap-4">
          <Pressable onPress={onCreatePress} hitSlop={8}>
            <Ionicons name="add-circle-outline" size={26} color={colors.blue} />
          </Pressable>
          <Pressable onPress={() => router.push('/explore/events')} hitSlop={8}>
            <Text className="text-[15px] font-semibold text-signal-blue">See all</Text>
          </Pressable>
        </View>
      </View>

      {events.length === 0 ? (
        <View className="mx-4">
          <AppleCard padded>
            <Text className="font-semibold text-apple-ink">No upcoming events</Text>
            <Text className="mt-1 text-sm text-apple-secondary">
              Post a meetup, club run, or trip and let others mark they&apos;re going.
            </Text>
            <Pressable onPress={onCreatePress} className="mt-3 self-start">
              <Text className="font-semibold text-signal-blue">Create event</Text>
            </Pressable>
          </AppleCard>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 4 }}
        >
          {events.map((event) => (
            <View key={event.id} style={{ width: CARD_WIDTH }}>
              <EventCard
                event={event}
                compact
                onPress={() => router.push(`/event/${event.id}`)}
              />
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
