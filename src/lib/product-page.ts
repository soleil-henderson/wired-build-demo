import { parseProductLinks, type ModProductLinks } from './mod-products';
import { supabase } from './supabase';
import type { ModCategory } from '@/types/database';

export type ModProductContext = {
  id: string;
  category: ModCategory;
  cost: number | null;
  custom_part_name: string | null;
  install_date: string;
  product_links: ModProductLinks;
  part_id: string | null;
  part: {
    id: string;
    brand: string;
    name: string;
    category: ModCategory;
    affiliate_links: unknown;
    avg_rating: number | null;
    review_count: number;
  } | null;
  postId: string | null;
  photoUrl: string | null;
  vehicle: {
    id: string;
    year: number;
    make: string;
    model: string;
    nickname: string | null;
  } | null;
  owner: {
    id: string;
    handle: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
};

export async function getModProductContext(modId: string): Promise<ModProductContext | null> {
  const { data, error } = await supabase
    .from('mods')
    .select(
      `
      id, category, cost, custom_part_name, install_date, product_links, part_id,
      part:parts ( id, brand, name, category, affiliate_links, avg_rating, review_count ),
      vehicle:vehicles!mods_vehicle_id_fkey (
        id, year, make, model, nickname,
        owner:users!vehicles_current_owner_id_fkey ( id, handle, display_name, avatar_url )
      ),
      posts ( id ),
      media!media_mod_id_fkey ( url, kind, is_sensitive )
    `
    )
    .eq('id', modId)
    .maybeSingle();

  if (error || !data) return null;

  type Raw = {
    id: string;
    category: ModCategory;
    cost: number | null;
    custom_part_name: string | null;
    install_date: string;
    product_links: unknown;
    part_id: string | null;
    part: ModProductContext['part'];
    vehicle: {
      id: string;
      year: number;
      make: string;
      model: string;
      nickname: string | null;
      owner: ModProductContext['owner'];
    } | null;
    posts: { id: string }[] | { id: string } | null;
    media: { url: string; kind: string; is_sensitive: boolean }[] | null;
  };

  const m = data as Raw;
  const postRow = Array.isArray(m.posts) ? m.posts[0] : m.posts;
  const photo = m.media?.find((mm) => mm.kind === 'photo' && !mm.is_sensitive)?.url ?? null;

  return {
    id: m.id,
    category: m.category,
    cost: m.cost,
    custom_part_name: m.custom_part_name,
    install_date: m.install_date,
    product_links: parseProductLinks(m.product_links),
    part_id: m.part_id,
    part: m.part,
    postId: postRow?.id ?? null,
    photoUrl: photo,
    vehicle: m.vehicle
      ? {
          id: m.vehicle.id,
          year: m.vehicle.year,
          make: m.vehicle.make,
          model: m.vehicle.model,
          nickname: m.vehicle.nickname,
        }
      : null,
    owner: m.vehicle?.owner ?? null,
  };
}

export function modProductLabel(ctx: ModProductContext): string {
  if (ctx.part) return `${ctx.part.brand} ${ctx.part.name}`;
  if (ctx.custom_part_name?.trim()) return ctx.custom_part_name.trim();
  if (ctx.product_links.primary?.name) return ctx.product_links.primary.name;
  return 'Product';
}

export function modProductBrand(ctx: ModProductContext): string {
  if (ctx.part?.brand) return ctx.part.brand;
  return ctx.category.replace('_', ' ');
}

export function modShoppingQuery(ctx: ModProductContext): string {
  return modProductLabel(ctx);
}

export function modPrimaryUrl(ctx: ModProductContext): string | null {
  return ctx.product_links.primary?.url?.trim() || null;
}

export type ModInstallRow = {
  modId: string;
  postId: string | null;
  cost: number | null;
  installDate: string;
  photoUrl: string | null;
  vehicle: ModProductContext['vehicle'];
  owner: ModProductContext['owner'];
};

/** Other public mods that share the same custom product link or name. */
export async function listModsUsingCustomProduct(
  productUrl: string | null,
  productName: string,
  excludeModId: string,
  limit = 12
): Promise<ModInstallRow[]> {
  const { data, error } = await supabase
    .from('mods')
    .select(
      `
      id, cost, install_date, custom_part_name, product_links,
      vehicle:vehicles!mods_vehicle_id_fkey (
        id, year, make, model, nickname,
        owner:users!vehicles_current_owner_id_fkey ( id, handle, display_name, avatar_url )
      ),
      posts ( id ),
      media!media_mod_id_fkey ( url, kind, is_sensitive )
    `
    )
    .neq('id', excludeModId)
    .order('install_date', { ascending: false })
    .limit(limit * 3);

  if (error || !data) return [];

  type Raw = {
    id: string;
    cost: number | null;
    install_date: string;
    custom_part_name: string | null;
    product_links: unknown;
    vehicle: {
      id: string;
      year: number;
      make: string;
      model: string;
      nickname: string | null;
      owner: ModProductContext['owner'];
    } | null;
    posts: { id: string }[] | { id: string } | null;
    media: { url: string; kind: string; is_sensitive: boolean }[] | null;
  };

  const normalizedName = productName.trim().toLowerCase();
  const normalizedUrl = productUrl?.trim().toLowerCase() ?? null;

  const rows: ModInstallRow[] = [];
  for (const r of data as Raw[]) {
    const links = parseProductLinks(r.product_links);
    const primaryUrl = links.primary?.url?.trim().toLowerCase() ?? null;
    const name =
      r.custom_part_name?.trim() ||
      links.primary?.name?.trim() ||
      '';

    const urlMatch = normalizedUrl && primaryUrl === normalizedUrl;
    const nameMatch =
      normalizedName.length > 2 && name.toLowerCase() === normalizedName;

    if (!urlMatch && !nameMatch) continue;

    const postRow = Array.isArray(r.posts) ? r.posts[0] : r.posts;
    const photo = r.media?.find((m) => m.kind === 'photo' && !m.is_sensitive)?.url ?? null;

    rows.push({
      modId: r.id,
      postId: postRow?.id ?? null,
      cost: r.cost,
      installDate: r.install_date,
      photoUrl: photo,
      vehicle: r.vehicle
        ? {
            id: r.vehicle.id,
            year: r.vehicle.year,
            make: r.vehicle.make,
            model: r.vehicle.model,
            nickname: r.vehicle.nickname,
          }
        : null,
      owner: r.vehicle?.owner ?? null,
    });

    if (rows.length >= limit) break;
  }

  return rows;
}
