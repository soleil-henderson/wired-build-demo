import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  combineEventStartIso,
  EventDateTimeFields,
} from '@/components/events/EventDateTimeFields';
import { PlaceAutocompleteField } from '@/components/events/PlaceAutocompleteField';
import { KeyboardSafeScrollView } from '@/components/ui/KeyboardSafeView';
import { useAuth } from '@/lib/auth-context';
import { createEvent, EVENT_KIND_LABELS, type EventKind } from '@/lib/events';
import type { EventPlace } from '@/lib/event-place';
import { showAppAlert } from '@/lib/app-alert';
import { colors, inputClassName } from '@/lib/theme';

const KINDS: EventKind[] = ['meetup', 'trip', 'show', 'other'];

export default function NewEventScreen() {
  const { session } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<EventKind>('meetup');
  const [locationText, setLocationText] = useState('');
  const [place, setPlace] = useState<EventPlace | null>(null);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  });
  const [startTime, setStartTime] = useState(() => {
    const t = new Date();
    t.setHours(9, 0, 0, 0);
    return t;
  });
  const [isPrivate, setIsPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!session) {
      showAppAlert('Sign in', 'Sign in to post an event.');
      return;
    }
    if (title.trim().length < 2) {
      Alert.alert('Title required', 'Give your event a name (at least 2 characters).');
      return;
    }
    if (!place) {
      Alert.alert(
        'Pick a location',
        'Choose a place from the Google Maps suggestions so others can find the meet point.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const result = await createEvent({
        hostId: session.user.id,
        title,
        description: description.trim() || null,
        kind,
        locationName: place.formatted_address || place.name,
        location: place,
        startsAt: combineEventStartIso(startDate, startTime),
        isPrivate,
      });

      const lines = [
        'Your event is live.',
        result.email_sent
          ? 'A confirmation email was sent to your account.'
          : 'You can add this event to Google Calendar from the next screen.',
      ];

      Alert.alert('Event posted', lines.join('\n\n'), [
        {
          text: 'Add to Google Calendar',
          onPress: () => Linking.openURL(result.calendar_url),
        },
        {
          text: 'View event',
          onPress: () => router.replace(`/event/${result.id}`),
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not create event';
      showAppAlert('Failed', message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'New event' }} />
      <KeyboardSafeScrollView
        className="flex-1 bg-apple-bg2"
        contentContainerClassName="px-4 pb-10 pt-4"
        keyboardShouldPersistTaps="handled"
      >
        <Text className="mb-4 text-sm text-apple-secondary">
          Share 4WD meetups, club runs, trips, and show & shine dates with the community.
        </Text>

        <Label>Title</Label>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. High Country Easter run"
          placeholderTextColor={colors.tertiary}
          className={inputClassName}
        />

        <Label>Type</Label>
        <View className="mb-4 flex-row flex-wrap gap-2">
          {KINDS.map((k) => (
            <Pressable
              key={k}
              onPress={() => setKind(k)}
              className={`rounded-full px-3 py-2 ${
                kind === k ? 'bg-accent' : 'border border-apple-border bg-white'
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  kind === k ? 'text-white' : 'text-apple-secondary'
                }`}
              >
                {EVENT_KIND_LABELS[k]}
              </Text>
            </Pressable>
          ))}
        </View>

        <Label>Location</Label>
        <PlaceAutocompleteField
          value={place}
          displayText={locationText}
          onDisplayTextChange={setLocationText}
          onPlaceResolved={setPlace}
        />

        <EventDateTimeFields
          startDate={startDate}
          startTime={startTime}
          onStartDateChange={setStartDate}
          onStartTimeChange={setStartTime}
        />

        <Label>Visibility</Label>
        <View className="mb-2 flex-row gap-2">
          <Pressable
            onPress={() => setIsPrivate(false)}
            className={`flex-1 rounded-xl border px-3 py-3 ${
              !isPrivate ? 'border-accent bg-accent-soft' : 'border-apple-border bg-white'
            }`}
          >
            <Text className={`text-center text-sm font-semibold ${!isPrivate ? 'text-accent' : 'text-apple-secondary'}`}>
              Public
            </Text>
            <Text className="mt-1 text-center text-[11px] text-apple-tertiary">
              Listed on Explore
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setIsPrivate(true)}
            className={`flex-1 rounded-xl border px-3 py-3 ${
              isPrivate ? 'border-accent bg-accent-soft' : 'border-apple-border bg-white'
            }`}
          >
            <Text className={`text-center text-sm font-semibold ${isPrivate ? 'text-accent' : 'text-apple-secondary'}`}>
              Private
            </Text>
            <Text className="mt-1 text-center text-[11px] text-apple-tertiary">
              Invite-only
            </Text>
          </Pressable>
        </View>

        <Label>Details (optional)</Label>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Convoy rules, what to bring, skill level…"
          placeholderTextColor={colors.tertiary}
          multiline
          className={`${inputClassName} mb-6 min-h-[100px]`}
          textAlignVertical="top"
        />

        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          className="items-center rounded-[14px] bg-accent py-3.5 active:opacity-90 disabled:opacity-60"
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-base font-semibold text-white">Post event</Text>
          )}
        </Pressable>
      </KeyboardSafeScrollView>
    </>
  );
}

function Label({ children }: { children: string }) {
  return (
    <Text className="mb-1.5 mt-4 text-[13px] font-semibold text-apple-secondary">{children}</Text>
  );
}
