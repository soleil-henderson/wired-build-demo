import { supabase } from './supabase';
import type { Database, ModCategory, WishlistPriority } from '@/types/database';

export type WishlistItem = {
  id: string;
  user_id: string;
  vehicle_id: string | null;
  part_id: string | null;
  custom_part_name: string | null;
  category: ModCategory | null;
  target_cost: number | null;
  notes: string | null;
  priority: WishlistPriority;
  created_at: string;
  part: { brand: string; name: string } | null;
};

type RawRow = Database['public']['Tables']['wishlist_items']['Row'] & {
  part: { brand: string; name: string } | { brand: string; name: string }[] | null;
};

function normalisePart(
  part: RawRow['part']
): { brand: string; name: string } | null {
  if (!part) return null;
  if (Array.isArray(part)) return part[0] ?? null;
  return part;
}

export async function listVehicleWishlist(vehicleId: string): Promise<WishlistItem[]> {
  const { data, error } = await supabase
    .from('wishlist_items')
    .select(
      `id, user_id, vehicle_id, part_id, custom_part_name, category,
       target_cost, notes, priority, created_at,
       part:parts ( brand, name )`
    )
    .eq('vehicle_id', vehicleId)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as RawRow[];
  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    vehicle_id: r.vehicle_id,
    part_id: r.part_id,
    custom_part_name: r.custom_part_name,
    category: r.category,
    target_cost: r.target_cost,
    notes: r.notes,
    priority: r.priority,
    created_at: r.created_at,
    part: normalisePart(r.part),
  }));
}

export async function listUserWishlist(userId: string): Promise<WishlistItem[]> {
  const { data, error } = await supabase
    .from('wishlist_items')
    .select(
      `id, user_id, vehicle_id, part_id, custom_part_name, category,
       target_cost, notes, priority, created_at,
       part:parts ( brand, name )`
    )
    .eq('user_id', userId)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as RawRow[];
  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    vehicle_id: r.vehicle_id,
    part_id: r.part_id,
    custom_part_name: r.custom_part_name,
    category: r.category,
    target_cost: r.target_cost,
    notes: r.notes,
    priority: r.priority,
    created_at: r.created_at,
    part: normalisePart(r.part),
  }));
}

export async function addWishlistItem(input: {
  userId: string;
  vehicleId: string | null;
  partId: string | null;
  customPartName: string | null;
  category: ModCategory | null;
  targetCost: number | null;
  notes: string | null;
  priority: WishlistPriority;
}): Promise<string> {
  if (!input.partId && !input.customPartName?.trim()) {
    throw new Error('Pick a part from the catalogue or enter a custom name.');
  }
  const { data, error } = await supabase
    .from('wishlist_items')
    .insert({
      user_id: input.userId,
      vehicle_id: input.vehicleId,
      part_id: input.partId,
      custom_part_name: input.customPartName?.trim() || null,
      category: input.category,
      target_cost: input.targetCost,
      notes: input.notes?.trim() || null,
      priority: input.priority,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function removeWishlistItem(id: string): Promise<void> {
  const { error } = await supabase.from('wishlist_items').delete().eq('id', id);
  if (error) throw error;
}

export function wishlistDisplayName(item: WishlistItem): string {
  if (item.part) return `${item.part.brand} ${item.part.name}`;
  return item.custom_part_name ?? 'Untitled item';
}
