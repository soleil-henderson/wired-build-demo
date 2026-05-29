-- Wired Build — marketplace, admin, workshops, saved searches, blocks, plan items.

-- Admin flag for in-app moderation (set manually in Studio for now).
alter table public.users
  add column if not exists is_admin boolean not null default false;

-- Marketplace
alter table public.vehicles
  add column if not exists asking_price numeric(12, 2);

-- Saved explore searches (Member perk)
create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  query text not null,
  created_at timestamptz not null default now()
);

create index if not exists saved_searches_user_idx on public.saved_searches (user_id);

alter table public.saved_searches enable row level security;

drop policy if exists "saved_searches: own" on public.saved_searches;
create policy "saved_searches: own"
on public.saved_searches for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- User blocks
create table if not exists public.user_blocks (
  blocker_id uuid not null references public.users(id) on delete cascade,
  blocked_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_no_self check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;

drop policy if exists "user_blocks: own read" on public.user_blocks;
create policy "user_blocks: own read"
on public.user_blocks for select
to authenticated
using (blocker_id = auth.uid());

drop policy if exists "user_blocks: insert own" on public.user_blocks;
create policy "user_blocks: insert own"
on public.user_blocks for insert
to authenticated
with check (blocker_id = auth.uid());

drop policy if exists "user_blocks: delete own" on public.user_blocks;
create policy "user_blocks: delete own"
on public.user_blocks for delete
to authenticated
using (blocker_id = auth.uid());

-- Notification preferences
create table if not exists public.notification_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  follows_enabled boolean not null default true,
  reactions_enabled boolean not null default true,
  comments_enabled boolean not null default true,
  ownership_transfers_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists "notification_preferences: own" on public.notification_preferences;
create policy "notification_preferences: own"
on public.notification_preferences for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Workshop business fields
alter table public.users
  add column if not exists workshop_name text,
  add column if not exists workshop_phone text,
  add column if not exists workshop_website text;

-- Plan items (structured build plan beyond wishlist)
create table if not exists public.plan_items (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  target_cost numeric(12, 2),
  notes text,
  sort_order integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists plan_items_vehicle_idx on public.plan_items (vehicle_id);

create trigger plan_items_set_updated_at
before update on public.plan_items
for each row execute function public.set_updated_at();

alter table public.plan_items enable row level security;

drop policy if exists "plan_items: vehicle owner" on public.plan_items;
create policy "plan_items: vehicle owner"
on public.plan_items for all
to authenticated
using (
  exists (
    select 1 from public.vehicles v
    where v.id = plan_items.vehicle_id and v.current_owner_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.vehicles v
    where v.id = plan_items.vehicle_id and v.current_owner_id = auth.uid()
  )
);

-- Wire mods.from_plan_item_id FK
alter table public.mods
  drop constraint if exists mods_from_plan_item_id_fkey;

alter table public.mods
  add constraint mods_from_plan_item_id_fkey
  foreign key (from_plan_item_id) references public.plan_items(id) on delete set null;

-- Parts moderation: admins can approve community submissions
drop policy if exists "parts: admin approve" on public.parts;
create policy "parts: admin approve"
on public.parts for update
to authenticated
using (
  exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin = true)
)
with check (
  exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin = true)
);
