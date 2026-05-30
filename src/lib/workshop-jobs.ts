import { supabase } from './supabase';
import type { ModCategory } from '@/types/database';

/** Customer vehicle job visible to workshop — no owner PII by default. */
export type WorkshopCustomerJob = {
  vehicle_id: string;
  year: number;
  make: string;
  model: string;
  nickname: string | null;
  mod_count: number;
  verified_count: number;
  latest_install_date: string | null;
  mods: WorkshopJobMod[];
};

export type WorkshopJobMod = {
  id: string;
  install_date: string;
  category: ModCategory;
  custom_part_name: string | null;
  is_verified_by_workshop: boolean;
  portfolio_allowed: boolean;
};

export async function listWorkshopCustomerJobs(
  workshopUserId: string
): Promise<WorkshopCustomerJob[]> {
  const { data, error } = await supabase
    .from('mods')
    .select(
      `
      id, install_date, category, custom_part_name, is_verified_by_workshop,
      vehicle:vehicles!inner ( id, year, make, model, nickname )
    `
    )
    .eq('installer_workshop_id', workshopUserId)
    .eq('installer_type', 'workshop')
    .order('install_date', { ascending: false })
    .limit(200);

  if (error) throw error;

  const modIds = (data ?? []).map((m) => m.id);
  const consentMap = new Map<string, boolean>();
  if (modIds.length > 0) {
    const { data: consents } = await supabase
      .from('workshop_mod_consents')
      .select('mod_id, portfolio_allowed')
      .eq('workshop_user_id', workshopUserId)
      .in('mod_id', modIds);
    for (const c of consents ?? []) {
      consentMap.set(c.mod_id, c.portfolio_allowed);
    }
  }

  const byVehicle = new Map<string, WorkshopCustomerJob>();

  for (const row of data ?? []) {
    const v = row.vehicle as
      | { id: string; year: number; make: string; model: string; nickname: string | null }
      | Array<{ id: string; year: number; make: string; model: string; nickname: string | null }>;
    const vehicle = Array.isArray(v) ? v[0] : v;
    if (!vehicle) continue;

    const mod: WorkshopJobMod = {
      id: row.id,
      install_date: row.install_date,
      category: row.category as ModCategory,
      custom_part_name: row.custom_part_name,
      is_verified_by_workshop: row.is_verified_by_workshop,
      portfolio_allowed: consentMap.get(row.id) ?? false,
    };

    let job = byVehicle.get(vehicle.id);
    if (!job) {
      job = {
        vehicle_id: vehicle.id,
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        nickname: vehicle.nickname,
        mod_count: 0,
        verified_count: 0,
        latest_install_date: null,
        mods: [],
      };
      byVehicle.set(vehicle.id, job);
    }
    job.mods.push(mod);
    job.mod_count += 1;
    if (mod.is_verified_by_workshop) job.verified_count += 1;
    if (!job.latest_install_date || mod.install_date > job.latest_install_date) {
      job.latest_install_date = mod.install_date;
    }
  }

  return [...byVehicle.values()].sort((a, b) =>
    (b.latest_install_date ?? '').localeCompare(a.latest_install_date ?? '')
  );
}

export async function requestPortfolioConsent(
  modId: string,
  workshopUserId: string,
  grantedByUserId: string,
  allowed: boolean
): Promise<void> {
  const { error } = await supabase.from('workshop_mod_consents').upsert(
    {
      mod_id: modId,
      workshop_user_id: workshopUserId,
      granted_by_user_id: grantedByUserId,
      portfolio_allowed: allowed,
    },
    { onConflict: 'mod_id,workshop_user_id' }
  );
  if (error) throw error;
}
