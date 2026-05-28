-- Wired Build — Plan / Wishlist (Spec §4.5).
--
-- A wishlist item is a planned mod that hasn't been installed yet. It can
-- reference a catalogue part or just be a freeform "want" with a custom name.
-- When the user actually installs it, the row promotes to a `mods` insert and
-- the wishlist row is deleted (handled in the client layer for now).

-- ============================================================================
-- Enum
-- ============================================================================

do $$ begin
  create type wishlist_priority as enum ('low', 'medium', 'high');
exception when duplicate_object then null; end $$;

-- ============================================================================
-- Table
-- ============================================================================

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  -- vehicle is nullable so a user can have a "general" wishlist that isn't
  -- tied to one rig yet (Spec §4.5: "I want to upgrade my next build with…")
  vehicle_id uuid references public.vehicles(id) on delete cascade,
  part_id uuid references public.parts(id) on delete set null,
  custom_part_name text,
  category mod_category,
  target_cost numeric(10, 2),
  notes text,
  priority wishlist_priority not null default 'medium',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A wishlist row must point at *something* — either a catalogue part or a
  -- custom name. Otherwise it's just an empty placeholder.
  constraint wishlist_items_has_target
    check (part_id is not null or coalesce(trim(custom_part_name), '') <> '')
);

create index if not exists wishlist_items_user_idx
  on public.wishlist_items (user_id, created_at desc);
create index if not exists wishlist_items_vehicle_idx
  on public.wishlist_items (vehicle_id);
create index if not exists wishlist_items_priority_idx
  on public.wishlist_items (priority);

create trigger wishlist_items_set_updated_at
before update on public.wishlist_items
for each row execute function public.set_updated_at();

-- ============================================================================
-- RLS — strictly own-only (private planning, Spec §3.3)
-- ============================================================================

alter table public.wishlist_items enable row level security;

drop policy if exists "wishlist: read own" on public.wishlist_items;
create policy "wishlist: read own"
on public.wishlist_items for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "wishlist: insert own" on public.wishlist_items;
create policy "wishlist: insert own"
on public.wishlist_items for insert
to authenticated
with check (
  user_id = auth.uid()
  and (
    vehicle_id is null
    or exists (
      select 1 from public.vehicles v
      where v.id = wishlist_items.vehicle_id
        and v.current_owner_id = auth.uid()
    )
  )
);

drop policy if exists "wishlist: update own" on public.wishlist_items;
create policy "wishlist: update own"
on public.wishlist_items for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "wishlist: delete own" on public.wishlist_items;
create policy "wishlist: delete own"
on public.wishlist_items for delete
to authenticated
using (user_id = auth.uid());
