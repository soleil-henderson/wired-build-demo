import { supabase } from './supabase';

/** Request server-side valuation refresh (heuristic or external API when keys set). */
export async function refreshVehicleValuation(vehicleId: string): Promise<{
  source: string;
}> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const res = await fetch(`${base}/functions/v1/estimate-valuation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ vehicle_id: vehicleId }),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json() as Promise<{ source: string }>;
}

export async function setManualBuildValue(
  vehicleId: string,
  value: number,
  note?: string | null
): Promise<void> {
  const { error } = await supabase
    .from('vehicles')
    .update({
      manual_build_value: value,
      manual_build_value_at: new Date().toISOString(),
      manual_build_value_note: note?.trim() || null,
      valuation_source: 'manual',
      build_value: value,
    })
    .eq('id', vehicleId);
  if (error) throw error;
}
