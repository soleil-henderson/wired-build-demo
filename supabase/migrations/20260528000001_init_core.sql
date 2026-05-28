-- Wired Build — Core schema (Spec §5.1 - §5.5 + §5.17)
--
-- This migration creates the foundational tables: users, vehicles, parts, mods, media.
-- The VIN is the canonical identifier for a vehicle (Spec §0 "The VIN is the spine").
--
-- Auth: `users.id` matches `auth.users.id`. We populate users via a trigger when an
-- auth user is created so we never have an authenticated user without a profile row.

-- ============================================================================
-- Extensions
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ============================================================================
-- Enum types (Spec §5.1 - §5.5)
-- ============================================================================

do $$ begin
  create type subscription_tier as enum ('free', 'member', 'pro', 'workshop');
exception when duplicate_object then null; end $$;

do $$ begin
  create type mod_category as enum (
    'suspension', 'drivetrain', 'body', 'recovery', 'interior',
    'lighting', 'electrical', 'wheels_tyres', 'camping', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type installer_type as enum ('self', 'workshop', 'friend', 'dealer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type mod_privacy as enum ('public', 'followers', 'private');
exception when duplicate_object then null; end $$;

do $$ begin
  create type install_difficulty as enum ('easy', 'moderate', 'professional');
exception when duplicate_object then null; end $$;

do $$ begin
  create type part_source as enum ('brand', 'wired', 'community');
exception when duplicate_object then null; end $$;

do $$ begin
  create type media_kind as enum ('photo', 'receipt', 'cover', 'avatar');
exception when duplicate_object then null; end $$;

-- ============================================================================
-- Shared helpers
-- ============================================================================

-- A reusable trigger function that bumps updated_at on every row update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- 5.1 users
-- ============================================================================

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  handle citext unique not null,
  display_name text not null,
  email citext unique not null,
  email_verified boolean not null default false,
  avatar_url text,
  bio text,
  location jsonb,
  subscription_tier subscription_tier not null default 'free',
  auth_providers jsonb not null default '[]'::jsonb,
  push_token text,
  is_identity_verified boolean not null default false,
  is_workshop boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_handle_format check (handle ~* '^[a-z0-9_]{3,30}$')
);

create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

-- ============================================================================
-- 5.2 vehicles
-- ============================================================================

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  vin text unique not null,
  current_owner_id uuid not null references public.users(id) on delete restrict,
  ownership_chain jsonb not null default '[]'::jsonb,
  year integer not null,
  make text not null,
  model text not null,
  trim text,
  nickname text,
  cover_photo_url text,
  is_public boolean not null default true,
  is_for_sale boolean not null default false,
  total_spend numeric(12, 2) not null default 0,
  build_value numeric(12, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicles_vin_length check (char_length(vin) = 17),
  constraint vehicles_year_range check (year between 1900 and extract(year from now())::int + 2)
);

create index if not exists vehicles_current_owner_idx on public.vehicles (current_owner_id);

create trigger vehicles_set_updated_at
before update on public.vehicles
for each row execute function public.set_updated_at();

-- ============================================================================
-- 5.3 parts (shared catalogue)
-- ============================================================================

create table if not exists public.parts (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  name text not null,
  sku text,
  category mod_category not null,
  price_min numeric(12, 2),
  price_max numeric(12, 2),
  fitment jsonb not null default '{}'::jsonb,
  affiliate_links jsonb not null default '{}'::jsonb,
  hero_image_url text,
  install_difficulty install_difficulty,
  install_count integer not null default 0,
  avg_rating numeric(3, 2),
  source part_source not null default 'community',
  is_approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parts_price_range check (price_min is null or price_max is null or price_min <= price_max)
);

create index if not exists parts_brand_name_idx on public.parts (brand, name);
create index if not exists parts_category_idx on public.parts (category);
create index if not exists parts_approved_idx on public.parts (is_approved) where is_approved = true;

create trigger parts_set_updated_at
before update on public.parts
for each row execute function public.set_updated_at();

-- ============================================================================
-- 5.5 media (created before mods so the FK from mods.receipt_media_id resolves)
-- ============================================================================

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  mod_id uuid, -- FK added after mods table is created (circular ref)
  url text not null,
  storage_key text not null,
  kind media_kind not null,
  width integer,
  height integer,
  is_sensitive boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists media_owner_idx on public.media (owner_id);
create index if not exists media_mod_idx on public.media (mod_id);

create trigger media_set_updated_at
before update on public.media
for each row execute function public.set_updated_at();

-- ============================================================================
-- 5.4 mods (the core unit of the app)
-- ============================================================================

create table if not exists public.mods (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  part_id uuid references public.parts(id) on delete set null,
  custom_part_name text,
  category mod_category not null,
  cost numeric(12, 2),
  cost_is_approximate boolean not null default false,
  installer_type installer_type not null default 'self',
  installer_workshop_id uuid references public.users(id) on delete set null,
  install_date date not null,
  date_is_approximate boolean not null default false,
  notes text,
  receipt_media_id uuid references public.media(id) on delete set null,
  privacy mod_privacy not null default 'public',
  is_verified_by_workshop boolean not null default false,
  from_plan_item_id uuid, -- FK added later when plan_items table exists
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mods_part_or_custom check (part_id is not null or custom_part_name is not null)
);

create index if not exists mods_vehicle_idx on public.mods (vehicle_id);
create index if not exists mods_vehicle_date_idx on public.mods (vehicle_id, install_date desc);
create index if not exists mods_part_idx on public.mods (part_id) where part_id is not null;

create trigger mods_set_updated_at
before update on public.mods
for each row execute function public.set_updated_at();

-- Add the deferred FK from media.mod_id -> mods.id now that mods exists.
alter table public.media
  add constraint media_mod_id_fkey
  foreign key (mod_id) references public.mods(id) on delete set null;

-- ============================================================================
-- Auth bridge: create a `public.users` row whenever an `auth.users` row is created.
-- We use the email's local-part as a placeholder handle; the app should let the user
-- claim their real handle during onboarding.
-- ============================================================================

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_handle text;
  final_handle text;
  attempts int := 0;
begin
  base_handle := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9_]', '', 'g'));
  if length(base_handle) < 3 then
    base_handle := 'user' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  if length(base_handle) > 24 then
    base_handle := substr(base_handle, 1, 24);
  end if;

  final_handle := base_handle;
  while exists (select 1 from public.users where handle = final_handle) and attempts < 10 loop
    attempts := attempts + 1;
    final_handle := base_handle || attempts::text;
  end loop;
  if exists (select 1 from public.users where handle = final_handle) then
    final_handle := base_handle || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;

  insert into public.users (id, handle, display_name, email, email_verified)
  values (
    new.id,
    final_handle,
    coalesce(new.raw_user_meta_data ->> 'display_name', final_handle),
    new.email,
    new.email_confirmed_at is not null
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();
