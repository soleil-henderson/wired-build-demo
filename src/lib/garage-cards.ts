import { displayImageUrl } from './image-url';
import { supabase } from './supabase';
import type { ModCategory } from '@/types/database';

export type SpendCategorySegment = {
  category: ModCategory;
  label: string;
  total: number;
  color: string;
};

export type GarageVehicleCard = {
  id: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  nickname: string | null;
  cover_photo_url: string | null;
  total_spend: number;
  build_value: number | null;
  mod_count: number;
  planned_total: number;
  spend_by_category: SpendCategorySegment[];
};

const CATEGORY_COLORS: Record<ModCategory, string> = {
  suspension: '#FF8A00',
  electrical: '#007AFF',
  recovery: '#34C759',
  drivetrain: '#5856D6',
  body: '#AF52DE',
  interior: '#FF2D55',
  lighting: '#5AC8FA',
  wheels_tyres: '#8E8E93',
  camping: '#30B0C7',
  other: '#FFB800',
};

const MAX_BAR_CATEGORIES = 4;

function categoryLabel(category: ModCategory): string {
  return category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatCompactMoney(amount: number, decimals = 1): string {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(decimals)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(decimals)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

function aggregateSpendByCategory(
  rows: { category: ModCategory; cost: number | null }[]
): SpendCategorySegment[] {
  const map = new Map<ModCategory, number>();
  for (const row of rows) {
    if (row.cost == null) continue;
    map.set(row.category, (map.get(row.category) ?? 0) + Number(row.cost));
  }
  return [...map.entries()]
    .map(([category, total]) => ({
      category,
      label: categoryLabel(category),
      total,
      color: CATEGORY_COLORS[category],
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, MAX_BAR_CATEGORIES);
}

export async function listGarageVehicleCards(userId: string): Promise<GarageVehicleCard[]> {
  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select(
      'id, year, make, model, trim, nickname, cover_photo_url, total_spend, build_value'
    )
    .eq('current_owner_id', userId)
    .order('created_at', { ascending: false });

  if (error || !vehicles?.length) return [];

  const ids = vehicles.map((v) => v.id);

  const [modsRes, wishlistRes, planRes] = await Promise.all([
    supabase.from('mods').select('vehicle_id, category, cost').in('vehicle_id', ids),
    supabase
      .from('wishlist_items')
      .select('vehicle_id, target_cost')
      .eq('user_id', userId)
      .in('vehicle_id', ids),
    supabase
      .from('plan_items')
      .select('vehicle_id, target_cost')
      .in('vehicle_id', ids)
      .is('completed_at', null),
  ]);

  const modsByVehicle = new Map<string, { category: ModCategory; cost: number | null }[]>();
  const modCountByVehicle = new Map<string, number>();
  for (const m of modsRes.data ?? []) {
    modCountByVehicle.set(m.vehicle_id, (modCountByVehicle.get(m.vehicle_id) ?? 0) + 1);
    const list = modsByVehicle.get(m.vehicle_id) ?? [];
    list.push({ category: m.category as ModCategory, cost: m.cost });
    modsByVehicle.set(m.vehicle_id, list);
  }

  const plannedByVehicle = new Map<string, number>();
  const addPlanned = (vehicleId: string | null, cost: number | null) => {
    if (!vehicleId) return;
    plannedByVehicle.set(
      vehicleId,
      (plannedByVehicle.get(vehicleId) ?? 0) + Number(cost ?? 0)
    );
  };
  for (const w of wishlistRes.data ?? []) addPlanned(w.vehicle_id, w.target_cost);
  for (const p of planRes.data ?? []) addPlanned(p.vehicle_id, p.target_cost);

  return vehicles.map((v, i) => ({
    id: v.id,
    year: v.year,
    make: v.make,
    model: v.model,
    trim: v.trim,
    nickname: v.nickname,
    cover_photo_url: displayImageUrl(v.cover_photo_url),
    total_spend: Number(v.total_spend ?? 0),
    build_value: v.build_value != null ? Number(v.build_value) : null,
    mod_count: modCountByVehicle.get(v.id) ?? 0,
    planned_total: plannedByVehicle.get(v.id) ?? 0,
    spend_by_category: aggregateSpendByCategory(modsByVehicle.get(v.id) ?? []),
  }));
}
