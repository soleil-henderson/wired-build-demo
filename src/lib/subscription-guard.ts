import { router } from 'expo-router';
import { Alert } from 'react-native';

import { tierCatalogEntry } from '@/lib/subscription-tiers';
import { hasTierAtLeast } from '@/lib/subscription-access';
import type { SubscriptionTier } from '@/types/database';

const TIER_LABEL: Record<SubscriptionTier, string> = {
  free: 'Free',
  member: 'Member',
  pro: 'Pro',
  workshop: 'Workshop',
};

export function promptSubscriptionUpgrade(
  required: SubscriptionTier,
  feature: string
): void {
  const requiredMeta = tierCatalogEntry(required);
  const price =
    requiredMeta.priceMonthlyUsd && requiredMeta.priceMonthlyUsd > 0
      ? ` (${requiredMeta.priceLabel}/mo)`
      : '';

  Alert.alert(
    `${TIER_LABEL[required]} plan`,
    `${feature} requires ${TIER_LABEL[required]}${price} or higher.`,
    [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'View plans',
        onPress: () => router.push('/profile/subscription'),
      },
    ]
  );
}

export function ensureSubscriptionTier(
  current: SubscriptionTier,
  required: SubscriptionTier,
  feature: string
): boolean {
  if (hasTierAtLeast(current, required)) return true;
  promptSubscriptionUpgrade(required, feature);
  return false;
}
