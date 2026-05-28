-- Wired Build — valuation_source + extracted heuristic estimator.
--
-- Today every build uses the mod-ledger heuristic. When RedBook / KBB API
-- keys are wired in, recalc_vehicle_total_spend can branch on
-- valuation_source and call an external estimator; the column is already
-- on vehicles for the UI to show the provenance.

alter table public.vehicles
  add column if not exists valuation_source text not null default 'heuristic';

alter table public.vehicles
  drop constraint if exists vehicles_valuation_source_check;

alter table public.vehicles
  add constraint vehicles_valuation_source_check
  check (valuation_source in ('heuristic', 'redbook', 'kbb'));

create or replace function public.estimate_build_value_heuristic(
  p_total_spend numeric,
  p_mod_count integer,
  p_workshop_count integer
)
returns numeric
language plpgsql
immutable
as $$
declare
  v_workshop_ratio numeric;
begin
  if p_total_spend is null or p_total_spend <= 0 then
    return null;
  end if;

  v_workshop_ratio := case
    when p_mod_count > 0 then p_workshop_count::numeric / p_mod_count::numeric
    else 0
  end;

  return round(p_total_spend * (1.10 + v_workshop_ratio * 0.20), 2);
end;
$$;

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
begin
  select
    coalesce(sum(m.cost), 0)::numeric(12, 2),
    count(*)::integer,
    count(*) filter (where m.installer_type = 'workshop')::integer
  into v_spend, v_mod_count, v_workshop_count
  from public.mods m
  where m.vehicle_id = p_vehicle_id;

  -- Future: when RedBook/KBB credentials exist, branch here and set
  -- v_source := 'redbook' / 'kbb' from an external estimator RPC.
  v_build_value := public.estimate_build_value_heuristic(
    v_spend,
    v_mod_count,
    v_workshop_count
  );

  update public.vehicles v
  set
    total_spend = v_spend,
    build_value = v_build_value,
    valuation_source = v_source
  where v.id = p_vehicle_id;
end;
$$;
