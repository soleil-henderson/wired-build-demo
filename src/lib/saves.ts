import { supabase } from './supabase';
import { fetchPostMediaByPostIds } from './posts';
import type { SavedTargetType } from '@/types/database';

export type { SavedTargetType };

export type SavedItemRow = {
  id: string;
  target_type: SavedTargetType;
  target_id: string;
  created_at: string;
};

export type SavedItemPreview = SavedItemRow & {
  title: string;
  subtitle: string | null;
  image_url: string | null;
  href: string;
};

async function requireSessionUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    throw new Error('Sign in to save items.');
  }
  return data.session.user.id;
}

export async function isSaved(
  userId: string,
  targetType: SavedTargetType,
  targetId: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from('saved_items')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('target_type', targetType)
    .eq('target_id', targetId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function listSavedTargetIds(
  userId: string,
  targetType: SavedTargetType,
  targetIds: string[]
): Promise<Set<string>> {
  if (targetIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from('saved_items')
    .select('target_id')
    .eq('user_id', userId)
    .eq('target_type', targetType)
    .in('target_id', targetIds);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.target_id));
}

export async function saveItem(
  targetType: SavedTargetType,
  targetId: string
): Promise<void> {
  const userId = await requireSessionUserId();
  const { error } = await supabase.from('saved_items').insert({
    user_id: userId,
    target_type: targetType,
    target_id: targetId,
  });
  if (error) {
    if (error.code === '23505') return;
    throw error;
  }
}

export async function unsaveItem(
  targetType: SavedTargetType,
  targetId: string
): Promise<void> {
  const userId = await requireSessionUserId();
  const { error } = await supabase
    .from('saved_items')
    .delete()
    .eq('user_id', userId)
    .eq('target_type', targetType)
    .eq('target_id', targetId);
  if (error) throw error;
}

export async function toggleSaved(
  targetType: SavedTargetType,
  targetId: string,
  currentlySaved: boolean
): Promise<boolean> {
  if (currentlySaved) {
    await unsaveItem(targetType, targetId);
    return false;
  }
  await saveItem(targetType, targetId);
  return true;
}

export async function listSavedItems(userId: string): Promise<SavedItemPreview[]> {
  const { data: rows, error } = await supabase
    .from('saved_items')
    .select('id, target_type, target_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!rows?.length) return [];

  const postIds = rows.filter((r) => r.target_type === 'post').map((r) => r.target_id);
  const modIds = rows.filter((r) => r.target_type === 'mod').map((r) => r.target_id);
  const vehicleIds = rows.filter((r) => r.target_type === 'vehicle').map((r) => r.target_id);

  const [posts, mods, vehicles] = await Promise.all([
    fetchSavedPosts(postIds),
    fetchSavedMods(modIds),
    fetchSavedVehicles(vehicleIds),
  ]);

  const previews: SavedItemPreview[] = [];
  for (const row of rows) {
    const preview =
      row.target_type === 'post'
        ? posts.get(row.target_id)
        : row.target_type === 'mod'
          ? mods.get(row.target_id)
          : vehicles.get(row.target_id);
    if (!preview) continue;
    previews.push({ ...row, ...preview });
  }
  return previews;
}

type PreviewFields = Omit<SavedItemPreview, keyof SavedItemRow>;

async function fetchSavedPosts(postIds: string[]): Promise<Map<string, PreviewFields>> {
  const out = new Map<string, PreviewFields>();
  if (postIds.length === 0) return out;

  const { data, error } = await supabase
    .from('posts')
    .select(
      `
      id,
      body,
      author:users!posts_user_id_fkey ( display_name, handle ),
      vehicle:vehicles!posts_vehicle_id_fkey ( make, model, nickname ),
      mod:mods!posts_mod_id_fkey (
        custom_part_name,
        part:parts ( brand, name ),
        media!media_mod_id_fkey ( url, kind, is_sensitive )
      )
    `
    )
    .in('id', postIds);
  if (error) throw error;

  const standaloneIds = (data ?? [])
    .filter((row) => {
      const mod = Array.isArray(row.mod) ? row.mod[0] : row.mod;
      return !mod;
    })
    .map((row) => row.id);
  const mediaMap = await fetchPostMediaByPostIds(standaloneIds);

  for (const row of data ?? []) {
    const author = Array.isArray(row.author) ? row.author[0] : row.author;
    const vehicle = Array.isArray(row.vehicle) ? row.vehicle[0] : row.vehicle;
    const mod = Array.isArray(row.mod) ? row.mod[0] : row.mod;
    const modPart = mod?.part
      ? Array.isArray(mod.part)
        ? mod.part[0]
        : mod.part
      : null;
    const modMedia = mod?.media ?? [];
    const modPhoto =
      (Array.isArray(modMedia) ? modMedia : [])
        .find((m) => m.kind === 'photo' && !m.is_sensitive)?.url ?? null;
    const postPhoto = mediaMap.get(row.id)?.find((m) => m.kind === 'photo')?.url ?? null;

    const modLabel = modPart
      ? `${modPart.brand} ${modPart.name}`
      : mod?.custom_part_name ?? null;
    const vehicleLabel =
      vehicle?.nickname ?? `${vehicle?.make ?? ''} ${vehicle?.model ?? ''}`.trim();

    out.set(row.id, {
      title: modLabel ?? (row.body?.slice(0, 80) || 'Post'),
      subtitle: author?.display_name
        ? `${author.display_name} · ${vehicleLabel || 'Build'}`
        : vehicleLabel || null,
      image_url: modPhoto ?? postPhoto,
      href: `/post/${row.id}`,
    });
  }
  return out;
}

async function fetchSavedMods(modIds: string[]): Promise<Map<string, PreviewFields>> {
  const out = new Map<string, PreviewFields>();
  if (modIds.length === 0) return out;

  const { data, error } = await supabase
    .from('mods')
    .select(
      `
      id,
      custom_part_name,
      category,
      part:parts ( brand, name ),
      vehicle:vehicles!mods_vehicle_id_fkey ( make, model, nickname ),
      media!media_mod_id_fkey ( url, kind, is_sensitive )
    `
    )
    .in('id', modIds);
  if (error) throw error;

  for (const row of data ?? []) {
    const part = Array.isArray(row.part) ? row.part[0] : row.part;
    const vehicle = Array.isArray(row.vehicle) ? row.vehicle[0] : row.vehicle;
    const media = row.media ?? [];
    const photo =
      (Array.isArray(media) ? media : [])
        .find((m) => m.kind === 'photo' && !m.is_sensitive)?.url ?? null;
    const title = part ? `${part.brand} ${part.name}` : row.custom_part_name ?? 'Mod';
    const vehicleLabel =
      vehicle?.nickname ?? `${vehicle?.make ?? ''} ${vehicle?.model ?? ''}`.trim();

    out.set(row.id, {
      title,
      subtitle: vehicleLabel ? `${vehicleLabel} · ${row.category.replace(/_/g, ' ')}` : null,
      image_url: photo,
      href: `/mod/${row.id}`,
    });
  }
  return out;
}

async function fetchSavedVehicles(vehicleIds: string[]): Promise<Map<string, PreviewFields>> {
  const out = new Map<string, PreviewFields>();
  if (vehicleIds.length === 0) return out;

  const { data, error } = await supabase
    .from('vehicles')
    .select('id, year, make, model, nickname, cover_photo_url')
    .in('id', vehicleIds)
    .eq('is_public', true);
  if (error) throw error;

  for (const row of data ?? []) {
    const title = row.nickname ?? `${row.make} ${row.model}`;
    out.set(row.id, {
      title,
      subtitle: row.year ? `${row.year} ${row.make} ${row.model}` : `${row.make} ${row.model}`,
      image_url: row.cover_photo_url,
      href: `/vehicle/${row.id}`,
    });
  }
  return out;
}
