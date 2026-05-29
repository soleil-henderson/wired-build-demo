-- Vehicle documents — private registration, insurance, receipts (Spec §7.1 receipts bucket).

create table if not exists public.vehicle_documents (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  owner_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  file_name text not null,
  storage_key text not null,
  mime_type text not null,
  file_size bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vehicle_documents_vehicle_idx
  on public.vehicle_documents (vehicle_id, created_at desc);

create index if not exists vehicle_documents_owner_idx
  on public.vehicle_documents (owner_id);

create trigger vehicle_documents_set_updated_at
before update on public.vehicle_documents
for each row execute function public.set_updated_at();

alter table public.vehicle_documents enable row level security;

drop policy if exists "vehicle_documents: owner read" on public.vehicle_documents;
create policy "vehicle_documents: owner read"
on public.vehicle_documents for select
to authenticated
using (owner_id = auth.uid());

drop policy if exists "vehicle_documents: owner insert" on public.vehicle_documents;
create policy "vehicle_documents: owner insert"
on public.vehicle_documents for insert
to authenticated
with check (
  owner_id = auth.uid()
  and exists (
    select 1 from public.vehicles v
    where v.id = vehicle_id and v.current_owner_id = auth.uid()
  )
);

drop policy if exists "vehicle_documents: owner update" on public.vehicle_documents;
create policy "vehicle_documents: owner update"
on public.vehicle_documents for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "vehicle_documents: owner delete" on public.vehicle_documents;
create policy "vehicle_documents: owner delete"
on public.vehicle_documents for delete
to authenticated
using (owner_id = auth.uid());
