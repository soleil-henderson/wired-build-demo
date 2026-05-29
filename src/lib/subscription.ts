import { supabase } from './supabase';
import type { SubscriptionTier } from '@/types/database';

export const FREE_VEHICLE_LIMIT = 3;

export function tierRank(tier: SubscriptionTier): number {
  switch (tier) {
    case 'free':
      return 0;
    case 'member':
      return 1;
    case 'pro':
      return 2;
    case 'workshop':
      return 3;
    default:
      return 0;
  }
}

export function hasTierAtLeast(
  current: SubscriptionTier,
  required: SubscriptionTier
): boolean {
  return tierRank(current) >= tierRank(required);
}

export function maxVehiclesForTier(tier: SubscriptionTier): number | null {
  if (tier === 'free') return FREE_VEHICLE_LIMIT;
  return null;
}

export function canUseReceiptOcr(tier: SubscriptionTier): boolean {
  return hasTierAtLeast(tier, 'pro');
}

export function canExportBuildData(tier: SubscriptionTier): boolean {
  return hasTierAtLeast(tier, 'pro');
}

export function hasMemberAffiliateRates(tier: SubscriptionTier): boolean {
  return hasTierAtLeast(tier, 'member');
}

export function canSaveSearches(tier: SubscriptionTier): boolean {
  return hasTierAtLeast(tier, 'member');
}

export async function getUserSubscriptionTier(userId: string): Promise<SubscriptionTier> {
  const { data } = await supabase
    .from('users')
    .select('subscription_tier')
    .eq('id', userId)
    .maybeSingle();
  return (data?.subscription_tier as SubscriptionTier) ?? 'free';
}
