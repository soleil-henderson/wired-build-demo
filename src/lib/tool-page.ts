import { parseProductLinks } from './mod-products';
import { toolLabel, type ModTool } from './mod-tools';
import { supabase } from './supabase';
import type { ModCategory } from '@/types/database';

export type ToolProductContext = ModTool & {
  mod: {
    id: string;
    category: ModCategory;
    install_date: string;
    postId: string | null;
  };
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

export type ToolInstallRow = {
  toolId: string;
  modId: string;
  postId: string | null;
  installDate: string;
  ownership: ModTool['ownership'];
  cost: number | null;
  hire_duration: string | null;
  vehicleLabel: string;
  ownerHandle: string;
};

export async function getToolProductContext(toolId: string): Promise<ToolProductContext | null> {
  const { data, error } = await supabase
    .from('mod_tools')
    .select(
      `
      id, mod_id, name, brand, url, ownership, cost, hire_duration, sort_order,
      mod:mods!mod_tools_mod_id_fkey (
        id, category, install_date, product_links,
        vehicle:vehicles!mods_vehicle_id_fkey (
          id, year, make, model, nickname,
          owner:users!vehicles_current_owner_id_fkey ( id, handle, display_name, avatar_url )
        ),
        posts ( id )
      )
    `
    )
    .eq('id', toolId)
    .maybeSingle();

  if (error || !data) return null;

  type Raw = {
    id: string;
    mod_id: string;
    name: string;
    brand: string | null;
    url: string | null;
    ownership: ModTool['ownership'];
    cost: number | null;
    hire_duration: string | null;
    sort_order: number;
    mod: {
      id: string;
      category: ModCategory;
      install_date: string;
      vehicle: {
        id: string;
        year: number;
        make: string;
        model: string;
        nickname: string | null;
        owner: ToolProductContext['owner'];
      } | null;
      posts: { id: string }[] | { id: string } | null;
    } | null;
  };

  const row = data as Raw;
  if (!row.mod?.vehicle) return null;

  const postRow = Array.isArray(row.mod.posts) ? row.mod.posts[0] : row.mod.posts;

  return {
    id: row.id,
    mod_id: row.mod_id,
    name: row.name,
    brand: row.brand,
    url: row.url,
    ownership: row.ownership,
    cost: row.cost,
    hire_duration: row.hire_duration,
    sort_order: row.sort_order,
    mod: {
      id: row.mod.id,
      category: row.mod.category,
      install_date: row.mod.install_date,
      postId: postRow?.id ?? null,
    },
    vehicle: row.mod.vehicle,
    owner: row.mod.vehicle.owner,
  };
}

export function toolShoppingQuery(tool: Pick<ModTool, 'brand' | 'name'>): string {
  return toolLabel(tool);
}

export async function listModsUsingTool(
  tool: Pick<ModTool, 'id' | 'url' | 'brand' | 'name'>,
  excludeModId?: string
): Promise<ToolInstallRow[]> {
  let query = supabase
    .from('mod_tools')
    .select(
      `
      id, mod_id, ownership, cost, hire_duration,
      mod:mods!mod_tools_mod_id_fkey (
        id, install_date, privacy,
        vehicle:vehicles!mods_vehicle_id_fkey (
          year, make, model, nickname, is_public,
          owner:users!vehicles_current_owner_id_fkey ( handle )
        ),
        posts ( id )
      )
    `
    )
    .neq('id', tool.id);

  if (tool.url?.trim()) {
    query = query.eq('url', tool.url.trim());
  } else {
    query = query.eq('name', tool.name.trim());
    if (tool.brand?.trim()) query = query.eq('brand', tool.brand.trim());
  }

  const { data, error } = await query.limit(24);
  if (error) return [];

  type Raw = {
    id: string;
    mod_id: string;
    ownership: ModTool['ownership'];
    cost: number | null;
    hire_duration: string | null;
    mod: {
      id: string;
      install_date: string;
      privacy: string;
      vehicle: {
        year: number;
        make: string;
        model: string;
        nickname: string | null;
        is_public: boolean;
        owner: { handle: string } | null;
      } | null;
      posts: { id: string }[] | { id: string } | null;
    } | null;
  };

  return ((data ?? []) as Raw[])
    .filter(
      (r) =>
        r.mod &&
        r.mod.privacy === 'public' &&
        r.mod.vehicle?.is_public &&
        r.mod.id !== excludeModId
    )
    .map((r) => {
      const v = r.mod!.vehicle!;
      const postRow = Array.isArray(r.mod!.posts) ? r.mod!.posts[0] : r.mod!.posts;
      return {
        toolId: r.id,
        modId: r.mod!.id,
        postId: postRow?.id ?? null,
        installDate: r.mod!.install_date,
        ownership: r.ownership,
        cost: r.cost,
        hire_duration: r.hire_duration,
        vehicleLabel:
          v.nickname ?? `${v.year} ${v.make} ${v.model}`,
        ownerHandle: v.owner?.handle ?? 'builder',
      };
    });
}
