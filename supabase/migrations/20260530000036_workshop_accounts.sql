-- Workshop / business accounts: account type, extended profile, reviews, portfolio, enquiries.

do $$ begin
  create type public.account_type as enum ('builder', 'workshop');
exception when duplicate_object then null;
end $$;

alter table public.users
  add column if not exists account_type public.account_type not null default 'builder',
  add column if not exists workshop_onboarding_complete boolean not null default false,
  add column if not exists workshop_business_email text,
  add column if not exists workshop_contact_name text,
  add column if not exists workshop_abn text,
  add column if not exists workshop_business_type text,
  add column if not exists workshop_address text,
  add column if not exists workshop_service_area text,
  add column if not exists workshop_hours text,
  add column if not exists workshop_tagline text,
  add column if not exists workshop_description text,
  add column if not exists workshop_instagram text,
  add column if not exists workshop_facebook text,
  add column if not exists workshop_logo_url text,
  add column if not exists workshop_cover_url text,
  add column if not exists workshop_booking_url text;

create index if not exists users_account_type_idx on public.users (account_type);
create index if not exists users_workshop_listed_idx on public.users (is_workshop)
  where is_workshop = true;

-- Reviews for workshops (distinct from part_reviews).
create table if not exists public.workshop_reviews (
  id uuid primary key default gen_random_uuid(),
  workshop_user_id uuid not null references public.users(id) on delete cascade,
  reviewer_user_id uuid not null references public.users(id) on delete cascade,
  mod_id uuid references public.mods(id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  body text,
  reply_body text,
  reply_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workshop_reviews_unique_reviewer unique (workshop_user_id, reviewer_user_id)
);

create index if not exists workshop_reviews_workshop_idx on public.workshop_reviews (workshop_user_id, created_at desc);

create trigger workshop_reviews_set_updated_at
before update on public.workshop_reviews
for each row execute function public.set_updated_at();

-- Portfolio / case studies (workshop-curated; may link to a verified mod).
create table if not exists public.workshop_portfolio_items (
  id uuid primary key default gen_random_uuid(),
  workshop_user_id uuid not null references public.users(id) on delete cascade,
  mod_id uuid references public.mods(id) on delete set null,
  title text not null,
  description text,
  category public.mod_category,
  vehicle_label text,
  image_url text,
  sort_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workshop_portfolio_workshop_idx
  on public.workshop_portfolio_items (workshop_user_id, sort_order);

create trigger workshop_portfolio_items_set_updated_at
before update on public.workshop_portfolio_items
for each row execute function public.set_updated_at();

-- Customer permission to feature a mod on portfolio (privacy).
create table if not exists public.workshop_mod_consents (
  mod_id uuid not null references public.mods(id) on delete cascade,
  workshop_user_id uuid not null references public.users(id) on delete cascade,
  granted_by_user_id uuid not null references public.users(id) on delete cascade,
  portfolio_allowed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (mod_id, workshop_user_id)
);

create trigger workshop_mod_consents_set_updated_at
before update on public.workshop_mod_consents
for each row execute function public.set_updated_at();

-- Quote / contact enquiries from public profile.
create type public.workshop_enquiry_status as enum ('new', 'read', 'archived');

create table if not exists public.workshop_enquiries (
  id uuid primary key default gen_random_uuid(),
  workshop_user_id uuid not null references public.users(id) on delete cascade,
  sender_user_id uuid references public.users(id) on delete set null,
  sender_name text not null,
  sender_email text not null,
  sender_phone text,
  message text not null,
  status public.workshop_enquiry_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workshop_enquiries_workshop_idx
  on public.workshop_enquiries (workshop_user_id, created_at desc);

create trigger workshop_enquiries_set_updated_at
before update on public.workshop_enquiries
for each row execute function public.set_updated_at();

-- RLS
alter table public.workshop_reviews enable row level security;
alter table public.workshop_portfolio_items enable row level security;
alter table public.workshop_mod_consents enable row level security;
alter table public.workshop_enquiries enable row level security;

-- Reviews: public read; insert own; update own review or workshop reply
drop policy if exists "workshop_reviews: public read" on public.workshop_reviews;
create policy "workshop_reviews: public read"
on public.workshop_reviews for select to anon, authenticated using (true);

drop policy if exists "workshop_reviews: insert own" on public.workshop_reviews;
create policy "workshop_reviews: insert own"
on public.workshop_reviews for insert to authenticated
with check (reviewer_user_id = auth.uid());

drop policy if exists "workshop_reviews: update reviewer or workshop" on public.workshop_reviews;
create policy "workshop_reviews: update reviewer or workshop"
on public.workshop_reviews for update to authenticated
using (reviewer_user_id = auth.uid() or workshop_user_id = auth.uid())
with check (reviewer_user_id = auth.uid() or workshop_user_id = auth.uid());

drop policy if exists "workshop_reviews: delete own" on public.workshop_reviews;
create policy "workshop_reviews: delete own"
on public.workshop_reviews for delete to authenticated
using (reviewer_user_id = auth.uid());

-- Portfolio: public read published; workshop manages own
drop policy if exists "workshop_portfolio: public read published" on public.workshop_portfolio_items;
create policy "workshop_portfolio: public read published"
on public.workshop_portfolio_items for select to anon, authenticated
using (is_published = true or workshop_user_id = auth.uid());

drop policy if exists "workshop_portfolio: workshop manage" on public.workshop_portfolio_items;
create policy "workshop_portfolio: workshop manage"
on public.workshop_portfolio_items for all to authenticated
using (workshop_user_id = auth.uid())
with check (workshop_user_id = auth.uid());

-- Consents: vehicle owner grants; workshop reads own
drop policy if exists "workshop_mod_consents: owner grant" on public.workshop_mod_consents;
create policy "workshop_mod_consents: owner grant"
on public.workshop_mod_consents for all to authenticated
using (granted_by_user_id = auth.uid() or workshop_user_id = auth.uid())
with check (granted_by_user_id = auth.uid());

-- Enquiries: anyone can insert; workshop reads/updates own
drop policy if exists "workshop_enquiries: insert" on public.workshop_enquiries;
create policy "workshop_enquiries: insert"
on public.workshop_enquiries for insert to anon, authenticated
with check (true);

drop policy if exists "workshop_enquiries: workshop read" on public.workshop_enquiries;
create policy "workshop_enquiries: workshop read"
on public.workshop_enquiries for select to authenticated
using (workshop_user_id = auth.uid() or sender_user_id = auth.uid());

drop policy if exists "workshop_enquiries: workshop update" on public.workshop_enquiries;
create policy "workshop_enquiries: workshop update"
on public.workshop_enquiries for update to authenticated
using (workshop_user_id = auth.uid())
with check (workshop_user_id = auth.uid());

-- Auth trigger: honour account_type from sign-up metadata
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
  acct public.account_type;
begin
  acct := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'account_type'), '')::public.account_type,
    'builder'::public.account_type
  );

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

  insert into public.users (
    id, handle, display_name, email, email_verified, account_type, workshop_onboarding_complete
  )
  values (
    new.id,
    final_handle,
    coalesce(new.raw_user_meta_data ->> 'display_name', final_handle),
    new.email,
    new.email_confirmed_at is not null,
    acct,
    false
  )
  on conflict (id) do update set
    account_type = excluded.account_type;

  return new;
end;
$$;

-- Aggregate rating helper view (optional; app can compute client-side too)
create or replace function public.workshop_review_stats(p_workshop_id uuid)
returns table (avg_rating numeric, review_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    round(avg(rating)::numeric, 1),
    count(*)::bigint
  from public.workshop_reviews
  where workshop_user_id = p_workshop_id;
$$;

grant execute on function public.workshop_review_stats(uuid) to anon, authenticated;
