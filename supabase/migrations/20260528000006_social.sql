-- Wired Build — Social tables (Spec §5.9 – §5.13)
--
-- Posts are the unit of the Feed. Most posts are auto-created when a mod is
-- logged with privacy='public' (see migration 0007), but a user can also write
-- a standalone post tied to their vehicle (no mod_id).
--
-- The `reactions` table is polymorphic: a row can target a post, a mod, or a
-- comment. We keep this as a single table per the spec rather than splitting
-- into per-target tables.

-- ============================================================================
-- Enums
-- ============================================================================

do $$ begin
  create type reaction_target as enum ('post', 'mod', 'comment');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reaction_type as enum ('like');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_type as enum ('reaction', 'comment', 'follow', 'price_alert', 'verification');
exception when duplicate_object then null; end $$;

-- ============================================================================
-- 5.9 posts
-- ============================================================================

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  mod_id uuid references public.mods(id) on delete cascade,
  body text,
  reaction_count integer not null default 0,
  comment_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_user_idx on public.posts (user_id);
create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_vehicle_idx on public.posts (vehicle_id);
-- One auto-post per mod; a manual standalone post has mod_id = null and is allowed any number of times.
create unique index if not exists posts_mod_unique_idx on public.posts (mod_id) where mod_id is not null;

create trigger posts_set_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

-- ============================================================================
-- 5.10 comments
-- ============================================================================

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  parent_comment_id uuid references public.comments(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists comments_post_idx on public.comments (post_id, created_at);
create index if not exists comments_user_idx on public.comments (user_id);

create trigger comments_set_updated_at
before update on public.comments
for each row execute function public.set_updated_at();

-- ============================================================================
-- 5.11 reactions (polymorphic)
-- ============================================================================

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  target_type reaction_target not null,
  target_id uuid not null,
  type reaction_type not null default 'like',
  created_at timestamptz not null default now()
);

-- One reaction per user per (target_type, target_id, type).
create unique index if not exists reactions_unique_per_target
  on public.reactions (user_id, target_type, target_id, type);

create index if not exists reactions_target_idx on public.reactions (target_type, target_id);

-- ============================================================================
-- 5.12 follows
-- ============================================================================

create table if not exists public.follows (
  follower_id uuid not null references public.users(id) on delete cascade,
  followee_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_no_self_follow check (follower_id <> followee_id)
);

create index if not exists follows_followee_idx on public.follows (followee_id);

-- ============================================================================
-- 5.13 notifications
-- ============================================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type notification_type not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;
