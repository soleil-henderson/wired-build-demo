import type { SubscriptionTier } from '@/types/database';

export {
  FREE_VEHICLE_LIMIT,
  WIRED_AI_FREE_MONTHLY_LIMIT,
  canCommentAndReact,
  canExportBuildData,
  canManageWorkshopProfile,
  canSaveSearches,
  canUseReceiptOcr,
  canUseWiredAi,
  hasMemberAffiliateRates,
  hasTierAtLeast,
  maxVehiclesForTier,
  tierRank,
  wiredAiMonthlyLimit,
} from './subscription-access';

import { supabase } from './supabase';

export async function getUserSubscriptionTier(userId: string): Promise<SubscriptionTier> {
  const { data } = await supabase
    .from('users')
    .select('subscription_tier')
    .eq('id', userId)
    .maybeSingle();
  return (data?.subscription_tier as SubscriptionTier) ?? 'free';
}
