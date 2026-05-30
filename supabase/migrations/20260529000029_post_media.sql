-- Standalone feed posts (no mod) can attach photos/videos via media.post_id.

alter table public.media
  add column if not exists post_id uuid references public.posts(id) on delete cascade;

create index if not exists media_post_idx on public.media (post_id);

-- Readable when the parent post is visible (posts RLS applies in the subquery).
drop policy if exists "media: read public post photos" on public.media;
create policy "media: read public post photos"
on public.media for select
to authenticated, anon
using (
  is_sensitive = false
  and post_id is not null
  and exists (
    select 1 from public.posts p where p.id = media.post_id
  )
);
