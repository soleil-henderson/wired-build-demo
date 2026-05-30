-- Tools used when installing a mod (owned vs hired, costs, product links).

do $$ begin
  create type tool_ownership as enum ('owned', 'hired');
exception when duplicate_object then null; end $$;

create table if not exists public.mod_tools (
  id uuid primary key default gen_random_uuid(),
  mod_id uuid not null references public.mods(id) on delete cascade,
  name text not null,
  brand text,
  url text,
  ownership tool_ownership not null default 'owned',
  cost numeric(12, 2),
  hire_duration text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mod_tools_mod_idx on public.mod_tools (mod_id, sort_order);
create index if not exists mod_tools_url_idx on public.mod_tools (url) where url is not null;

create trigger mod_tools_set_updated_at
before update on public.mod_tools
for each row execute function public.set_updated_at();

alter table public.mod_tools enable row level security;

drop policy if exists "mod_tools: read with mod" on public.mod_tools;
create policy "mod_tools: read with mod"
on public.mod_tools for select
to authenticated, anon
using (
  exists (
    select 1
    from public.mods m
    join public.vehicles v on v.id = m.vehicle_id
    where m.id = mod_tools.mod_id
      and (
        (m.privacy = 'public' and v.is_public = true)
        or v.current_owner_id = auth.uid()
      )
  )
);

drop policy if exists "mod_tools: insert as mod owner" on public.mod_tools;
create policy "mod_tools: insert as mod owner"
on public.mod_tools for insert
to authenticated
with check (
  exists (
    select 1
    from public.mods m
    join public.vehicles v on v.id = m.vehicle_id
    where m.id = mod_tools.mod_id and v.current_owner_id = auth.uid()
  )
);

drop policy if exists "mod_tools: update as mod owner" on public.mod_tools;
create policy "mod_tools: update as mod owner"
on public.mod_tools for update
to authenticated
using (
  exists (
    select 1
    from public.mods m
    join public.vehicles v on v.id = m.vehicle_id
    where m.id = mod_tools.mod_id and v.current_owner_id = auth.uid()
  )
);

drop policy if exists "mod_tools: delete as mod owner" on public.mod_tools;
create policy "mod_tools: delete as mod owner"
on public.mod_tools for delete
to authenticated
using (
  exists (
    select 1
    from public.mods m
    join public.vehicles v on v.id = m.vehicle_id
    where m.id = mod_tools.mod_id and v.current_owner_id = auth.uid()
  )
);
