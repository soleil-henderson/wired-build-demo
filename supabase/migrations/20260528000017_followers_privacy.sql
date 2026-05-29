-- Wired Build — enforce mod privacy = 'followers' in RLS + post lifecycle.

-- ---------------------------------------------------------------------------
-- Mods: followers of the vehicle owner can read followers-only mods on public builds
-- ---------------------------------------------------------------------------
drop policy if exists "mods: read followers" on public.mods;
create policy "mods: read followers"
on public.mods for select
to authenticated
using (
  privacy = 'followers'
  and exists (
    select 1
    from public.vehicles v
    where v.id = mods.vehicle_id
      and v.is_public = true
  )
  and exists (
    select 1
    from public.vehicles v
    join public.follows f on f.followee_id = v.current_owner_id
    where v.id = mods.vehicle_id
      and f.follower_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- Media: non-sensitive photos on followers-visible mods
-- ---------------------------------------------------------------------------
drop policy if exists "media: read followers mod photos" on public.media;
create policy "media: read followers mod photos"
on public.media for select
to authenticated
using (
  is_sensitive = false
  and mod_id is not null
  and exists (
    select 1
    from public.mods m
    join public.vehicles v on v.id = m.vehicle_id
    join public.follows f on f.followee_id = v.current_owner_id and f.follower_id = auth.uid()
    where m.id = media.mod_id
      and m.privacy = 'followers'
      and v.is_public = true
  )
);

-- ---------------------------------------------------------------------------
-- Remove feed post when mod is no longer public
-- ---------------------------------------------------------------------------
create or replace function public.handle_mod_privacy_downgrade()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and old.privacy = 'public'
     and new.privacy is distinct from 'public' then
    delete from public.posts where mod_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists mods_privacy_downgrade_post on public.mods;
create trigger mods_privacy_downgrade_post
after update of privacy on public.mods
for each row
when (old.privacy = 'public' and new.privacy is distinct from 'public')
execute function public.handle_mod_privacy_downgrade();
