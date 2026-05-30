import type { SubscriptionTier } from '@/types/database';

export type TierCatalogEntry = {
  id: SubscriptionTier;
  label: string;
  priceMonthlyUsd: number | null;
  priceLabel: string;
  pitch: string;
  perks: string[];
  ctaLabel: string;
  featured?: boolean;
};

/** Product copy + pricing — keep in sync with marketing/index.html pricing section. */
export const SUBSCRIPTION_TIER_CATALOG: TierCatalogEntry[] = [
  {
    id: 'free',
    label: 'Free',
    priceMonthlyUsd: 0,
    priceLabel: '$0',
    pitch: 'Everything you need to start logging your build.',
    perks: [
      'Up to 3 vehicles in your garage',
      'Unlimited mod logs + photos',
      'Public build profile & home feed',
      'Spend & service tracking',
      'Wired AI — 20 messages per month',
      'Browse the parts catalogue',
    ],
    ctaLabel: 'Start free',
  },
  {
    id: 'member',
    label: 'Member',
    priceMonthlyUsd: 5,
    priceLabel: '$5',
    pitch: 'For builders who share, discover, and save time.',
    perks: [
      'Everything in Free',
      'Unlimited vehicles',
      'Comment & react on posts',
      'Saved searches in Explore',
      'Member-rate affiliate links on parts',
    ],
    ctaLabel: 'Choose Member',
  },
  {
    id: 'pro',
    label: 'Pro',
    priceMonthlyUsd: 15,
    priceLabel: '$15',
    pitch: 'For serious builders and content creators.',
    perks: [
      'Everything in Member',
      'PRO badge on profile & posts',
      'Unlimited Wired AI',
      'Receipt OCR for mod costs',
      'Spend analytics + CSV export',
      'Priority identity verification',
    ],
    ctaLabel: 'Go Pro',
    featured: true,
  },
  {
    id: 'workshop',
    label: 'Workshop',
    priceMonthlyUsd: 50,
    priceLabel: '$50',
    pitch: 'For installers, retailers, and shops.',
    perks: [
      'Everything in Pro',
      'Public business profile with reviews & portfolio',
      'Customer jobs garage (privacy-safe)',
      'Enquiry inbox & quote requests',
      'Listed in the installer picker',
      'Verify installs on customer vehicles',
      'Lead generation from Explore search',
    ],
    ctaLabel: 'Go Workshop',
  },
];

export function tierCatalogEntry(id: SubscriptionTier): TierCatalogEntry {
  return (
    SUBSCRIPTION_TIER_CATALOG.find((t) => t.id === id) ??
    SUBSCRIPTION_TIER_CATALOG[0]
  );
}

export function tierPriceLabel(id: SubscriptionTier): string {
  const entry = tierCatalogEntry(id);
  if (entry.priceMonthlyUsd === null || entry.priceMonthlyUsd === 0) {
    return entry.priceLabel;
  }
  return `${entry.priceLabel}/mo`;
}
