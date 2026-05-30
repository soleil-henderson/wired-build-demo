-- Story captions/stickers/likes + rich DMs (images, audio, story replies, message likes).

alter table public.stories
  add column if not exists caption text,
  add column if not exists stickers jsonb not null default '[]'::jsonb;

create table if not exists public.story_likes (
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  liked_at timestamptz not null default now(),
  primary key (story_id, user_id)
);

create index if not exists story_likes_story_idx
  on public.story_likes (story_id, liked_at desc);

alter table public.story_likes enable row level security;

drop policy if exists "story_likes: select visible" on public.story_likes;
create policy "story_likes: select visible"
on public.story_likes for select
to authenticated
using (
  exists (
    select 1 from public.stories s
    where s.id = story_id
      and s.expires_at > now()
      and public.can_view_user_stories(s.user_id, auth.uid())
  )
);

drop policy if exists "story_likes: insert own" on public.story_likes;
create policy "story_likes: insert own"
on public.story_likes for insert
to authenticated
with check (
  user_id = auth.uid()
  and user_id <> (select s.user_id from public.stories s where s.id = story_id)
  and exists (
    select 1 from public.stories s
    where s.id = story_id
      and s.expires_at > now()
      and public.can_view_user_stories(s.user_id, auth.uid())
  )
);

drop policy if exists "story_likes: delete own" on public.story_likes;
create policy "story_likes: delete own"
on public.story_likes for delete
to authenticated
using (user_id = auth.uid());

do $$ begin
  create type public.dm_message_type as enum ('text', 'image', 'audio', 'story_reply');
exception when duplicate_object then null; end $$;

alter table public.direct_messages
  add column if not exists message_type public.dm_message_type not null default 'text',
  add column if not exists media_url text,
  add column if not exists storage_key text,
  add column if not exists audio_duration_ms integer,
  add column if not exists story_id uuid references public.stories(id) on delete set null;

alter table public.direct_messages alter column body drop not null;

alter table public.direct_messages drop constraint if exists direct_messages_body_len;

alter table public.direct_messages add constraint direct_messages_has_content check (
  (body is not null and char_length(trim(body)) > 0)
  or media_url is not null
);

create index if not exists direct_messages_story_idx
  on public.direct_messages (story_id)
  where story_id is not null;

create table if not exists public.message_likes (
  message_id uuid not null references public.direct_messages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  liked_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists message_likes_message_idx
  on public.message_likes (message_id);

alter table public.message_likes enable row level security;

drop policy if exists "message_likes: participant read" on public.message_likes;
create policy "message_likes: participant read"
on public.message_likes for select
to authenticated
using (
  exists (
    select 1
    from public.direct_messages m
    join public.conversations c on c.id = m.conversation_id
    where m.id = message_id
      and (c.user_low_id = auth.uid() or c.user_high_id = auth.uid())
  )
);

drop policy if exists "message_likes: participant insert" on public.message_likes;
create policy "message_likes: participant insert"
on public.message_likes for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.direct_messages m
    join public.conversations c on c.id = m.conversation_id
    where m.id = message_id
      and (c.user_low_id = auth.uid() or c.user_high_id = auth.uid())
  )
);

drop policy if exists "message_likes: delete own" on public.message_likes;
create policy "message_likes: delete own"
on public.message_likes for delete
to authenticated
using (user_id = auth.uid());

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
    last_message_body = case new.message_type
      when 'image' then '📷 Photo'
      when 'audio' then '🎤 Voice message'
      when 'story_reply' then coalesce(nullif(left(trim(new.body), 280), ''), 'Replied to your story')
      else left(coalesce(new.body, ''), 280)
    end
  where id = new.conversation_id;
  return new;
end;
$$;

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/avif',
  'video/mp4', 'video/quicktime', 'video/webm',
  'audio/m4a', 'audio/mp4', 'audio/aac', 'audio/mpeg', 'audio/x-m4a'
]
where id = 'mod-photos';
