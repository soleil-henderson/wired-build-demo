-- Wired Build — Estimated build_value (Spec §9 Step 6 slice).
--
-- Until a RedBook / KBB integration lands, we derive an *estimated* market
-- value from the logged mod ledger. The formula is intentionally simple
-- and transparent — it's a credibility signal for buyers on the public
-- share page, not a formal appraisal.
--
--   build_value = total_spend × (1.10 integrity + up to 0.20 workshop labor)
--
-- The 1.10 factor reflects that a fully documented VIN-attached history is
-- worth more than an undocumented pile of receipts. The workshop ratio
-- adds up to 20% when every logged mod with a cost was workshop-installed
-- (parts + implied labour). Recomputed in the same trigger path as
-- total_spend so the two never drift.

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
  v_workshop_ratio numeric;
begin
  select
    coalesce(sum(m.cost), 0)::numeric(12, 2),
    count(*)::integer,
    count(*) filter (where m.installer_type = 'workshop')::integer
  into v_spend, v_mod_count, v_workshop_count
  from public.mods m
  where m.vehicle_id = p_vehicle_id;

  if v_spend > 0 then
    v_workshop_ratio := case
      when v_mod_count > 0 then v_workshop_count::numeric / v_mod_count::numeric
      else 0
    end;
    v_build_value := round(
      v_spend * (1.10 + v_workshop_ratio * 0.20),
      2
    );
  else
    v_build_value := null;
  end if;

  update public.vehicles v
  set
    total_spend = v_spend,
    build_value = v_build_value
  where v.id = p_vehicle_id;
end;
$$;

-- Backfill every vehicle that already has mods.
do $$
declare
  r record;
begin
  for r in
    select distinct vehicle_id from public.mods
  loop
    perform public.recalc_vehicle_total_spend(r.vehicle_id);
  end loop;
end;
$$;
