import { supabase } from './supabase';

export type PlanItem = {
  id: string;
  vehicle_id: string;
  title: string;
  target_cost: number | null;
  notes: string | null;
  sort_order: number;
  completed_at: string | null;
};

export async function listPlanItems(vehicleId: string): Promise<PlanItem[]> {
  const { data, error } = await supabase
    .from('plan_items')
    .select('id, vehicle_id, title, target_cost, notes, sort_order, completed_at')
    .eq('vehicle_id', vehicleId)
    .order('sort_order')
    .order('created_at');
  if (error) throw error;
  return data ?? [];
}

export async function addPlanItem(input: {
  vehicleId: string;
  userId: string;
  title: string;
  targetCost?: number | null;
  notes?: string | null;
}): Promise<void> {
  const { error } = await supabase.from('plan_items').insert({
    vehicle_id: input.vehicleId,
    user_id: input.userId,
    title: input.title.trim(),
    target_cost: input.targetCost ?? null,
    notes: input.notes?.trim() || null,
  });
  if (error) throw error;
}

export async function deletePlanItem(id: string): Promise<void> {
  const { error } = await supabase.from('plan_items').delete().eq('id', id);
  if (error) throw error;
}

export async function markPlanItemComplete(id: string): Promise<void> {
  const { error } = await supabase
    .from('plan_items')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
