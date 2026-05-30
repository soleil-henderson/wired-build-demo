import { Stack, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { EventCard } from '@/components/explore/EventCard';
import { EventFiltersBar } from '@/components/events/EventFiltersBar';
import { useAuth } from '@/lib/auth-context';
import {
  listUpcomingEvents,
  type EventKind,
  type EventListFilters,
  type EventSummary,
} from '@/lib/events';
import { colors } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

export default function ExploreEventsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [kind, setKind] = useState<EventKind | null>(null);
  const [locationQuery, setLocationQuery] = useState('');

  const load = useCallback(
    async (filters: EventListFilters) => {
      try {
        const list = await listUpcomingEvents(session?.user.id ?? null, 40, filters);
        setEvents(list);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [session?.user.id]
  );

  useFocusData(
    ({ isInitial }) => {
      if (isInitial && events.length === 0) setLoading(true);
      return load({ kind, locationQuery });
    },
    [load, kind, locationQuery],
    { cacheKey: `${kind ?? ''}:${locationQuery}` }
  );

  return (
    <View className="flex-1 bg-apple-bg2">
      <Stack.Screen options={{ title: 'Events' }} />
      <ScrollView
        contentContainerClassName="pb-24 pt-2"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            tintColor={colors.accent}
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load({ kind, locationQuery });
            }}
          />
        }
      >
        <View className="mb-2 flex-row items-center justify-between px-4">
          <Text className="text-sm text-apple-secondary">
            Meetups, trips, and show days from the community.
          </Text>
          <Pressable onPress={() => router.push('/event/new')}>
            <Text className="font-semibold text-signal-blue">+ New</Text>
          </Pressable>
        </View>

        <EventFiltersBar
          kind={kind}
          locationQuery={locationQuery}
          onKindChange={setKind}
          onLocationQueryChange={setLocationQuery}
        />

        {loading && events.length === 0 ? (
          <View className="items-center py-16">
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : events.length === 0 ? (
          <View className="mx-4 rounded-[18px] border border-apple-border bg-apple-surface p-6">
            <Text className="font-semibold text-apple-ink">No upcoming events</Text>
            <Text className="mt-1 text-sm text-apple-secondary">
              Try another type or location, or create your own.
            </Text>
            <Pressable onPress={() => router.push('/event/new')} className="mt-3">
              <Text className="font-semibold text-signal-blue">Create event</Text>
            </Pressable>
          </View>
        ) : (
          <View className="gap-3 px-4 pt-2">
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onPress={() => router.push(`/event/${event.id}`)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
