import { Text, View } from 'react-native';

import { colors } from '@/lib/theme';
import type { SubscriptionTier } from '@/types/database';

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
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: colors.greenSoft,
        paddingHorizontal: size === 'lg' ? 8 : 6,
        paddingVertical: 4,
        borderRadius: 100,
      }}
    >
      <Text style={{ fontSize: size === 'lg' ? 10 : 9, color: colors.green }}>✓</Text>
      <Text
        style={{
          fontSize: size === 'lg' ? 10 : 9,
          fontWeight: '700',
          color: colors.green,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        Verified
      </Text>
    </View>
  );
}

function ProPill({ size }: { size: 'inline' | 'lg' }) {
  return (
    <View
      style={{
        backgroundColor: colors.accentSoft,
        paddingHorizontal: size === 'lg' ? 8 : 6,
        paddingVertical: 4,
        borderRadius: 100,
      }}
    >
      <Text
        style={{
          fontSize: size === 'lg' ? 10 : 9,
          fontWeight: '700',
          color: colors.accent,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        Pro
      </Text>
    </View>
  );
}

function WorkshopPill({ size }: { size: 'inline' | 'lg' }) {
  return (
    <View
      style={{
        backgroundColor: colors.bg2,
        paddingHorizontal: size === 'lg' ? 8 : 6,
        paddingVertical: 4,
        borderRadius: 100,
      }}
    >
      <Text
        style={{
          fontSize: size === 'lg' ? 10 : 9,
          fontWeight: '700',
          color: colors.secondary,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        Workshop
      </Text>
    </View>
  );
}
