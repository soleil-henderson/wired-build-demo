-- 4WD meetups, trips, and shows — discover on Explore, host/attend from profiles.

do $$ begin
  create type public.event_kind as enum ('meetup', 'trip', 'show', 'other');
exception when duplicate_object then null; end $$;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) >= 2),
  description text,
  kind public.event_kind not null default 'meetup',
  location_name text not null check (char_length(trim(location_name)) >= 2),
  location jsonb,
  starts_at timestamptz not null,
  ends_at timestamptz,
  attendee_count integer not null default 0 check (attendee_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);

create index if not exists events_starts_at_idx on public.events (starts_at);
create index if not exists events_host_idx on public.events (host_id, starts_at desc);

create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

create table if not exists public.event_attendees (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index if not exists event_attendees_user_idx on public.event_attendees (user_id, created_at desc);

-- Keep events.attendee_count in sync (host is not auto-added as attendee).
create or replace function public.sync_event_attendee_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    update public.events
    set attendee_count = attendee_count + 1
    where id = NEW.event_id;
  elsif TG_OP = 'DELETE' then
    update public.events
    set attendee_count = greatest(0, attendee_count - 1)
    where id = OLD.event_id;
  end if;
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists event_attendees_count_ins on public.event_attendees;
create trigger event_attendees_count_ins
after insert on public.event_attendees
for each row execute function public.sync_event_attendee_count();

drop trigger if exists event_attendees_count_del on public.event_attendees;
create trigger event_attendees_count_del
after delete on public.event_attendees
for each row execute function public.sync_event_attendee_count();

alter table public.events enable row level security;
alter table public.event_attendees enable row level security;

drop policy if exists "events: read all" on public.events;
create policy "events: read all"
on public.events for select
to authenticated, anon
using (true);

drop policy if exists "events: insert host" on public.events;
create policy "events: insert host"
on public.events for insert
to authenticated
with check (host_id = auth.uid());

drop policy if exists "events: update host" on public.events;
create policy "events: update host"
on public.events for update
to authenticated
using (host_id = auth.uid())
with check (host_id = auth.uid());

drop policy if exists "events: delete host" on public.events;
create policy "events: delete host"
on public.events for delete
to authenticated
using (host_id = auth.uid());

drop policy if exists "event_attendees: read all" on public.event_attendees;
create policy "event_attendees: read all"
on public.event_attendees for select
to authenticated, anon
using (true);

drop policy if exists "event_attendees: insert self" on public.event_attendees;
create policy "event_attendees: insert self"
on public.event_attendees for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "event_attendees: delete self" on public.event_attendees;
create policy "event_attendees: delete self"
on public.event_attendees for delete
to authenticated
using (user_id = auth.uid());
