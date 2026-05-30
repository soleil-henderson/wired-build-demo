import type { EventKind } from './events';

const KIND_LABELS: Record<EventKind, string> = {
  meetup: 'Meetup',
  trip: 'Trip',
  show: 'Show & shine',
  other: 'Other',
};

function toGoogleCalendarUtc(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** Opens Google Calendar "create event" with fields prefilled (no OAuth required). */
export function buildGoogleCalendarAddUrl(opts: {
  title: string;
  description?: string | null;
  location?: string;
  startsAt: string;
  endsAt?: string | null;
  kind?: EventKind;
}): string {
  const start = toGoogleCalendarUtc(opts.startsAt);
  const endDate = opts.endsAt
    ? new Date(opts.endsAt)
    : new Date(new Date(opts.startsAt).getTime() + 2 * 60 * 60 * 1000);
  const end = toGoogleCalendarUtc(endDate.toISOString());

  const details = [
    opts.description?.trim(),
    opts.kind ? `Type: ${KIND_LABELS[opts.kind]}` : null,
    'Created on Wired Build',
  ]
    .filter(Boolean)
    .join('\n\n');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: opts.title,
    dates: `${start}/${end}`,
    details,
  });
  if (opts.location?.trim()) {
    params.set('location', opts.location.trim());
  }
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
