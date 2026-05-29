import { supabase } from './supabase';
import { collectVehicleStorageKeys, purgeVehicleStorage } from './vehicle-storage';

export async function requestPasswordReset(email: string): Promise<void> {
  const redirectTo =
    process.env.EXPO_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://wiredbuild.app';
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${redirectTo}/auth/reset-password`,
  });
  if (error) throw error;
}

export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/**
 * Delete the signed-in account: purge storage for all owned vehicles,
 * delete auth user (cascades public.users via FK).
 */
export async function deleteMyAccount(userId: string): Promise<void> {
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id')
    .eq('current_owner_id', userId);

  for (const v of vehicles ?? []) {
    const keys = await collectVehicleStorageKeys(v.id);
    await supabase.from('vehicles').delete().eq('id', v.id);
    await purgeVehicleStorage(keys);
  }

  const { error } = await supabase.rpc('delete_own_account');
  if (error) {
    // Fallback if RPC not deployed: sign out only
    const { error: signOutErr } = await supabase.auth.signOut();
    if (signOutErr) throw signOutErr;
    throw new Error(
      'Account data removed from garage. Contact support to fully delete your auth record.'
    );
  }
}
