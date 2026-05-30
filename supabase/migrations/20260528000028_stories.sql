-- Instagram-style ephemeral stories (24h photo/video).

do $$ begin
  create type public.story_media_kind as enum ('photo', 'video');
exception when duplicate_object then null; end $$;

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  media_url text not null,
  storage_key text not null,
  media_kind public.story_media_kind not null default 'photo',
  thumbnail_url text,
  duration_ms integer,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index if not exists stories_user_active_idx
  on public.stories (user_id, created_at desc);

create index if not exists stories_expires_idx
  on public.stories (expires_at);

create table if not exists public.story_views (
  story_id uuid not null references public.stories(id) on delete cascade,
  viewer_id uuid not null references public.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

create index if not exists story_views_viewer_idx
  on public.story_views (viewer_id, viewed_at desc);

alter table public.stories enable row level security;
alter table public.story_views enable row level security;

-- Helper: can viewer see this user's stories?
create or replace function public.can_view_user_stories(p_owner_id uuid, p_viewer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_owner_id = p_viewer_id
    or (
      p_viewer_id is not null
      and not exists (
        select 1 from public.user_blocks b
        where (b.blocker_id = p_owner_id and b.blocked_id = p_viewer_id)
           or (b.blocker_id = p_viewer_id and b.blocked_id = p_owner_id)
      )
      and (
        not coalesce((select u.is_private from public.users u where u.id = p_owner_id), false)
        or exists (
          select 1 from public.follows f
          where f.follower_id = p_viewer_id and f.followee_id = p_owner_id
        )
      )
    );
$$;

drop policy if exists "stories: select visible" on public.stories;
create policy "stories: select visible"
on public.stories for select
to authenticated
using (
  expires_at > now()
  and public.can_view_user_stories(user_id, auth.uid())
);

drop policy if exists "stories: insert own" on public.stories;
create policy "stories: insert own"
on public.stories for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "stories: delete own" on public.stories;
create policy "stories: delete own"
on public.stories for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "story_views: select related" on public.story_views;
create policy "story_views: select related"
on public.story_views for select
to authenticated
using (
  viewer_id = auth.uid()
  or exists (
    select 1 from public.stories s
    where s.id = story_id and s.user_id = auth.uid()
  )
);

drop policy if exists "story_views: insert own" on public.story_views;
create policy "story_views: insert own"
on public.story_views for insert
to authenticated
with check (
  viewer_id = auth.uid()
  and exists (
    select 1 from public.stories s
    where s.id = story_id
      and s.expires_at > now()
      and public.can_view_user_stories(s.user_id, auth.uid())
  )
);

-- Allow video uploads in mod-photos bucket (stories reuse this bucket).
update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/avif',
  'video/mp4', 'video/quicktime', 'video/webm'
]
where id = 'mod-photos';
