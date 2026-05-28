import { supabase } from './supabase';
import type { SubscriptionTier } from '@/types/database';

export type TransferUser = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  is_workshop: boolean;
  is_identity_verified: boolean;
  subscription_tier: SubscriptionTier;
};

export type OwnershipTransferRow = {
  id: string;
  vehicle_id: string;
  from_user: TransferUser | null;
  to_user: TransferUser | null;
  note: string | null;
  created_at: string;
};

/**
 * Atomic owner swap. Calls a SECURITY DEFINER RPC server-side; failure modes:
 *   42501  Caller isn't the current owner
 *   22023  Caller and recipient are the same person
 *   P0002  Vehicle or recipient not found
 *   28000  Not authenticated
 */
export async function transferVehicleOwnership(input: {
  vehicleId: string;
  newOwnerId: string;
  note: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('transfer_vehicle_ownership', {
    p_vehicle_id: input.vehicleId,
    p_new_owner_id: input.newOwnerId,
    p_note: input.note,
  });
  if (error) throw error;
}

/**
 * Look up the recipient by their handle (with optional @ prefix). Returns null
 * if no match. We strip leading @ because handle is stored without it.
 */
export async function findRecipientByHandle(
  handle: string
): Promise<TransferUser | null> {
  const stripped = handle.replace(/^@/, '').trim();
  if (!stripped) return null;
  const { data } = await supabase
    .from('users')
    .select(
      'id, handle, display_name, avatar_url, is_workshop, is_identity_verified, subscription_tier'
    )
    .eq('handle', stripped)
    .maybeSingle();
  return data ?? null;
}

/**
 * Audit trail for a vehicle. Joins the from/to users so the UI can render
 * names and avatars without an extra round-trip. RLS scopes visibility — a
 * private vehicle's history is only visible to the two parties involved.
 */
export async function listOwnershipHistory(
  vehicleId: string
): Promise<OwnershipTransferRow[]> {
  const { data, error } = await supabase
    .from('ownership_transfers')
    .select(
      `
      id, vehicle_id, note, created_at,
      from_user:users!ownership_transfers_from_user_id_fkey (
        id, handle, display_name, avatar_url,
        is_workshop, is_identity_verified, subscription_tier
      ),
      to_user:users!ownership_transfers_to_user_id_fkey (
        id, handle, display_name, avatar_url,
        is_workshop, is_identity_verified, subscription_tier
      )
    `
    )
    .eq('vehicle_id', vehicleId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  type RawRow = Omit<OwnershipTransferRow, 'from_user' | 'to_user'> & {
    from_user: TransferUser | TransferUser[] | null;
    to_user: TransferUser | TransferUser[] | null;
  };

  const normaliseUser = (u: TransferUser | TransferUser[] | null): TransferUser | null =>
    !u ? null : Array.isArray(u) ? (u[0] ?? null) : u;

  return (data as RawRow[]).map((r) => ({
    id: r.id,
    vehicle_id: r.vehicle_id,
    note: r.note,
    created_at: r.created_at,
    from_user: normaliseUser(r.from_user),
    to_user: normaliseUser(r.to_user),
  }));
}
