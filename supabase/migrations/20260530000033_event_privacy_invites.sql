-- Private events, host invites, filter-friendly location index, DM event shares.

alter table public.events
  add column if not exists is_private boolean not null default false;

create index if not exists events_kind_starts_idx
  on public.events (kind, starts_at asc);

create index if not exists events_location_name_idx
  on public.events using gin (to_tsvector('simple', location_name));

create table if not exists public.event_invites (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  invited_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index if not exists event_invites_user_idx
  on public.event_invites (user_id, created_at desc);

create index if not exists event_invites_event_idx
  on public.event_invites (event_id);

alter table public.event_invites enable row level security;

-- Who can view an event (public, host, invitee, or attendee).
create or replace function public.can_view_event(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and (
        not e.is_private
        or e.host_id = p_user_id
        or exists (
          select 1 from public.event_invites i
          where i.event_id = e.id and i.user_id = p_user_id
        )
        or exists (
          select 1 from public.event_attendees a
          where a.event_id = e.id and a.user_id = p_user_id
        )
      )
  );
$$;

grant execute on function public.can_view_event(uuid, uuid) to authenticated, anon;

drop policy if exists "events: read all" on public.events;
create policy "events: read visible"
on public.events for select
to authenticated, anon
using (
  not is_private
  or (
    auth.uid() is not null
    and public.can_view_event(id, auth.uid())
  )
);

drop policy if exists "event_attendees: insert self" on public.event_attendees;
create policy "event_attendees: insert self when allowed"
on public.event_attendees for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.events e
    where e.id = event_id
      and (
        not e.is_private
        or e.host_id = auth.uid()
        or exists (
          select 1 from public.event_invites i
          where i.event_id = e.id and i.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists "event_invites: host manage" on public.event_invites;
create policy "event_invites: host read"
on public.event_invites for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.events e
    where e.id = event_id and e.host_id = auth.uid()
  )
);

drop policy if exists "event_invites: host insert" on public.event_invites;
create policy "event_invites: host insert"
on public.event_invites for insert
to authenticated
with check (
  invited_by = auth.uid()
  and exists (
    select 1 from public.events e
    where e.id = event_id and e.host_id = auth.uid()
  )
);

drop policy if exists "event_invites: host delete" on public.event_invites;
create policy "event_invites: host delete"
on public.event_invites for delete
to authenticated
using (
  exists (
    select 1 from public.events e
    where e.id = event_id and e.host_id = auth.uid()
  )
);

-- DM: share events in chat
do $$ begin
  alter type public.dm_message_type add value 'event_share';
exception when duplicate_object then null;
end $$;

alter table public.direct_messages
  add column if not exists event_id uuid references public.events(id) on delete set null;

create index if not exists direct_messages_event_idx
  on public.direct_messages (event_id)
  where event_id is not null;

alter table public.direct_messages drop constraint if exists direct_messages_has_content;

alter table public.direct_messages add constraint direct_messages_has_content check (
  (body is not null and char_length(trim(body)) > 0)
  or media_url is not null
  or event_id is not null
);

create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_title text;
begin
  if new.event_id is not null then
    select left(e.title, 120) into event_title
    from public.events e
    where e.id = new.event_id;
  end if;

  update public.conversations
  set
    last_message_at = new.created_at,
    last_message_body = case new.message_type
      when 'image' then '📷 Photo'
      when 'audio' then '🎤 Voice message'
      when 'story_reply' then coalesce(nullif(left(trim(new.body), 280), ''), 'Replied to your story')
      when 'event_share' then coalesce(
        nullif(left(trim(new.body), 200), ''),
        '📅 ' || coalesce(event_title, 'Shared an event')
      )
      else left(coalesce(new.body, ''), 280)
    end
  where id = new.conversation_id;
  return new;
end;
$$;

