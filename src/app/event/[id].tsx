import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { EventInviteSheet } from '@/components/events/EventInviteSheet';
import { EventShareSheet } from '@/components/events/EventShareSheet';
import { ProfileAvatar } from '@/components/social/ProfileAvatar';
import { useAuth } from '@/lib/auth-context';
import {
  deleteEvent,
  EVENT_KIND_LABELS,
  formatEventWhen,
  getEvent,
  setEventAttendance,
  type EventSummary,
} from '@/lib/events';
import { routeParam } from '@/lib/route-param';
import { showAppAlert } from '@/lib/app-alert';
import { buildGoogleMapsSearchUrl } from '@/lib/event-place';
import { buildGoogleCalendarAddUrl } from '@/lib/google-calendar';
import { colors } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

export default function EventDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = routeParam(params.id);
  const router = useRouter();
  const { session } = useAuth();

  const [event, setEvent] = useState<EventSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const row = await getEvent(id, session?.user.id ?? null);
      setEvent(row);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not load event');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, session?.user.id]);

  const resetEntity = useCallback(() => {
    setEvent(null);
    setLoading(true);
  }, []);

  useFocusData(
    async ({ isInitial }) => {
      if (isInitial) setLoading(true);
      await load();
    },
    [load],
    { cacheKey: id, onCacheKeyChange: resetEntity }
  );

  const isHost = session?.user.id === event?.host_id;

  async function handleToggleAttend() {
    if (!session || !event) {
      showAppAlert('Sign in', 'Sign in to mark that you are going.');
      return;
    }
    setBusy(true);
    const next = !event.viewer_attending;
    try {
      await setEventAttendance(event.id, session.user.id, next);
      setEvent((e) =>
        e
          ? {
              ...e,
              viewer_attending: next,
              attendee_count: Math.max(0, e.attendee_count + (next ? 1 : -1)),
            }
          : e
      );
    } catch (err) {
      showAppAlert('Error', err instanceof Error ? err.message : 'Could not update attendance');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!session || !event) return;
    Alert.alert('Delete event?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteEvent(event.id, session.user.id);
            router.back();
          } catch (err) {
            showAppAlert('Error', err instanceof Error ? err.message : 'Could not delete');
          }
        },
      },
    ]);
  }

  if (loading && !event) {
    return (
      <View className="flex-1 items-center justify-center bg-apple-bg2">
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!event) {
    return (
      <View className="flex-1 items-center justify-center bg-apple-bg2 px-6">
        <Ionicons name="lock-closed-outline" size={40} color={colors.tertiary} />
        <Text className="mt-4 text-center text-lg font-semibold text-apple-ink">
          Event not available
        </Text>
        <Text className="mt-2 text-center text-sm text-apple-secondary">
          It may be private, deleted, or you need an invite from the host.
        </Text>
      </View>
    );
  }

  const canShare = Boolean(session && (!event.is_private || isHost));

  return (
    <>
      <Stack.Screen options={{ title: event.title }} />
      <ScrollView
        className="flex-1 bg-apple-bg2"
        contentContainerClassName="pb-10"
        refreshControl={
          <RefreshControl
            tintColor={colors.accent}
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
      >
        <View className="border-b border-apple-border bg-white px-4 py-5">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-[11px] font-bold uppercase tracking-wider text-accent">
              {EVENT_KIND_LABELS[event.kind]}
            </Text>
            {event.is_private ? (
              <View className="flex-row items-center gap-1 rounded-full bg-apple-bg2 px-2 py-0.5">
                <Ionicons name="lock-closed" size={12} color={colors.secondary} />
                <Text className="text-[10px] font-semibold text-apple-secondary">Private</Text>
              </View>
            ) : null}
            {event.viewer_invited && !isHost ? (
              <Text className="text-[10px] font-semibold text-signal-green">Invited</Text>
            ) : null}
          </View>
          <Text className="mt-1 text-2xl font-bold text-apple-ink">{event.title}</Text>
          <Text className="mt-2 text-[15px] text-apple-secondary">
            {formatEventWhen(event.starts_at, event.ends_at)}
          </Text>
          <Pressable
            onPress={() => {
              const url =
                event.location?.maps_url ??
                buildGoogleMapsSearchUrl(event.location_name);
              Linking.openURL(url);
            }}
            className="mt-3 flex-row items-center gap-2 active:opacity-80"
          >
            <Ionicons name="location-outline" size={18} color={colors.blue} />
            <Text className="flex-1 text-[15px] text-signal-blue">{event.location_name}</Text>
            <Ionicons name="open-outline" size={16} color={colors.blue} />
          </Pressable>
          <Text className="mt-3 text-sm text-apple-secondary">
            {event.attendee_count} {event.attendee_count === 1 ? 'person' : 'people'} going
          </Text>
        </View>

        <Pressable
          onPress={() => router.push(`/user/${event.host.handle}`)}
          className="mx-4 mt-4 flex-row items-center gap-3 rounded-2xl border border-apple-border bg-white p-4 active:opacity-90"
        >
          <ProfileAvatar
            uri={event.host.avatar_url}
            name={event.host.display_name}
            size={44}
          />
          <View className="flex-1">
            <Text className="text-xs text-apple-secondary">Hosted by</Text>
            <Text className="text-base font-semibold text-apple-ink">
              {event.host.display_name}
            </Text>
            <Text className="text-sm text-apple-secondary">@{event.host.handle}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.tertiary} />
        </Pressable>

        {event.description ? (
          <View className="mx-4 mt-4 rounded-2xl border border-apple-border bg-white p-4">
            <Text className="text-[13px] font-semibold text-apple-secondary">About</Text>
            <Text className="mt-2 text-[15px] leading-[22px] text-apple-ink">
              {event.description}
            </Text>
          </View>
        ) : null}

        <View className="mx-4 mt-4 flex-row flex-wrap gap-2">
          {canShare ? (
            <Pressable
              onPress={() => setShareOpen(true)}
              className="min-w-[45%] flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-apple-border bg-white py-3 active:opacity-90"
            >
              <Ionicons name="paper-plane-outline" size={18} color={colors.blue} />
              <Text className="text-sm font-semibold text-signal-blue">Share in DM</Text>
            </Pressable>
          ) : null}
          {isHost ? (
            <Pressable
              onPress={() => setInviteOpen(true)}
              className="min-w-[45%] flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-apple-border bg-white py-3 active:opacity-90"
            >
              <Ionicons name="person-add-outline" size={18} color={colors.blue} />
              <Text className="text-sm font-semibold text-signal-blue">Invite</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() =>
              Linking.openURL(
                buildGoogleCalendarAddUrl({
                  title: event.title,
                  description: event.description,
                  location: event.location_name,
                  startsAt: event.starts_at,
                  endsAt: event.ends_at,
                  kind: event.kind,
                })
              )
            }
            className="min-w-[45%] flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-apple-border bg-white py-3 active:opacity-90"
          >
            <Ionicons name="calendar-outline" size={18} color={colors.blue} />
            <Text className="text-sm font-semibold text-signal-blue">Calendar</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              const url =
                event.location?.maps_url ??
                buildGoogleMapsSearchUrl(event.location_name);
              Linking.openURL(url);
            }}
            className="min-w-[45%] flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-apple-border bg-white py-3 active:opacity-90"
          >
            <Ionicons name="map-outline" size={18} color={colors.blue} />
            <Text className="text-sm font-semibold text-signal-blue">Maps</Text>
          </Pressable>
        </View>

        <View className="mx-4 mt-6 gap-3">
          {!isHost ? (
            <Pressable
              onPress={handleToggleAttend}
              disabled={busy}
              className={`items-center rounded-[14px] py-3.5 active:opacity-90 disabled:opacity-60 ${
                event.viewer_attending ? 'border border-apple-border bg-white' : 'bg-accent'
              }`}
            >
              {busy ? (
                <ActivityIndicator color={event.viewer_attending ? colors.accent : '#fff'} />
              ) : (
                <Text
                  className={`text-base font-semibold ${
                    event.viewer_attending ? 'text-apple-ink' : 'text-white'
                  }`}
                >
                  {event.viewer_attending ? "I'm going ✓" : "I'm going"}
                </Text>
              )}
            </Pressable>
          ) : (
            <View className="rounded-2xl border border-apple-border bg-white px-4 py-3">
              <Text className="text-center text-sm text-apple-secondary">
                You are hosting this event.
                {event.is_private
                  ? ' Invite people or share in a message so they can view and RSVP.'
                  : ' Share in a message or let people find it on Explore.'}
              </Text>
            </View>
          )}

          {isHost ? (
            <Pressable
              onPress={handleDelete}
              className="items-center rounded-[14px] border border-red-200 py-3 active:opacity-80"
            >
              <Text className="font-semibold text-red-600">Delete event</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      {session && isHost ? (
        <EventInviteSheet
          visible={inviteOpen}
          eventId={event.id}
          hostId={session.user.id}
          onClose={() => setInviteOpen(false)}
        />
      ) : null}

      {session && canShare ? (
        <EventShareSheet
          visible={shareOpen}
          event={event}
          fromUserId={session.user.id}
          onClose={() => setShareOpen(false)}
        />
      ) : null}
    </>
  );
}
