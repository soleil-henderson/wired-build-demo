-- Wired Build — Ownership transfer (Spec §3.2, §9 Step 6).
--
-- Background: vehicles already store `current_owner_id` and an
-- `ownership_chain` jsonb array. RLS only allows the current owner to update
-- the row AND requires the resulting row to still have them as owner — so a
-- naive UPDATE that changes `current_owner_id` fails by design. The transfer
-- therefore goes through a SECURITY DEFINER RPC that performs both the chain
-- append and the owner swap atomically, then emits a notification.

-- ============================================================================
-- New notification type
--
-- NOTE: `ALTER TYPE ... ADD VALUE` runs fine inside a migration transaction
-- as long as the new value isn't *used* in the same transaction. The function
-- body below references it as a literal cast at function-execution time, not
-- at migration time, so this is safe.
-- ============================================================================

alter type notification_type add value if not exists 'ownership_transfer';

-- ============================================================================
-- Audit table
-- ============================================================================

create table if not exists public.ownership_transfers (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  from_user_id uuid not null references public.users(id) on delete set null,
  to_user_id uuid not null references public.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists ownership_transfers_vehicle_idx
  on public.ownership_transfers (vehicle_id, created_at desc);
create index if not exists ownership_transfers_from_idx
  on public.ownership_transfers (from_user_id);
create index if not exists ownership_transfers_to_idx
  on public.ownership_transfers (to_user_id);

alter table public.ownership_transfers enable row level security;

-- Read: either party of the transfer, plus anyone who can see the underlying
-- public vehicle (so a buyer can audit a build's chain of custody before
-- buying — Spec's "transferable, monetisable asset" pitch).
drop policy if exists "ownership_transfers: read visible" on public.ownership_transfers;
create policy "ownership_transfers: read visible"
on public.ownership_transfers for select
to authenticated, anon
using (
  from_user_id = auth.uid()
  or to_user_id = auth.uid()
  or exists (
    select 1 from public.vehicles v
    where v.id = ownership_transfers.vehicle_id
      and v.is_public = true
  )
);

-- No direct writes from clients. All inserts/updates/deletes go through the
-- transfer_vehicle_ownership() SECURITY DEFINER function below. (Omitting
-- write policies leaves the table effectively write-locked to clients.)

-- ============================================================================
-- The transfer RPC
-- ============================================================================

create or replace function public.transfer_vehicle_ownership(
  p_vehicle_id uuid,
  p_new_owner_id uuid,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_current_owner uuid;
begin
  if v_caller is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select current_owner_id
    into v_current_owner
    from public.vehicles
    where id = p_vehicle_id
    for update;

  if v_current_owner is null then
    raise exception 'Vehicle not found' using errcode = 'P0002';
  end if;

  if v_current_owner <> v_caller then
    raise exception 'Only the current owner can transfer this vehicle'
      using errcode = '42501';
  end if;

  if v_current_owner = p_new_owner_id then
    raise exception 'Cannot transfer to yourself' using errcode = '22023';
  end if;

  if not exists (select 1 from public.users where id = p_new_owner_id) then
    raise exception 'New owner not found' using errcode = 'P0002';
  end if;

  -- Atomic: swap the owner and append a chain entry in the same UPDATE.
  update public.vehicles
  set
    current_owner_id = p_new_owner_id,
    ownership_chain = ownership_chain || jsonb_build_object(
      'from_user_id', v_current_owner,
      'to_user_id', p_new_owner_id,
      'transferred_at', now(),
      'note', p_note
    )
  where id = p_vehicle_id;

  -- Audit trail (richer than the jsonb blob for joins / queries).
  insert into public.ownership_transfers (vehicle_id, from_user_id, to_user_id, note)
  values (p_vehicle_id, v_current_owner, p_new_owner_id, p_note);

  -- Notify the new owner.
  insert into public.notifications (user_id, type, payload)
  select
    p_new_owner_id,
    'ownership_transfer'::notification_type,
    jsonb_build_object(
      'actor_id', u.id,
      'actor_handle', u.handle,
      'actor_display_name', u.display_name,
      'actor_avatar_url', u.avatar_url,
      'vehicle_id', p_vehicle_id,
      'note', p_note
    )
  from public.users u
  where u.id = v_current_owner;
end;
$$;

-- Lock down execution to authenticated callers. (anon must never be able to
-- transfer anything, even if it's their own vehicle — they have none.)
revoke all on function public.transfer_vehicle_ownership(uuid, uuid, text) from public;
grant execute on function public.transfer_vehicle_ownership(uuid, uuid, text) to authenticated;
