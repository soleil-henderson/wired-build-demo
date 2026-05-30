import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  corsPreflight,
  getSupabaseAnonKey,
  jsonResponse,
  textResponse,
} from '../_shared/cors.ts';

const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://wiredbuild.app';

function toGoogleCalendarUtc(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function buildCalendarUrl(event: {
  title: string;
  description: string | null;
  location_name: string;
  starts_at: string;
  ends_at: string | null;
}): string {
  const start = toGoogleCalendarUtc(event.starts_at);
  const end = toGoogleCalendarUtc(
    event.ends_at ??
      new Date(new Date(event.starts_at).getTime() + 2 * 60 * 60 * 1000).toISOString()
  );
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${start}/${end}`,
    details: [event.description, 'Posted on Wired Build'].filter(Boolean).join('\n\n'),
    location: event.location_name,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

async function sendResendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const key = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Wired Build <events@wiredbuild.app>';
  if (!key) return false;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
    }),
  });
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflight();
  if (req.method !== 'POST') return textResponse('Method not allowed', 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return textResponse('Unauthorized', 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    getSupabaseAnonKey(),
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth.user) return textResponse('Unauthorized', 401);

  let body: { event_id?: string };
  try {
    body = await req.json();
  } catch {
    return textResponse('Invalid JSON', 400);
  }

  const eventId = body.event_id?.trim();
  if (!eventId) return textResponse('event_id required', 400);

  const { data: event, error: eventErr } = await supabase
    .from('events')
    .select('id, host_id, title, description, location_name, starts_at, ends_at, kind')
    .eq('id', eventId)
    .maybeSingle();

  if (eventErr || !event) return textResponse('Event not found', 404);
  if (event.host_id !== auth.user.id) return textResponse('Forbidden', 403);

  const { data: host } = await supabase
    .from('users')
    .select('email, display_name')
    .eq('id', auth.user.id)
    .maybeSingle();

  const calendarUrl = buildCalendarUrl(event);
  const eventUrl = `${SITE_URL.replace(/\/$/, '')}/event/${event.id}`;
  const when = new Date(event.starts_at).toLocaleString('en-AU', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Australia/Sydney',
  });

  let emailSent = false;
  const email = host?.email ?? auth.user.email;
  if (email) {
    emailSent = await sendResendEmail({
      to: email,
      subject: `Event posted: ${event.title}`,
      html: `
        <p>Hi ${host?.display_name ?? 'there'},</p>
        <p>Your event <strong>${event.title}</strong> is live on Wired Build.</p>
        <ul>
          <li><strong>When:</strong> ${when}</li>
          <li><strong>Where:</strong> ${event.location_name}</li>
        </ul>
        <p><a href="${eventUrl}">View event</a> · <a href="${calendarUrl}">Add to Google Calendar</a></p>
        <p>— Wired Build</p>
      `,
    });
  }

  return jsonResponse({
    email_sent: emailSent,
    calendar_url: calendarUrl,
    event_url: eventUrl,
  });
});
