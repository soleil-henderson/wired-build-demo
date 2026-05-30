-- Private accounts — follow requests for private profiles, instant follow for public.

alter table public.users
  add column if not exists is_private boolean not null default false;

comment on column public.users.is_private is
  'When true, new followers must be approved via follow_requests.';

create table if not exists public.follow_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.users(id) on delete cascade,
  target_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint follow_requests_no_self check (requester_id <> target_id),
  constraint follow_requests_unique unique (requester_id, target_id)
);

create index if not exists follow_requests_target_idx
  on public.follow_requests (target_id, created_at desc);

create index if not exists follow_requests_requester_idx
  on public.follow_requests (requester_id);

alter type public.notification_type add value if not exists 'follow_request';
alter type public.notification_type add value if not exists 'follow_accepted';

-- ---------------------------------------------------------------------------
-- Follow request notifications
-- ---------------------------------------------------------------------------

create or replace function public.notify_on_follow_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester record;
begin
  if tg_op = 'INSERT' then
    select id, handle, display_name, avatar_url
      into v_requester
      from public.users
      where id = new.requester_id;

    insert into public.notifications (user_id, type, payload)
    values (
      new.target_id,
      'follow_request',
      jsonb_build_object(
        'actor_id', v_requester.id,
        'actor_handle', v_requester.handle,
        'actor_display_name', v_requester.display_name,
        'actor_avatar_url', v_requester.avatar_url,
        'request_id', new.id
      )
    );
    return new;
  elsif tg_op = 'DELETE' then
    delete from public.notifications
    where user_id = old.target_id
      and type = 'follow_request'
      and (payload->>'request_id')::uuid = old.id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists follow_requests_notify_trigger on public.follow_requests;
create trigger follow_requests_notify_trigger
after insert or delete on public.follow_requests
for each row execute function public.notify_on_follow_request();

-- Skip followee notification when accepting a pending request.
create or replace function public.notify_on_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_follower record;
begin
  if (tg_op = 'INSERT') then
    if new.follower_id = new.followee_id then
      return new;
    end if;
    if coalesce(current_setting('wired.skip_follow_notify', true), '') = '1' then
      return new;
    end if;
    select id, handle, display_name, avatar_url
      into v_follower
      from public.users
      where id = new.follower_id;

    insert into public.notifications (user_id, type, payload)
    values (
      new.followee_id,
      'follow',
      jsonb_build_object(
        'actor_id', v_follower.id,
        'actor_handle', v_follower.handle,
        'actor_display_name', v_follower.display_name,
        'actor_avatar_url', v_follower.avatar_url
      )
    );
    return new;
  elsif (tg_op = 'DELETE') then
    delete from public.notifications
    where user_id = old.followee_id
      and type = 'follow'
      and (payload->>'actor_id')::uuid = old.follower_id;
    return old;
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: toggle follow / request / cancel
-- ---------------------------------------------------------------------------

create or replace function public.toggle_follow(p_target_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_target public.users%rowtype;
  v_following boolean;
  v_requested boolean;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  if p_target_id = v_me then
    raise exception 'Cannot follow yourself';
  end if;

  select * into v_target from public.users where id = p_target_id;
  if not found then
    raise exception 'User not found';
  end if;

  if exists (
    select 1 from public.user_blocks
    where (blocker_id = v_me and blocked_id = p_target_id)
       or (blocker_id = p_target_id and blocked_id = v_me)
  ) then
    raise exception 'Cannot follow this user';
  end if;

  select exists (
    select 1 from public.follows
    where follower_id = v_me and followee_id = p_target_id
  ) into v_following;

  if v_following then
    delete from public.follows
    where follower_id = v_me and followee_id = p_target_id;
    return jsonb_build_object('status', 'none');
  end if;

  select exists (
    select 1 from public.follow_requests
    where requester_id = v_me and target_id = p_target_id
  ) into v_requested;

  if v_requested then
    delete from public.follow_requests
    where requester_id = v_me and target_id = p_target_id;
    return jsonb_build_object('status', 'none');
  end if;

  if v_target.is_private then
    insert into public.follow_requests (requester_id, target_id)
    values (v_me, p_target_id);
    return jsonb_build_object('status', 'requested');
  end if;

  insert into public.follows (follower_id, followee_id)
  values (v_me, p_target_id);

  return jsonb_build_object('status', 'following');
end;
$$;

revoke all on function public.toggle_follow(uuid) from public;
grant execute on function public.toggle_follow(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: accept / decline follow requests
-- ---------------------------------------------------------------------------

create or replace function public.accept_follow_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_req public.follow_requests%rowtype;
  v_target record;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_req
  from public.follow_requests
  where id = p_request_id and target_id = v_me;

  if not found then
    raise exception 'Follow request not found';
  end if;

  perform set_config('wired.skip_follow_notify', '1', true);
  perform set_config('wired.allow_private_follow_insert', '1', true);

  insert into public.follows (follower_id, followee_id)
  values (v_req.requester_id, v_req.target_id)
  on conflict do nothing;

  perform set_config('wired.allow_private_follow_insert', '0', true);

  delete from public.follow_requests where id = p_request_id;

  select id, handle, display_name, avatar_url
    into v_target
    from public.users
    where id = v_me;

  insert into public.notifications (user_id, type, payload)
  values (
    v_req.requester_id,
    'follow_accepted',
    jsonb_build_object(
      'actor_id', v_target.id,
      'actor_handle', v_target.handle,
      'actor_display_name', v_target.display_name,
      'actor_avatar_url', v_target.avatar_url
    )
  );
end;
$$;

create or replace function public.decline_follow_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.follow_requests
  where id = p_request_id and target_id = v_me;

  if not found then
    raise exception 'Follow request not found';
  end if;
end;
$$;

revoke all on function public.accept_follow_request(uuid) from public;
grant execute on function public.accept_follow_request(uuid) to authenticated;
revoke all on function public.decline_follow_request(uuid) from public;
grant execute on function public.decline_follow_request(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: follow_requests
-- ---------------------------------------------------------------------------

alter table public.follow_requests enable row level security;

drop policy if exists "follow_requests: participant read" on public.follow_requests;
create policy "follow_requests: participant read"
on public.follow_requests for select
to authenticated
using (requester_id = auth.uid() or target_id = auth.uid());

-- Mutations go through RPC only.

-- ---------------------------------------------------------------------------
-- Block direct follows to private accounts (must use toggle_follow RPC)
-- ---------------------------------------------------------------------------

create or replace function public.enforce_follow_privacy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('wired.allow_private_follow_insert', true), '') = '1' then
    return new;
  end if;
  if exists (
    select 1 from public.users u
    where u.id = new.followee_id and u.is_private
  ) then
    raise exception 'This account is private. Send a follow request instead.';
  end if;
  return new;
end;
$$;

drop trigger if exists follows_enforce_privacy on public.follows;
create trigger follows_enforce_privacy
before insert on public.follows
for each row execute function public.enforce_follow_privacy();

-- ---------------------------------------------------------------------------
-- Posts: respect private account visibility
-- ---------------------------------------------------------------------------

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
  and (
    exists (
      select 1 from public.users u
      where u.id = posts.user_id and u.is_private = false
    )
    or posts.user_id = auth.uid()
    or (
      auth.uid() is not null
      and exists (
        select 1 from public.follows f
        where f.follower_id = auth.uid()
          and f.followee_id = posts.user_id
      )
    )
  )
);
