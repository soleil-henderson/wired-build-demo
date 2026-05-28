-- Wired Build — Create feed post when a mod is edited to public.
--
-- The insert-only trigger missed mods that were logged private then
-- flipped to public on edit. Reuse the same helper; fire only when
-- privacy crosses into 'public'.

create or replace function public.ensure_post_for_public_mod()
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
for each row execute function public.ensure_post_for_public_mod();

drop trigger if exists mods_auto_post_on_public_update on public.mods;
create trigger mods_auto_post_on_public_update
after update of privacy on public.mods
for each row
when (old.privacy is distinct from 'public' and new.privacy = 'public')
execute function public.ensure_post_for_public_mod();
