import type { SubscriptionTier } from '@/types/database';

export const FREE_VEHICLE_LIMIT = 3;
export const WIRED_AI_FREE_MONTHLY_LIMIT = 20;

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

/** All signed-in users can use Wired AI; free tier has a monthly cap. */
export function canUseWiredAi(_tier: SubscriptionTier): boolean {
  return true;
}

/** Returns null when unlimited (Pro+). */
export function wiredAiMonthlyLimit(tier: SubscriptionTier): number | null {
  if (hasTierAtLeast(tier, 'pro')) return null;
  return WIRED_AI_FREE_MONTHLY_LIMIT;
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

export function canCommentAndReact(tier: SubscriptionTier): boolean {
  return hasTierAtLeast(tier, 'member');
}

export function canManageWorkshopProfile(tier: SubscriptionTier): boolean {
  return hasTierAtLeast(tier, 'workshop');
}
