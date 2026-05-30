-- Vehicle maintenance / service history with document attachments.

do $$ begin
  create type public.maintenance_record_type as enum (
    'oil_change',
    'general_service',
    'major_service',
    'inspection',
    'tyres',
    'brakes',
    'registration',
    'insurance',
    'other'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  owner_id uuid not null references public.users(id) on delete cascade,
  record_type public.maintenance_record_type not null,
  title text not null,
  service_date date not null,
  date_is_approximate boolean not null default false,
  odometer_km integer,
  cost numeric(12, 2),
  cost_is_approximate boolean not null default false,
  provider text,
  notes text,
  next_due_date date,
  next_due_odometer_km integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists maintenance_records_vehicle_idx
  on public.maintenance_records (vehicle_id, service_date desc);

create index if not exists maintenance_records_owner_idx
  on public.maintenance_records (owner_id);

create index if not exists maintenance_records_next_due_idx
  on public.maintenance_records (vehicle_id, next_due_date)
  where next_due_date is not null;

create trigger maintenance_records_set_updated_at
before update on public.maintenance_records
for each row execute function public.set_updated_at();

create table if not exists public.maintenance_record_documents (
  maintenance_record_id uuid not null
    references public.maintenance_records(id) on delete cascade,
  document_id uuid not null
    references public.vehicle_documents(id) on delete cascade,
  primary key (maintenance_record_id, document_id)
);

create index if not exists maintenance_record_documents_doc_idx
  on public.maintenance_record_documents (document_id);

alter table public.maintenance_records enable row level security;
alter table public.maintenance_record_documents enable row level security;

drop policy if exists "maintenance_records: owner read" on public.maintenance_records;
create policy "maintenance_records: owner read"
on public.maintenance_records for select
to authenticated
using (owner_id = auth.uid());

drop policy if exists "maintenance_records: owner insert" on public.maintenance_records;
create policy "maintenance_records: owner insert"
on public.maintenance_records for insert
to authenticated
with check (
  owner_id = auth.uid()
  and exists (
    select 1 from public.vehicles v
    where v.id = vehicle_id and v.current_owner_id = auth.uid()
  )
);

drop policy if exists "maintenance_records: owner update" on public.maintenance_records;
create policy "maintenance_records: owner update"
on public.maintenance_records for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "maintenance_records: owner delete" on public.maintenance_records;
create policy "maintenance_records: owner delete"
on public.maintenance_records for delete
to authenticated
using (owner_id = auth.uid());

drop policy if exists "maintenance_record_documents: owner read" on public.maintenance_record_documents;
create policy "maintenance_record_documents: owner read"
on public.maintenance_record_documents for select
to authenticated
using (
  exists (
    select 1 from public.maintenance_records mr
    where mr.id = maintenance_record_id and mr.owner_id = auth.uid()
  )
);

drop policy if exists "maintenance_record_documents: owner insert" on public.maintenance_record_documents;
create policy "maintenance_record_documents: owner insert"
on public.maintenance_record_documents for insert
to authenticated
with check (
  exists (
    select 1 from public.maintenance_records mr
    where mr.id = maintenance_record_id and mr.owner_id = auth.uid()
  )
  and exists (
    select 1 from public.vehicle_documents vd
    where vd.id = document_id and vd.owner_id = auth.uid()
  )
);

drop policy if exists "maintenance_record_documents: owner delete" on public.maintenance_record_documents;
create policy "maintenance_record_documents: owner delete"
on public.maintenance_record_documents for delete
to authenticated
using (
  exists (
    select 1 from public.maintenance_records mr
    where mr.id = maintenance_record_id and mr.owner_id = auth.uid()
  )
);
