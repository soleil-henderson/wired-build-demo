import { supabase } from './supabase';
import type { ModCategory } from '@/types/database';
import type { PortfolioItemInput } from './workshop-profile';

export type WorkshopPortfolioItem = {
  id: string;
  workshop_user_id: string;
  mod_id: string | null;
  title: string;
  description: string | null;
  category: ModCategory | null;
  vehicle_label: string | null;
  image_url: string | null;
  sort_order: number;
  is_published: boolean;
  created_at: string;
};

export async function listWorkshopPortfolio(
  workshopUserId: string,
  opts?: { includeUnpublished?: boolean }
): Promise<WorkshopPortfolioItem[]> {
  let q = supabase
    .from('workshop_portfolio_items')
    .select('*')
    .eq('workshop_user_id', workshopUserId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (!opts?.includeUnpublished) {
    q = q.eq('is_published', true);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as WorkshopPortfolioItem[];
}

export async function createPortfolioItem(
  workshopUserId: string,
  input: PortfolioItemInput
): Promise<WorkshopPortfolioItem> {
  const { data, error } = await supabase
    .from('workshop_portfolio_items')
    .insert({
      workshop_user_id: workshopUserId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      category: input.category ?? null,
      vehicle_label: input.vehicle_label?.trim() || null,
      image_url: input.image_url ?? null,
      mod_id: input.mod_id ?? null,
      is_published: input.is_published ?? true,
    })
    .select()
    .single();
  if (error) throw error;
  return data as WorkshopPortfolioItem;
}

export async function updatePortfolioItem(
  id: string,
  workshopUserId: string,
  input: Partial<PortfolioItemInput>
): Promise<void> {
  const patch: import('@/types/database').Database['public']['Tables']['workshop_portfolio_items']['Update'] =
    {};
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.description !== undefined) patch.description = input.description?.trim() || null;
  if (input.category !== undefined) patch.category = input.category;
  if (input.vehicle_label !== undefined) patch.vehicle_label = input.vehicle_label?.trim() || null;
  if (input.image_url !== undefined) patch.image_url = input.image_url;
  if (input.is_published !== undefined) patch.is_published = input.is_published;

  const { error } = await supabase
    .from('workshop_portfolio_items')
    .update(patch)
    .eq('id', id)
    .eq('workshop_user_id', workshopUserId);
  if (error) throw error;
}

export async function deletePortfolioItem(id: string, workshopUserId: string): Promise<void> {
  const { error } = await supabase
    .from('workshop_portfolio_items')
    .delete()
    .eq('id', id)
    .eq('workshop_user_id', workshopUserId);
  if (error) throw error;
}
