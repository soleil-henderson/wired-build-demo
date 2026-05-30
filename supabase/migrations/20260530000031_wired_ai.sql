-- Wired AI — chat persistence, usage limits, bulk document import.

do $$ begin
  create type public.ai_message_role as enum ('user', 'assistant', 'tool');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.document_import_batch_status as enum (
    'analyzing',
    'ready',
    'applied',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.document_import_item_status as enum ('pending', 'accepted', 'skipped');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.vehicle_document_type as enum (
    'registration',
    'insurance',
    'service_receipt',
    'invoice',
    'inspection',
    'other'
  );
exception
  when duplicate_object then null;
end $$;

-- Extend vehicle_documents with AI-extracted metadata.
alter table public.vehicle_documents
  add column if not exists document_type public.vehicle_document_type,
  add column if not exists extracted_metadata jsonb;

-- AI conversations (vehicle-scoped).
create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete cascade,
  title text not null default 'Wired AI',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_conversations_user_idx
  on public.ai_conversations (user_id, updated_at desc);

create index if not exists ai_conversations_vehicle_idx
  on public.ai_conversations (vehicle_id, updated_at desc)
  where vehicle_id is not null;

create trigger ai_conversations_set_updated_at
before update on public.ai_conversations
for each row execute function public.set_updated_at();

-- AI messages.
create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role public.ai_message_role not null,
  content jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_conversation_idx
  on public.ai_messages (conversation_id, created_at asc);

-- Monthly usage tracking for free-tier limits.
create table if not exists public.ai_usage_monthly (
  user_id uuid not null references public.users(id) on delete cascade,
  month date not null,
  message_count integer not null default 0,
  tokens_used bigint not null default 0,
  primary key (user_id, month)
);

-- Bulk document import batches.
create table if not exists public.document_import_batches (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status public.document_import_batch_status not null default 'analyzing',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists document_import_batches_vehicle_idx
  on public.document_import_batches (vehicle_id, created_at desc);

create trigger document_import_batches_set_updated_at
before update on public.document_import_batches
for each row execute function public.set_updated_at();

-- Individual files in a batch with AI proposals.
create table if not exists public.document_import_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.document_import_batches(id) on delete cascade,
  temp_storage_key text not null,
  file_name text not null,
  mime_type text not null,
  file_size bigint,
  proposed_document_type public.vehicle_document_type,
  proposed_record_type public.maintenance_record_type,
  proposed_title text,
  proposed_service_date date,
  proposed_cost numeric(12, 2),
  proposed_provider text,
  confidence text,
  reasoning text,
  status public.document_import_item_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists document_import_items_batch_idx
  on public.document_import_items (batch_id);

-- RLS
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_usage_monthly enable row level security;
alter table public.document_import_batches enable row level security;
alter table public.document_import_items enable row level security;

drop policy if exists "ai_conversations: owner read" on public.ai_conversations;
create policy "ai_conversations: owner read"
on public.ai_conversations for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "ai_conversations: owner insert" on public.ai_conversations;
create policy "ai_conversations: owner insert"
on public.ai_conversations for insert
to authenticated
with check (
  user_id = auth.uid()
  and (
    vehicle_id is null
    or exists (
      select 1 from public.vehicles v
      where v.id = vehicle_id and v.current_owner_id = auth.uid()
    )
  )
);

drop policy if exists "ai_conversations: owner update" on public.ai_conversations;
create policy "ai_conversations: owner update"
on public.ai_conversations for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "ai_conversations: owner delete" on public.ai_conversations;
create policy "ai_conversations: owner delete"
on public.ai_conversations for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "ai_messages: owner read" on public.ai_messages;
create policy "ai_messages: owner read"
on public.ai_messages for select
to authenticated
using (
  exists (
    select 1 from public.ai_conversations c
    where c.id = conversation_id and c.user_id = auth.uid()
  )
);

drop policy if exists "ai_messages: owner insert" on public.ai_messages;
create policy "ai_messages: owner insert"
on public.ai_messages for insert
to authenticated
with check (
  exists (
    select 1 from public.ai_conversations c
    where c.id = conversation_id and c.user_id = auth.uid()
  )
);

drop policy if exists "ai_usage_monthly: owner read" on public.ai_usage_monthly;
create policy "ai_usage_monthly: owner read"
on public.ai_usage_monthly for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "document_import_batches: owner read" on public.document_import_batches;
create policy "document_import_batches: owner read"
on public.document_import_batches for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "document_import_batches: owner insert" on public.document_import_batches;
create policy "document_import_batches: owner insert"
on public.document_import_batches for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.vehicles v
    where v.id = vehicle_id and v.current_owner_id = auth.uid()
  )
);

drop policy if exists "document_import_batches: owner update" on public.document_import_batches;
create policy "document_import_batches: owner update"
on public.document_import_batches for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "document_import_batches: owner delete" on public.document_import_batches;
create policy "document_import_batches: owner delete"
on public.document_import_batches for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "document_import_items: owner read" on public.document_import_items;
create policy "document_import_items: owner read"
on public.document_import_items for select
to authenticated
using (
  exists (
    select 1 from public.document_import_batches b
    where b.id = batch_id and b.user_id = auth.uid()
  )
);

drop policy if exists "document_import_items: owner insert" on public.document_import_items;
create policy "document_import_items: owner insert"
on public.document_import_items for insert
to authenticated
with check (
  exists (
    select 1 from public.document_import_batches b
    where b.id = batch_id and b.user_id = auth.uid()
  )
);

drop policy if exists "document_import_items: owner update" on public.document_import_items;
create policy "document_import_items: owner update"
on public.document_import_items for update
to authenticated
using (
  exists (
    select 1 from public.document_import_batches b
    where b.id = batch_id and b.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.document_import_batches b
    where b.id = batch_id and b.user_id = auth.uid()
  )
);

drop policy if exists "document_import_items: owner delete" on public.document_import_items;
create policy "document_import_items: owner delete"
on public.document_import_items for delete
to authenticated
using (
  exists (
    select 1 from public.document_import_batches b
    where b.id = batch_id and b.user_id = auth.uid()
  )
);

-- Increment usage atomically (called from edge function with service role).
create or replace function public.increment_ai_usage(
  p_user_id uuid,
  p_month date,
  p_tokens bigint default 0
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  insert into public.ai_usage_monthly (user_id, month, message_count, tokens_used)
  values (p_user_id, p_month, 1, coalesce(p_tokens, 0))
  on conflict (user_id, month) do update
  set
    message_count = ai_usage_monthly.message_count + 1,
    tokens_used = ai_usage_monthly.tokens_used + coalesce(p_tokens, 0)
  returning message_count into new_count;
  return new_count;
end;
$$;

revoke all on function public.increment_ai_usage(uuid, date, bigint) from public;
grant execute on function public.increment_ai_usage(uuid, date, bigint) to service_role;
