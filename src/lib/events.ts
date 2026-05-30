import { getOrCreateConversation } from './messages';
import { supabase } from './supabase';
import type { EventPlace } from './event-place';
import { parseEventPlace } from './event-place';
import { buildGoogleCalendarAddUrl } from './google-calendar';

export type EventKind = 'meetup' | 'trip' | 'show' | 'other';

export type EventHost = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
};

export type EventSummary = {
  id: string;
  host_id: string;
  title: string;
  description: string | null;
  kind: EventKind;
  location_name: string;
  location: EventPlace | null;
  starts_at: string;
  ends_at: string | null;
  attendee_count: number;
  is_private: boolean;
  host: EventHost;
  viewer_attending: boolean;
  viewer_invited: boolean;
};

export type EventInviteRow = {
  user_id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
};

export type UserEventsBundle = {
  hosting: EventSummary[];
  attending: EventSummary[];
};

export type EventListFilters = {
  kind?: EventKind | null;
  locationQuery?: string;
};

const EVENT_SELECT = `
  id, host_id, title, description, kind, location_name, location,
  starts_at, ends_at, attendee_count, is_private,
  host:users!events_host_id_fkey ( id, handle, display_name, avatar_url )
`;

async function fetchViewerEventMeta(
  viewerId: string | null,
  eventIds: string[]
): Promise<{ attending: Set<string>; invited: Set<string> }> {
  if (!viewerId || eventIds.length === 0) {
    return { attending: new Set(), invited: new Set() };
  }
  const [attendRes, inviteRes] = await Promise.all([
    supabase
      .from('event_attendees')
      .select('event_id')
      .eq('user_id', viewerId)
      .in('event_id', eventIds),
    supabase
      .from('event_invites')
      .select('event_id')
      .eq('user_id', viewerId)
      .in('event_id', eventIds),
  ]);
  return {
    attending: new Set((attendRes.data ?? []).map((r) => r.event_id)),
    invited: new Set((inviteRes.data ?? []).map((r) => r.event_id)),
  };
}

function mapRow(
  row: Record<string, unknown>,
  meta: { attending: Set<string>; invited: Set<string> }
): EventSummary | null {
  const host = row.host as EventHost | null;
  if (!host) return null;
  const id = row.id as string;
  return {
    id,
    host_id: row.host_id as string,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    kind: row.kind as EventKind,
    location_name: row.location_name as string,
    location: parseEventPlace(row.location),
    starts_at: row.starts_at as string,
    ends_at: (row.ends_at as string | null) ?? null,
    attendee_count: Number(row.attendee_count ?? 0),
    is_private: Boolean(row.is_private),
    host,
    viewer_attending: meta.attending.has(id),
    viewer_invited: meta.invited.has(id),
  };
}

function mapRows(
  rows: Record<string, unknown>[],
  meta: { attending: Set<string>; invited: Set<string> }
): EventSummary[] {
  return rows
    .map((r) => mapRow(r, meta))
    .filter((e): e is EventSummary => e != null);
}


export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  meetup: 'Meetup',
  trip: 'Trip',
  show: 'Show & shine',
  other: 'Other',
};

export function formatEventWhen(startsAt: string, endsAt: string | null): string {
  const start = new Date(startsAt);
  const date = start.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const time = start.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  if (!endsAt) return `${date} · ${time}`;
  const end = new Date(endsAt);
  const endTime = end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time} – ${endTime}`;
}

export async function listUpcomingEvents(
  viewerId: string | null,
  limit = 12,
  filters?: EventListFilters
): Promise<EventSummary[]> {
  const now = new Date().toISOString();
  let query = supabase
    .from('events')
    .select(EVENT_SELECT)
    .gte('starts_at', now)
    .order('starts_at', { ascending: true })
    .limit(limit);

  if (filters?.kind) {
    query = query.eq('kind', filters.kind);
  }
  const loc = filters?.locationQuery?.trim();
  if (loc && loc.length >= 2) {
    const escaped = loc.replace(/[%_]/g, '\\$&');
    query = query.ilike('location_name', `%${escaped}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  const meta = await fetchViewerEventMeta(
    viewerId,
    rows.map((r) => r.id as string)
  );
  return mapRows(rows, meta);
}

export async function listUserEvents(
  userId: string,
  viewerId: string | null
): Promise<UserEventsBundle> {
  const now = new Date().toISOString();

  const hostedRes = await supabase
    .from('events')
    .select(EVENT_SELECT)
    .eq('host_id', userId)
    .gte('starts_at', now)
    .order('starts_at', { ascending: true })
    .limit(24);

  if (hostedRes.error) throw hostedRes.error;

  const { data: attendeeLinks, error: linkError } = await supabase
    .from('event_attendees')
    .select('event_id')
    .eq('user_id', userId);

  if (linkError) throw linkError;

  const attendeeEventIds = (attendeeLinks ?? []).map((r) => r.event_id);
  let attendingRows: Record<string, unknown>[] = [];

  if (attendeeEventIds.length > 0) {
    const attendingRes = await supabase
      .from('events')
      .select(EVENT_SELECT)
      .in('id', attendeeEventIds)
      .gte('starts_at', now)
      .neq('host_id', userId)
      .order('starts_at', { ascending: true })
      .limit(24);
    if (attendingRes.error) throw attendingRes.error;
    attendingRows = (attendingRes.data ?? []) as Record<string, unknown>[];
  }

  const hostedRows = (hostedRes.data ?? []) as Record<string, unknown>[];
  const allIds = [
    ...hostedRows.map((r) => r.id as string),
    ...attendingRows.map((r) => r.id as string),
  ];
  const meta = await fetchViewerEventMeta(viewerId, allIds);

  return {
    hosting: mapRows(hostedRows, meta),
    attending: mapRows(attendingRows, meta),
  };
}

export async function getEvent(
  eventId: string,
  viewerId: string | null
): Promise<EventSummary | null> {
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_SELECT)
    .eq('id', eventId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  const meta = await fetchViewerEventMeta(viewerId, [eventId]);
  return mapRow(data as Record<string, unknown>, meta);
}

export async function listEventInvites(eventId: string): Promise<EventInviteRow[]> {
  const { data: rows, error } = await supabase
    .from('event_invites')
    .select('user_id, created_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!rows?.length) return [];

  const userIds = rows.map((r) => r.user_id);
  const { data: users, error: usersErr } = await supabase
    .from('users')
    .select('id, handle, display_name, avatar_url')
    .in('id', userIds);

  if (usersErr) throw usersErr;

  const byId = new Map((users ?? []).map((u) => [u.id, u]));

  return rows
    .map((r) => {
      const u = byId.get(r.user_id);
      if (!u) return null;
      return {
        user_id: r.user_id,
        handle: u.handle,
        display_name: u.display_name,
        avatar_url: u.avatar_url,
        created_at: r.created_at,
      };
    })
    .filter((r): r is EventInviteRow => r != null);
}

export async function inviteUserToEvent(
  eventId: string,
  hostId: string,
  userId: string
): Promise<void> {
  if (userId === hostId) return;
  const { error } = await supabase.from('event_invites').insert({
    event_id: eventId,
    user_id: userId,
    invited_by: hostId,
  });
  if (error && error.code !== '23505') throw error;
}

export async function removeEventInvite(
  eventId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('event_invites')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', userId);
  if (error) throw error;
}

export type CreateEventResult = {
  id: string;
  email_sent: boolean;
  calendar_url: string;
};

export async function createEvent(input: {
  hostId: string;
  title: string;
  description?: string | null;
  kind: EventKind;
  locationName: string;
  location?: EventPlace | null;
  startsAt: string;
  endsAt?: string | null;
  isPrivate?: boolean;
  inviteUserIds?: string[];
}): Promise<CreateEventResult> {
  const { data, error } = await supabase
    .from('events')
    .insert({
      host_id: input.hostId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      kind: input.kind,
      location_name: input.locationName.trim(),
      location: input.location ?? null,
      starts_at: input.startsAt,
      ends_at: input.endsAt ?? null,
      is_private: Boolean(input.isPrivate),
    })
    .select('id')
    .single();

  if (error) throw error;

  const inviteIds = (input.inviteUserIds ?? []).filter((id) => id !== input.hostId);
  if (inviteIds.length > 0) {
    await Promise.all(
      inviteIds.map((uid) => inviteUserToEvent(data.id, input.hostId, uid).catch(() => {}))
    );
  }

  const calendar_url = buildGoogleCalendarAddUrl({
    title: input.title.trim(),
    description: input.description,
    location: input.locationName.trim(),
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    kind: input.kind,
  });

  let email_sent = false;
  try {
    const notify = await notifyEventCreated(data.id);
    email_sent = notify.email_sent;
    return { id: data.id, email_sent, calendar_url: notify.calendar_url ?? calendar_url };
  } catch {
    return { id: data.id, email_sent: false, calendar_url };
  }
}

async function notifyEventCreated(eventId: string): Promise<{
  email_sent: boolean;
  calendar_url?: string;
}> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) return { email_sent: false };

  const base = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const apikey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
  const res = await fetch(`${base}/functions/v1/notify-event-created`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey,
    },
    body: JSON.stringify({ event_id: eventId }),
  });

  const raw = await res.text();
  try {
    const payload = JSON.parse(raw) as { email_sent?: boolean; calendar_url?: string };
    if (!res.ok) return { email_sent: false };
    return {
      email_sent: !!payload.email_sent,
      calendar_url: payload.calendar_url,
    };
  } catch {
    return { email_sent: false };
  }
}

export async function setEventAttendance(
  eventId: string,
  userId: string,
  attending: boolean
): Promise<void> {
  if (attending) {
    const { error } = await supabase.from('event_attendees').insert({
      event_id: eventId,
      user_id: userId,
    });
    if (error) {
      if (error.code === '42501') {
        throw new Error('This is a private event — you need an invite from the host to join.');
      }
      if (error.code !== '23505') throw error;
    }
    return;
  }
  const { error } = await supabase
    .from('event_attendees')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function deleteEvent(eventId: string, hostId: string): Promise<void> {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId)
    .eq('host_id', hostId);
  if (error) throw error;
}

/** Share event in DM; private events auto-invite the recipient when sharer is host. */
export async function shareEventInDm(input: {
  eventId: string;
  fromUserId: string;
  toUserId: string;
  note?: string | null;
  event?: Pick<EventSummary, 'id' | 'host_id' | 'is_private' | 'title'>;
}): Promise<string> {
  const ev =
    input.event ??
    (await getEvent(input.eventId, input.fromUserId));
  if (!ev) throw new Error('Event not found or you cannot view it.');

  if (ev.is_private && ev.host_id !== input.fromUserId) {
    throw new Error('Only the host can share a private event.');
  }

  if (ev.is_private && ev.host_id === input.fromUserId) {
    await inviteUserToEvent(ev.id, input.fromUserId, input.toUserId);
  }

  const conversationId = await getOrCreateConversation(input.toUserId);
  const { sendEventShareMessage } = await import('./messages');
  await sendEventShareMessage({
    conversationId,
    senderId: input.fromUserId,
    eventId: ev.id,
    body: input.note?.trim() || null,
  });
  return conversationId;
}
