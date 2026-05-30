-- Direct messages — 1:1 conversations between users.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_low_id uuid not null references public.users(id) on delete cascade,
  user_high_id uuid not null references public.users(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  last_message_body text,
  created_at timestamptz not null default now(),
  constraint conversations_user_order check (user_low_id < user_high_id),
  constraint conversations_distinct_users check (user_low_id <> user_high_id)
);

create unique index if not exists conversations_pair_idx
  on public.conversations (user_low_id, user_high_id);

create index if not exists conversations_last_message_idx
  on public.conversations (last_message_at desc);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint direct_messages_body_len check (char_length(trim(body)) > 0)
);

create index if not exists direct_messages_conversation_idx
  on public.direct_messages (conversation_id, created_at);

create index if not exists direct_messages_unread_idx
  on public.direct_messages (conversation_id, sender_id)
  where read_at is null;

-- Keep conversation preview in sync.
create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set
    last_message_at = new.created_at,
    last_message_body = left(new.body, 280)
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists direct_messages_touch_conversation on public.direct_messages;
create trigger direct_messages_touch_conversation
after insert on public.direct_messages
for each row execute function public.touch_conversation_on_message();

-- Find or create a thread with another user (respects blocks).
create or replace function public.get_or_create_conversation(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_low uuid;
  v_high uuid;
  v_id uuid;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  if p_other_user_id = v_me then
    raise exception 'Cannot message yourself';
  end if;

  if exists (
    select 1 from public.user_blocks
    where (blocker_id = v_me and blocked_id = p_other_user_id)
       or (blocker_id = p_other_user_id and blocked_id = v_me)
  ) then
    raise exception 'Cannot message this user';
  end if;

  if v_me < p_other_user_id then
    v_low := v_me;
    v_high := p_other_user_id;
  else
    v_low := p_other_user_id;
    v_high := v_me;
  end if;

  select id into v_id
  from public.conversations
  where user_low_id = v_low and user_high_id = v_high;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.conversations (user_low_id, user_high_id)
  values (v_low, v_high)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.get_or_create_conversation(uuid) from public;
grant execute on function public.get_or_create_conversation(uuid) to authenticated;

alter table public.conversations enable row level security;
alter table public.direct_messages enable row level security;

drop policy if exists "conversations: participant read" on public.conversations;
create policy "conversations: participant read"
on public.conversations for select
to authenticated
using (user_low_id = auth.uid() or user_high_id = auth.uid());

drop policy if exists "direct_messages: participant read" on public.direct_messages;
create policy "direct_messages: participant read"
on public.direct_messages for select
to authenticated
using (
  exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and (c.user_low_id = auth.uid() or c.user_high_id = auth.uid())
  )
);

drop policy if exists "direct_messages: participant insert" on public.direct_messages;
create policy "direct_messages: participant insert"
on public.direct_messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and (c.user_low_id = auth.uid() or c.user_high_id = auth.uid())
  )
);

drop policy if exists "direct_messages: recipient mark read" on public.direct_messages;
create policy "direct_messages: recipient mark read"
on public.direct_messages for update
to authenticated
using (
  sender_id <> auth.uid()
  and exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and (c.user_low_id = auth.uid() or c.user_high_id = auth.uid())
  )
)
with check (
  sender_id <> auth.uid()
  and exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and (c.user_low_id = auth.uid() or c.user_high_id = auth.uid())
  )
);

-- Realtime for live chat (ignore if publication already has the table).
do $$ begin
  alter publication supabase_realtime add table public.direct_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
