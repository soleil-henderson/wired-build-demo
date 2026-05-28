-- Wired Build — Row Level Security (Spec §3.3 Authorization rules)
--
-- Default posture: deny everything. Each policy below opens up exactly the
-- access the spec calls for and nothing more.

-- ============================================================================
-- Enable RLS on every public table
-- ============================================================================

alter table public.users     enable row level security;
alter table public.vehicles  enable row level security;
alter table public.parts     enable row level security;
alter table public.mods      enable row level security;
alter table public.media     enable row level security;

-- ============================================================================
-- users
-- ============================================================================

-- Anyone signed in can see public profile info on any user (handle, display_name, etc.).
-- The columns themselves are not sensitive; the app should choose which to render.
drop policy if exists "users: read all" on public.users;
create policy "users: read all"
on public.users for select
to authenticated, anon
using (true);

-- A user can only update their own row.
drop policy if exists "users: update self" on public.users;
create policy "users: update self"
on public.users for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Inserts happen via the auth trigger (security definer); block direct client inserts.
drop policy if exists "users: insert self" on public.users;
create policy "users: insert self"
on public.users for insert
to authenticated
with check (auth.uid() = id);

-- ============================================================================
-- vehicles
-- ============================================================================

-- Public vehicles are visible to everyone; private vehicles only to their owner.
drop policy if exists "vehicles: read public or own" on public.vehicles;
create policy "vehicles: read public or own"
on public.vehicles for select
to authenticated, anon
using (
  is_public = true
  or current_owner_id = auth.uid()
);

-- Only the authenticated user can insert a vehicle they own.
drop policy if exists "vehicles: insert as owner" on public.vehicles;
create policy "vehicles: insert as owner"
on public.vehicles for insert
to authenticated
with check (current_owner_id = auth.uid());

-- Only the current owner can update or delete.
drop policy if exists "vehicles: update own" on public.vehicles;
create policy "vehicles: update own"
on public.vehicles for update
to authenticated
using (current_owner_id = auth.uid())
with check (current_owner_id = auth.uid());

drop policy if exists "vehicles: delete own" on public.vehicles;
create policy "vehicles: delete own"
on public.vehicles for delete
to authenticated
using (current_owner_id = auth.uid());

-- ============================================================================
-- parts (shared catalogue)
-- ============================================================================

-- Approved parts are visible to everyone. Pending parts only to the submitter
-- (we don't track submitter yet; lock pending to authenticated for now).
drop policy if exists "parts: read approved" on public.parts;
create policy "parts: read approved"
on public.parts for select
to authenticated, anon
using (is_approved = true);

drop policy if exists "parts: read pending authed" on public.parts;
create policy "parts: read pending authed"
on public.parts for select
to authenticated
using (is_approved = false);

-- Any authenticated user can submit a custom part; it lands as is_approved=false.
drop policy if exists "parts: insert as community" on public.parts;
create policy "parts: insert as community"
on public.parts for insert
to authenticated
with check (source = 'community' and is_approved = false);

-- No client-side updates or deletes; moderation happens server-side.

-- ============================================================================
-- mods
-- ============================================================================

-- Read: public mods on public vehicles are visible to everyone; private/followers
-- mods only to the vehicle's owner (followers tier is enforced once follows exist).
drop policy if exists "mods: read public" on public.mods;
create policy "mods: read public"
on public.mods for select
to authenticated, anon
using (
  privacy = 'public'
  and exists (
    select 1 from public.vehicles v
    where v.id = mods.vehicle_id and v.is_public = true
  )
);

drop policy if exists "mods: read own" on public.mods;
create policy "mods: read own"
on public.mods for select
to authenticated
using (
  exists (
    select 1 from public.vehicles v
    where v.id = mods.vehicle_id and v.current_owner_id = auth.uid()
  )
);

-- Only the vehicle's owner can write mods against it.
drop policy if exists "mods: insert as vehicle owner" on public.mods;
create policy "mods: insert as vehicle owner"
on public.mods for insert
to authenticated
with check (
  exists (
    select 1 from public.vehicles v
    where v.id = mods.vehicle_id and v.current_owner_id = auth.uid()
  )
);

drop policy if exists "mods: update as vehicle owner" on public.mods;
create policy "mods: update as vehicle owner"
on public.mods for update
to authenticated
using (
  exists (
    select 1 from public.vehicles v
    where v.id = mods.vehicle_id and v.current_owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.vehicles v
    where v.id = mods.vehicle_id and v.current_owner_id = auth.uid()
  )
);

drop policy if exists "mods: delete as vehicle owner" on public.mods;
create policy "mods: delete as vehicle owner"
on public.mods for delete
to authenticated
using (
  exists (
    select 1 from public.vehicles v
    where v.id = mods.vehicle_id and v.current_owner_id = auth.uid()
  )
);

-- ============================================================================
-- media
-- ============================================================================

-- Read: own media always; non-sensitive media attached to a public mod on a
-- public vehicle is visible to anyone.
drop policy if exists "media: read public photos" on public.media;
create policy "media: read public photos"
on public.media for select
to authenticated, anon
using (
  is_sensitive = false
  and mod_id is not null
  and exists (
    select 1
    from public.mods m
    join public.vehicles v on v.id = m.vehicle_id
    where m.id = media.mod_id
      and m.privacy = 'public'
      and v.is_public = true
  )
);

drop policy if exists "media: read own" on public.media;
create policy "media: read own"
on public.media for select
to authenticated
using (owner_id = auth.uid());

-- Owner-only writes.
drop policy if exists "media: insert own" on public.media;
create policy "media: insert own"
on public.media for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "media: update own" on public.media;
create policy "media: update own"
on public.media for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "media: delete own" on public.media;
create policy "media: delete own"
on public.media for delete
to authenticated
using (owner_id = auth.uid());
