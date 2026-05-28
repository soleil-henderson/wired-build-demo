-- Wired Build — RLS + triggers for the social tables.
--
-- Authorization rules per Spec §3.3:
--   Post/comment/react/follow: any logged-in user (tier limits enforced later)
--   View public build / mod:  anyone, even logged out
--   View private build / mod: only the vehicle's current owner
--
-- Triggers:
--   - auto-create a posts row when a mod is inserted with privacy='public'
--   - keep posts.reaction_count and posts.comment_count in sync

-- ============================================================================
-- RLS: posts
-- ============================================================================

alter table public.posts enable row level security;

-- A post is readable when the underlying vehicle is public (mirror Spec §3.3
-- and what the mods RLS does). Vehicles a user owns are always readable.
drop policy if exists "posts: read public or own" on public.posts;
create policy "posts: read public or own"
on public.posts for select
to authenticated, anon
using (
  exists (
    select 1 from public.vehicles v
    where v.id = posts.vehicle_id
      and (v.is_public = true or v.current_owner_id = auth.uid())
  )
);

-- Authors can insert their own post, and only against vehicles they own.
drop policy if exists "posts: insert own" on public.posts;
create policy "posts: insert own"
on public.posts for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.vehicles v
    where v.id = posts.vehicle_id and v.current_owner_id = auth.uid()
  )
);

drop policy if exists "posts: update own" on public.posts;
create policy "posts: update own"
on public.posts for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "posts: delete own" on public.posts;
create policy "posts: delete own"
on public.posts for delete
to authenticated
using (user_id = auth.uid());

-- ============================================================================
-- RLS: comments
-- ============================================================================

alter table public.comments enable row level security;

-- Comments are readable when the parent post is readable.
drop policy if exists "comments: read when post visible" on public.comments;
create policy "comments: read when post visible"
on public.comments for select
to authenticated, anon
using (
  exists (
    select 1
    from public.posts p
    join public.vehicles v on v.id = p.vehicle_id
    where p.id = comments.post_id
      and (v.is_public = true or v.current_owner_id = auth.uid())
  )
);

drop policy if exists "comments: insert own" on public.comments;
create policy "comments: insert own"
on public.comments for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.posts p
    join public.vehicles v on v.id = p.vehicle_id
    where p.id = comments.post_id
      and (v.is_public = true or v.current_owner_id = auth.uid())
  )
);

drop policy if exists "comments: update own" on public.comments;
create policy "comments: update own"
on public.comments for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "comments: delete own" on public.comments;
create policy "comments: delete own"
on public.comments for delete
to authenticated
using (user_id = auth.uid());

-- ============================================================================
-- RLS: reactions
-- ============================================================================

alter table public.reactions enable row level security;

-- Reactions are public counts; we let any reader see them so the UI can render
-- "you liked this" indicators. Writes are restricted to own row.
drop policy if exists "reactions: read all" on public.reactions;
create policy "reactions: read all"
on public.reactions for select
to authenticated, anon
using (true);

drop policy if exists "reactions: insert own" on public.reactions;
create policy "reactions: insert own"
on public.reactions for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "reactions: delete own" on public.reactions;
create policy "reactions: delete own"
on public.reactions for delete
to authenticated
using (user_id = auth.uid());

-- ============================================================================
-- RLS: follows
-- ============================================================================

alter table public.follows enable row level security;

drop policy if exists "follows: read all" on public.follows;
create policy "follows: read all"
on public.follows for select
to authenticated, anon
using (true);

drop policy if exists "follows: insert own" on public.follows;
create policy "follows: insert own"
on public.follows for insert
to authenticated
with check (follower_id = auth.uid());

drop policy if exists "follows: delete own" on public.follows;
create policy "follows: delete own"
on public.follows for delete
to authenticated
using (follower_id = auth.uid());

-- ============================================================================
-- RLS: notifications (own-only)
-- ============================================================================

alter table public.notifications enable row level security;

drop policy if exists "notifications: read own" on public.notifications;
create policy "notifications: read own"
on public.notifications for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "notifications: update own" on public.notifications;
create policy "notifications: update own"
on public.notifications for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "notifications: delete own" on public.notifications;
create policy "notifications: delete own"
on public.notifications for delete
to authenticated
using (user_id = auth.uid());

-- ============================================================================
-- Trigger: auto-create a post when a public mod is inserted (Spec §4.1)
-- ============================================================================

create or replace function public.create_post_for_public_mod()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
begin
  if new.privacy <> 'public' then
    return new;
  end if;

  select v.current_owner_id into v_owner_id
  from public.vehicles v
  where v.id = new.vehicle_id;

  if v_owner_id is null then
    return new;
  end if;

  insert into public.posts (user_id, vehicle_id, mod_id)
  values (v_owner_id, new.vehicle_id, new.id)
  on conflict (mod_id) where mod_id is not null do nothing;

  return new;
end;
$$;

drop trigger if exists mods_auto_post_trigger on public.mods;
create trigger mods_auto_post_trigger
after insert on public.mods
for each row execute function public.create_post_for_public_mod();

-- ============================================================================
-- Trigger: keep posts.reaction_count in sync with reactions on that post
-- ============================================================================

create or replace function public.reactions_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT' and new.target_type = 'post') then
    update public.posts
    set reaction_count = reaction_count + 1
    where id = new.target_id;
  elsif (tg_op = 'DELETE' and old.target_type = 'post') then
    update public.posts
    set reaction_count = greatest(0, reaction_count - 1)
    where id = old.target_id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists reactions_after_change_trigger on public.reactions;
create trigger reactions_after_change_trigger
after insert or delete on public.reactions
for each row execute function public.reactions_after_change();

-- ============================================================================
-- Trigger: keep posts.comment_count in sync
-- ============================================================================

create or replace function public.comments_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif (tg_op = 'DELETE') then
    update public.posts set comment_count = greatest(0, comment_count - 1) where id = old.post_id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists comments_after_change_trigger on public.comments;
create trigger comments_after_change_trigger
after insert or delete on public.comments
for each row execute function public.comments_after_change();
