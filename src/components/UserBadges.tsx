import { Text, View } from 'react-native';

import type { SubscriptionTier } from '@/types/database';

/**
 * A user can have up to three small status badges next to their name:
 *
 *   ✓ Verified   — `is_identity_verified` (Spec §6.5)
 *   PRO          — `subscription_tier` in ('pro' | 'workshop')
 *   WORKSHOP     — `is_workshop` (Workshops as a class of user, Spec §5.1)
 *
 * Two visual sizes: 'inline' (10pt, sits beside a name) and 'lg' (12pt, used
 * on profile heroes). Pass only the props you have — anything falsy is just
 * skipped, so the same component handles every render site without branching.
 */
export type BadgedUser = {
  is_identity_verified?: boolean | null;
  is_workshop?: boolean | null;
  subscription_tier?: SubscriptionTier | null;
};

export function UserBadges({
  user,
  size = 'inline',
}: {
  user: BadgedUser;
  size?: 'inline' | 'lg';
}) {
  const showPro =
    user.subscription_tier === 'pro' || user.subscription_tier === 'workshop';
  const showWorkshop = !!user.is_workshop;
  const showVerified = !!user.is_identity_verified;

  if (!showPro && !showWorkshop && !showVerified) return null;

  return (
    <View className={`flex-row items-center gap-1 ${size === 'lg' ? 'gap-1.5' : ''}`}>
      {showVerified ? <VerifiedPill size={size} /> : null}
      {showPro ? <ProPill size={size} /> : null}
      {showWorkshop ? <WorkshopPill size={size} /> : null}
    </View>
  );
}

function VerifiedPill({ size }: { size: 'inline' | 'lg' }) {
  return (
    <View
      className={`flex-row items-center rounded-full bg-cyan-500/15 ${
        size === 'lg' ? 'gap-1 px-2 py-0.5' : 'gap-0.5 px-1.5 py-0.5'
      }`}
    >
      <Text className={`text-cyan-300 ${size === 'lg' ? 'text-xs' : 'text-[9px]'}`}>
        ✓
      </Text>
      <Text
        className={`font-bold uppercase tracking-wider text-cyan-300 ${
          size === 'lg' ? 'text-[10px]' : 'text-[9px]'
        }`}
      >
        Verified
      </Text>
    </View>
  );
}

function ProPill({ size }: { size: 'inline' | 'lg' }) {
  return (
    <View
      className={`rounded-full bg-accent ${
        size === 'lg' ? 'px-2 py-0.5' : 'px-1.5 py-0.5'
      }`}
    >
      <Text
        className={`font-bold uppercase tracking-wider text-ink-950 ${
          size === 'lg' ? 'text-[10px]' : 'text-[9px]'
        }`}
      >
        Pro
      </Text>
    </View>
  );
}

function WorkshopPill({ size }: { size: 'inline' | 'lg' }) {
  return (
    <View
      className={`rounded-full bg-ink-700 ${
        size === 'lg' ? 'px-2 py-0.5' : 'px-1.5 py-0.5'
      }`}
    >
      <Text
        className={`font-bold uppercase tracking-wider text-ink-100 ${
          size === 'lg' ? 'text-[10px]' : 'text-[9px]'
        }`}
      >
        Workshop
      </Text>
    </View>
  );
}
