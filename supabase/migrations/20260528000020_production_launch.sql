-- Production launch: manual valuation, thumbnails, vehicle cap, notification prefs, rate limits.

-- Manual owner appraisal
alter table public.vehicles
  add column if not exists manual_build_value numeric(12, 2),
  add column if not exists manual_build_value_at timestamptz,
  add column if not exists manual_build_value_note text;

alter table public.vehicles
  drop constraint if exists vehicles_valuation_source_check;

alter table public.vehicles
  add constraint vehicles_valuation_source_check
  check (valuation_source in ('heuristic', 'redbook', 'kbb', 'manual'));

-- Thumbnail URL for feed performance (set by generate-image-variants or client)
alter table public.media
  add column if not exists thumbnail_url text;

-- Notification preference gate
create or replace function public.notifications_enabled(
  p_user_id uuid,
  p_type public.notification_type
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    case p_type
      when 'follow' then np.follows_enabled
      when 'reaction' then np.reactions_enabled
      when 'comment' then np.comments_enabled
      when 'ownership_transfer' then np.ownership_transfers_enabled
      else true
    end,
    true
  )
  from public.notification_preferences np
  where np.user_id = p_user_id
  union all
  select true
  limit 1;
$$;

-- Patch follow notifications
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
    if not public.notifications_enabled(new.followee_id, 'follow') then
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

-- Free tier vehicle cap (server-side backup to client)
create or replace function public.enforce_vehicle_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier text;
  v_count integer;
begin
  select subscription_tier into v_tier from public.users where id = new.current_owner_id;
  if v_tier is null or v_tier <> 'free' then
    return new;
  end if;
  select count(*)::integer into v_count
  from public.vehicles
  where current_owner_id = new.current_owner_id;
  if v_count >= 3 then
    raise exception 'Free tier is limited to 3 vehicles. Upgrade to Member or higher.';
  end if;
  return new;
end;
$$;

drop trigger if exists vehicles_enforce_free_limit on public.vehicles;
create trigger vehicles_enforce_free_limit
before insert on public.vehicles
for each row execute function public.enforce_vehicle_limit();

-- Rate limit buckets (simple sliding window per action)
create table if not exists public.rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_events_user_action_idx
  on public.rate_limit_events (user_id, action, created_at desc);

alter table public.rate_limit_events enable row level security;

drop policy if exists "rate_limit_events: service only" on public.rate_limit_events;
create policy "rate_limit_events: service only"
on public.rate_limit_events for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.check_rate_limit(
  p_user_id uuid,
  p_action text,
  p_max integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.rate_limit_events
  where user_id = p_user_id
    and action = p_action
    and created_at < now() - (p_window_seconds || ' seconds')::interval;

  select count(*)::integer into v_count
  from public.rate_limit_events
  where user_id = p_user_id
    and action = p_action
    and created_at >= now() - (p_window_seconds || ' seconds')::interval;

  if v_count >= p_max then
    return false;
  end if;

  insert into public.rate_limit_events (user_id, action) values (p_user_id, p_action);
  return true;
end;
$$;

-- recalc respects manual override
create or replace function public.recalc_vehicle_total_spend(p_vehicle_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_spend numeric(12, 2);
  v_mod_count integer;
  v_workshop_count integer;
  v_build_value numeric(12, 2);
  v_source text := 'heuristic';
  v_manual numeric(12, 2);
begin
  select manual_build_value into v_manual from public.vehicles where id = p_vehicle_id;

  select
    coalesce(sum(m.cost), 0)::numeric(12, 2),
    count(*)::integer,
    count(*) filter (where m.installer_type = 'workshop')::integer
  into v_spend, v_mod_count, v_workshop_count
  from public.mods m
  where m.vehicle_id = p_vehicle_id;

  if v_manual is not null and v_manual > 0 then
    v_build_value := v_manual;
    v_source := 'manual';
  else
    v_build_value := public.estimate_build_value_heuristic(
      v_spend,
      v_mod_count,
      v_workshop_count
    );
    -- External APIs: set REDBOOK_API_KEY / KBB_API_KEY; estimate-valuation Edge Function
    -- can update valuation_source to redbook/kbb before calling this RPC.
  end if;

  update public.vehicles v
  set
    total_spend = v_spend,
    build_value = v_build_value,
    valuation_source = v_source
  where v.id = p_vehicle_id;
end;
$$;
