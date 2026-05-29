import { supabase } from './supabase';

export type WorkshopUser = {
  id: string;
  handle: string;
  display_name: string;
  workshop_name: string | null;
};

export async function searchWorkshops(query: string, limit = 12): Promise<WorkshopUser[]> {
  const q = query.trim();
  let builder = supabase
    .from('users')
    .select('id, handle, display_name, workshop_name')
    .eq('is_workshop', true)
    .order('display_name')
    .limit(limit);

  if (q.length >= 1) {
    builder = builder.or(
      `handle.ilike.%${q}%,display_name.ilike.%${q}%,workshop_name.ilike.%${q}%`
    );
  }

  const { data, error } = await builder;
  if (error) throw error;
  return data ?? [];
}

export type WorkshopPendingMod = {
  id: string;
  install_date: string;
  category: string;
  custom_part_name: string | null;
  is_verified_by_workshop: boolean;
  vehicle: {
    id: string;
    year: number;
    make: string;
    model: string;
    nickname: string | null;
  } | null;
};

/** Mods tagged to this workshop that can be verified. */
export async function listWorkshopPendingInstalls(
  workshopUserId: string
): Promise<WorkshopPendingMod[]> {
  const { data, error } = await supabase
    .from('mods')
    .select(
      `
      id, install_date, category, custom_part_name, is_verified_by_workshop,
      vehicle:vehicles ( id, year, make, model, nickname )
    `
    )
    .eq('installer_workshop_id', workshopUserId)
    .eq('installer_type', 'workshop')
    .order('install_date', { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data ?? []) as WorkshopPendingMod[];
}

export async function workshopVerifyMod(modId: string): Promise<void> {
  const { error } = await supabase.rpc('workshop_verify_mod', { p_mod_id: modId });
  if (error) throw error;
}
