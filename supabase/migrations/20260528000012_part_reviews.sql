-- Wired Build — Part reviews + affiliate-click tracking.
--
-- - parts already has avg_rating numeric(3,2) and affiliate_links jsonb;
--   we reuse both and only add review_count to make the part detail
--   stats row a single-row read.
-- - part_reviews: one review per (part, user). Reads are public so any
--   viewer can see the community sentiment on a part; writes require
--   ownership of the row.
-- - part_clicks: tracks every tap on a part's affiliate URL. Anon + auth
--   may insert; nobody reads via the client (analytics surface lives in
--   the dashboard / service-role queries). user_id is nullable so a
--   logged-out share-page viewer's click can still be counted.

alter table public.parts
  add column if not exists review_count integer not null default 0;

-- ============================================================================
-- part_reviews
-- ============================================================================

create table if not exists public.part_reviews (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references public.parts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (part_id, user_id)
);

create index if not exists part_reviews_part_id_idx
  on public.part_reviews (part_id);
create index if not exists part_reviews_user_id_idx
  on public.part_reviews (user_id);

drop trigger if exists part_reviews_set_updated_at on public.part_reviews;
create trigger part_reviews_set_updated_at
before update on public.part_reviews
for each row execute function public.set_updated_at();

alter table public.part_reviews enable row level security;

drop policy if exists "part_reviews: read all" on public.part_reviews;
create policy "part_reviews: read all"
on public.part_reviews for select
to authenticated, anon
using (true);

drop policy if exists "part_reviews: insert own" on public.part_reviews;
create policy "part_reviews: insert own"
on public.part_reviews for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "part_reviews: update own" on public.part_reviews;
create policy "part_reviews: update own"
on public.part_reviews for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "part_reviews: delete own" on public.part_reviews;
create policy "part_reviews: delete own"
on public.part_reviews for delete
to authenticated
using (user_id = auth.uid());

-- Aggregate trigger: keep parts.avg_rating + parts.review_count in sync.
create or replace function public.part_reviews_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_part_id uuid := coalesce(new.part_id, old.part_id);
begin
  update public.parts p
  set
    review_count = sub.cnt,
    avg_rating  = sub.avg_rating
  from (
    select
      count(*)::int as cnt,
      avg(rating)::numeric(3, 2) as avg_rating
    from public.part_reviews
    where part_id = v_part_id
  ) sub
  where p.id = v_part_id;
  return coalesce(new, old);
end;
$$;

drop trigger if exists part_reviews_after_change on public.part_reviews;
create trigger part_reviews_after_change
after insert or update or delete on public.part_reviews
for each row execute function public.part_reviews_after_change();

-- ============================================================================
-- part_clicks (affiliate-link analytics)
-- ============================================================================

create table if not exists public.part_clicks (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references public.parts(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists part_clicks_part_id_idx
  on public.part_clicks (part_id);
create index if not exists part_clicks_created_at_idx
  on public.part_clicks (created_at desc);

alter table public.part_clicks enable row level security;

-- Anyone can record their own click. Anon writes are allowed (user_id null);
-- authed writes must match auth.uid() so a user can't fake another's clicks.
drop policy if exists "part_clicks: insert anyone" on public.part_clicks;
create policy "part_clicks: insert anyone"
on public.part_clicks for insert
to authenticated, anon
with check (
  user_id is null
  or user_id = auth.uid()
);

-- No select / update / delete policies: client traffic never reads or
-- mutates this table. Analytics queries run via the service role.
