-- Wired Build — Mod aggregate triggers (Spec §5.16 Derived values)
--
-- Keeps vehicles.total_spend and parts.install_count in sync as mods are
-- written. The spec calls for these to be recomputed whenever a mod is
-- added, edited, or deleted. Doing it in SQL guarantees the values are
-- correct regardless of which client (mobile app, web, server job) made
-- the change.
--
-- We keep these as synchronous AFTER triggers for simplicity. If the
-- volume of mod writes ever becomes a problem we can convert them to a
-- queued background job per the spec's §7.2 ("Recalculate spend/value").

-- ============================================================================
-- vehicles.total_spend = sum(mods.cost) for that vehicle
-- ============================================================================

create or replace function public.recalc_vehicle_total_spend(p_vehicle_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.vehicles v
  set total_spend = coalesce((
    select sum(m.cost)
    from public.mods m
    where m.vehicle_id = p_vehicle_id
  ), 0)
  where v.id = p_vehicle_id;
end;
$$;

create or replace function public.mods_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    perform public.recalc_vehicle_total_spend(new.vehicle_id);
    if new.part_id is not null then
      update public.parts set install_count = install_count + 1 where id = new.part_id;
    end if;

  elsif (tg_op = 'UPDATE') then
    -- Recalc the source vehicle, and the target if it moved (rare, but
    -- happens when an admin re-attaches a mod to a different vehicle).
    perform public.recalc_vehicle_total_spend(new.vehicle_id);
    if new.vehicle_id <> old.vehicle_id then
      perform public.recalc_vehicle_total_spend(old.vehicle_id);
    end if;

    -- Adjust install_count if the underlying part changed.
    if coalesce(new.part_id::text, '') <> coalesce(old.part_id::text, '') then
      if old.part_id is not null then
        update public.parts set install_count = greatest(0, install_count - 1) where id = old.part_id;
      end if;
      if new.part_id is not null then
        update public.parts set install_count = install_count + 1 where id = new.part_id;
      end if;
    end if;

  elsif (tg_op = 'DELETE') then
    perform public.recalc_vehicle_total_spend(old.vehicle_id);
    if old.part_id is not null then
      update public.parts set install_count = greatest(0, install_count - 1) where id = old.part_id;
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists mods_after_change_trigger on public.mods;
create trigger mods_after_change_trigger
after insert or update or delete on public.mods
for each row execute function public.mods_after_change();
