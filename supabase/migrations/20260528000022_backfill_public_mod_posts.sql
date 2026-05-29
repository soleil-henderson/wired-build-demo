-- Backfill feed posts for public mods that predate the auto-post trigger.

insert into public.posts (user_id, vehicle_id, mod_id)
select v.current_owner_id, m.vehicle_id, m.id
from public.mods m
join public.vehicles v on v.id = m.vehicle_id
where m.privacy = 'public'
  and v.is_public = true
  and not exists (
    select 1 from public.posts p where p.mod_id = m.id
  )
on conflict (mod_id) where mod_id is not null do nothing;
