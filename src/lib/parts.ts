import { supabase } from './supabase';
import type { Database, ModCategory } from '@/types/database';

export type Part = Database['public']['Tables']['parts']['Row'];

export type PartStats = {
  installCount: number;
  averageCost: number | null;
  totalSpent: number;
  installerSelf: number;
  installerWorkshop: number;
  lastInstalledAt: string | null;
};

export type PartInstall = {
  modId: string;
  cost: number | null;
  costIsApproximate: boolean;
  installDate: string;
  dateIsApproximate: boolean;
  installerType: Database['public']['Tables']['mods']['Row']['installer_type'];
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
    subscription_tier: Database['public']['Tables']['users']['Row']['subscription_tier'];
    is_identity_verified: boolean;
    is_workshop: boolean;
  } | null;
};

/**
 * Live autocomplete against the parts catalogue (Spec §4.1 step 2).
 * Searches approved parts where brand or name matches a fuzzy query.
 */
export async function searchParts(query: string, limit = 12): Promise<Part[]> {
  const term = query.trim();
  if (!term) return [];

  const escaped = term.replace(/[%_]/g, '\\$&');
  const pattern = `%${escaped}%`;

  const { data, error } = await supabase
    .from('parts')
    .select('*')
    .eq('is_approved', true)
    .or(`brand.ilike.${pattern},name.ilike.${pattern}`)
    .order('install_count', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

/**
 * Fetch one part by id. Used to pre-fill the Log-a-Mod form when promoting a
 * wishlist row to a mod.
 */
export async function getPartById(id: string): Promise<Part | null> {
  const { data, error } = await supabase
    .from('parts')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return null;
  return data;
}

/**
 * Aggregate stats for a part across all installs the viewer can see.
 *
 * RLS filters mods by vehicle visibility, so the numbers reflect what the
 * viewer is allowed to see — for an anonymous viewer that means public mods
 * only. This is intentional: signed-in owners see their own private installs
 * in the average too.
 */
export async function getPartStats(partId: string): Promise<PartStats> {
  const { data, error } = await supabase
    .from('mods')
    .select('cost, install_date, installer_type')
    .eq('part_id', partId)
    .order('install_date', { ascending: false });

  if (error || !data) {
    return {
      installCount: 0,
      averageCost: null,
      totalSpent: 0,
      installerSelf: 0,
      installerWorkshop: 0,
      lastInstalledAt: null,
    };
  }

  let totalSpent = 0;
  let costCount = 0;
  let installerSelf = 0;
  let installerWorkshop = 0;
  for (const row of data) {
    if (row.cost != null) {
      totalSpent += Number(row.cost);
      costCount += 1;
    }
    if (row.installer_type === 'self') installerSelf += 1;
    else if (row.installer_type === 'workshop') installerWorkshop += 1;
  }

  return {
    installCount: data.length,
    averageCost: costCount > 0 ? totalSpent / costCount : null,
    totalSpent,
    installerSelf,
    installerWorkshop,
    lastInstalledAt: data[0]?.install_date ?? null,
  };
}

/**
 * List recent installs of this part, scoped by RLS to what the viewer can see.
 * Includes the vehicle, owner, and first non-sensitive photo per mod.
 */
export async function listPartInstalls(
  partId: string,
  limit = 20
): Promise<PartInstall[]> {
  const { data, error } = await supabase
    .from('mods')
    .select(
      `
      id, cost, cost_is_approximate, install_date, date_is_approximate, installer_type,
      vehicle:vehicles!mods_vehicle_id_fkey (
        id, year, make, model, nickname,
        owner:users!vehicles_current_owner_id_fkey (
          id, handle, display_name, avatar_url,
          subscription_tier, is_identity_verified, is_workshop
        )
      ),
      media ( url, kind, is_sensitive )
    `
    )
    .eq('part_id', partId)
    .order('install_date', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  type RawRow = {
    id: string;
    cost: number | null;
    cost_is_approximate: boolean;
    install_date: string;
    date_is_approximate: boolean;
    installer_type: Database['public']['Tables']['mods']['Row']['installer_type'];
    vehicle:
      | {
          id: string;
          year: number;
          make: string;
          model: string;
          nickname: string | null;
          owner:
            | {
                id: string;
                handle: string;
                display_name: string;
                avatar_url: string | null;
                subscription_tier: Database['public']['Tables']['users']['Row']['subscription_tier'];
                is_identity_verified: boolean;
                is_workshop: boolean;
              }
            | null;
        }
      | null;
    media: { url: string; kind: string; is_sensitive: boolean }[] | null;
  };

  return (data as RawRow[]).map((r) => {
    const photo = r.media?.find((m) => m.kind === 'photo' && !m.is_sensitive)?.url ?? null;
    return {
      modId: r.id,
      cost: r.cost,
      costIsApproximate: r.cost_is_approximate,
      installDate: r.install_date,
      dateIsApproximate: r.date_is_approximate,
      installerType: r.installer_type,
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
    };
  });
}

/**
 * "Custom part not listed" (Spec §4.1 edge case).
 * Inserts a community-submitted part as is_approved=false so it lands in the
 * moderation queue. Returns the inserted row so the caller can link the mod to it.
 */
export async function submitCustomPart(input: {
  brand: string;
  name: string;
  category: ModCategory;
}): Promise<Part> {
  const { data, error } = await supabase
    .from('parts')
    .insert({
      brand: input.brand.trim(),
      name: input.name.trim(),
      category: input.category,
      source: 'community',
      is_approved: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
