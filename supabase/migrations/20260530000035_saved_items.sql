-- Wired Build — bookmark / save posts, mods, and public builds.

do $$ begin
  create type saved_target_type as enum ('post', 'mod', 'vehicle');
exception when duplicate_object then null; end $$;

create table if not exists public.saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  target_type saved_target_type not null,
  target_id uuid not null,
  created_at timestamptz not null default now(),
  constraint saved_items_unique_target unique (user_id, target_type, target_id)
);

create index if not exists saved_items_user_idx
  on public.saved_items (user_id, created_at desc);

create index if not exists saved_items_target_idx
  on public.saved_items (target_type, target_id);

-- Only allow saving content the viewer can see (and not their own builds/mods/posts).
create or replace function public.can_save_target(
  p_target_type saved_target_type,
  p_target_id uuid
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case p_target_type
    when 'vehicle' then exists (
      select 1
      from public.vehicles v
      where v.id = p_target_id
        and v.is_public = true
        and v.current_owner_id is distinct from auth.uid()
    )
    when 'post' then exists (
      select 1
      from public.posts p
      join public.vehicles v on v.id = p.vehicle_id
      where p.id = p_target_id
        and p.user_id is distinct from auth.uid()
        and (v.is_public = true or v.current_owner_id = auth.uid())
        and (
          exists (
            select 1 from public.users u
            where u.id = p.user_id and u.is_private = false
          )
          or exists (
            select 1 from public.follows f
            where f.follower_id = auth.uid()
              and f.followee_id = p.user_id
          )
        )
    )
    when 'mod' then exists (
      select 1
      from public.mods m
      join public.vehicles v on v.id = m.vehicle_id
      where m.id = p_target_id
        and m.privacy = 'public'
        and v.is_public = true
        and v.current_owner_id is distinct from auth.uid()
    )
    else false
  end;
$$;

alter table public.saved_items enable row level security;

drop policy if exists "saved_items: own read" on public.saved_items;
create policy "saved_items: own read"
on public.saved_items for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "saved_items: insert own visible" on public.saved_items;
create policy "saved_items: insert own visible"
on public.saved_items for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.can_save_target(target_type, target_id)
);

drop policy if exists "saved_items: delete own" on public.saved_items;
create policy "saved_items: delete own"
on public.saved_items for delete
to authenticated
using (user_id = auth.uid());
