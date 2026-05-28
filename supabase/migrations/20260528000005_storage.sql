-- Wired Build — Storage buckets and policies (Spec §7.1).
--
-- Two buckets:
--   mod-photos — public, served via CDN; mod cover/avatar photos live here
--   receipts   — restricted, owner-only; tax-sensitive scans live here
--
-- Convention: every object is keyed by `<owner_id>/<random-uuid>.<ext>`. The
-- policies below extract the first path segment (the owner id) and compare
-- to auth.uid().

-- ============================================================================
-- Buckets
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('mod-photos', 'mod-photos', true,  10 * 1024 * 1024,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/avif']),
  ('receipts',   'receipts',   false, 10 * 1024 * 1024,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ============================================================================
-- storage.objects policies for mod-photos (public read, owner-only write)
-- ============================================================================

drop policy if exists "mod-photos: public read" on storage.objects;
create policy "mod-photos: public read"
on storage.objects for select
to authenticated, anon
using (bucket_id = 'mod-photos');

drop policy if exists "mod-photos: owner write" on storage.objects;
create policy "mod-photos: owner write"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'mod-photos'
  and auth.uid()::text = split_part(name, '/', 1)
);

drop policy if exists "mod-photos: owner update" on storage.objects;
create policy "mod-photos: owner update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'mod-photos'
  and auth.uid()::text = split_part(name, '/', 1)
)
with check (
  bucket_id = 'mod-photos'
  and auth.uid()::text = split_part(name, '/', 1)
);

drop policy if exists "mod-photos: owner delete" on storage.objects;
create policy "mod-photos: owner delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'mod-photos'
  and auth.uid()::text = split_part(name, '/', 1)
);

-- ============================================================================
-- storage.objects policies for receipts (owner-only everything)
-- ============================================================================

drop policy if exists "receipts: owner read" on storage.objects;
create policy "receipts: owner read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'receipts'
  and auth.uid()::text = split_part(name, '/', 1)
);

drop policy if exists "receipts: owner write" on storage.objects;
create policy "receipts: owner write"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'receipts'
  and auth.uid()::text = split_part(name, '/', 1)
);

drop policy if exists "receipts: owner update" on storage.objects;
create policy "receipts: owner update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'receipts'
  and auth.uid()::text = split_part(name, '/', 1)
)
with check (
  bucket_id = 'receipts'
  and auth.uid()::text = split_part(name, '/', 1)
);

drop policy if exists "receipts: owner delete" on storage.objects;
create policy "receipts: owner delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'receipts'
  and auth.uid()::text = split_part(name, '/', 1)
);
