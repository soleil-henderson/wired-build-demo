-- Wired Build — cascade-delete media when a mod is removed.
--
-- Previously media.mod_id used ON DELETE SET NULL, which left orphan rows
-- (and storage objects) whenever a mod was deleted outside our app helper.
-- The app now purges storage on deleteMod/deleteVehicle; this makes the DB
-- consistent for any delete path.

alter table public.media
  drop constraint if exists media_mod_id_fkey;

alter table public.media
  add constraint media_mod_id_fkey
  foreign key (mod_id) references public.mods(id) on delete cascade;
