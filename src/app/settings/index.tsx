import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';

import { AppleCard } from '@/components/apple/AppleCard';
import { VehicleThumb } from '@/components/apple/ApplePrimitives';
import { UserBadges } from '@/components/UserBadges';
import { useAuth } from '@/lib/auth-context';
import { getFollowCounts, type FollowCounts } from '@/lib/follows';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { listUserVehicles, type VehicleSummary } from '@/lib/users';
import { canManageWorkshopProfile, canSaveSearches } from '@/lib/subscription';
import { useFocusData } from '@/lib/use-focus-data';
import type { Database } from '@/types/database';

type Profile = Database['public']['Tables']['users']['Row'];

const TIER_LABEL: Record<string, string> = {
  free: 'Free',
  member: 'Member',
  pro: 'Pro',
  workshop: 'Workshop',
};

export default function SettingsScreen() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [counts, setCounts] = useState<FollowCounts>({ followers: 0, following: 0 });
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [modCount, setModCount] = useState(0);

  const load = useCallback(async () => {
    if (!session) return;
    const userId = session.user.id;
    const [{ data: p, error }, fc, userVehicles] = await Promise.all([
      supabase.from('users').select('*').eq('id', userId).maybeSingle(),
      getFollowCounts(userId),
      listUserVehicles(userId),
    ]);
    if (error) Alert.alert('Could not load settings', error.message);
    setProfile(p);
    setCounts(fc);
    setVehicles(userVehicles);
    setModCount(userVehicles.reduce((sum, v) => sum + v.mod_count, 0));
  }, [session]);

  useFocusData(() => load(), [load], { cacheKey: session?.user.id });

  const tier = profile?.subscription_tier ?? 'free';
  const primaryVehicle = vehicles[0] ?? null;
  const totalSpend = vehicles.reduce((sum, v) => sum + Number(v.total_spend ?? 0), 0);

  const badges = useMemo(
    () =>
      buildBadges({
        modCount,
        totalSpend,
        verified: !!profile?.is_identity_verified,
        tier,
      }),
    [modCount, totalSpend, profile?.is_identity_verified, tier]
  );

  return (
    <ScrollView className="flex-1 bg-apple-bg2" contentContainerClassName="px-4 pb-28 pt-2">
      <Stack.Screen options={{ title: 'Settings' }} />

      <Pressable onPress={() => router.push('/profile/edit')}>
        <AppleCard
          style={{
            padding: 16,
            marginBottom: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          {profile?.avatar_url ? (
            <Image
              source={{ uri: profile.avatar_url }}
              className="h-14 w-14 rounded-full bg-apple-bg2"
            />
          ) : (
            <View
              className="h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: colors.accent }}
            >
              <Text className="text-xl font-bold text-white">
                {(profile?.display_name || profile?.handle || '?')[0].toUpperCase()}
              </Text>
            </View>
          )}
          <View className="min-w-0 flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-base font-bold text-apple-ink" numberOfLines={1}>
                {profile?.display_name ?? session?.user.email ?? 'Builder'}
              </Text>
              {profile ? <UserBadges user={profile} size="inline" /> : null}
            </View>
            {profile?.handle ? (
              <Text className="text-sm text-apple-secondary">@{profile.handle}</Text>
            ) : null}
            <Text className="mt-0.5 text-xs text-apple-tertiary">Tap to edit profile</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.tertiary} />
        </AppleCard>
      </Pressable>

      <AppleCard style={{ padding: 20, marginBottom: 16, alignItems: 'center' }}>
        <View className="flex-row gap-7">
          <Stat label="Followers" value={formatCount(counts.followers)} />
          <Stat label="Following" value={formatCount(counts.following)} />
          <Stat label="Mods" value={String(modCount)} />
        </View>
      </AppleCard>

      <Pressable onPress={() => router.push('/profile/subscription')}>
        <AppleCard
          style={{
            padding: 18,
            marginBottom: 16,
            backgroundColor: colors.accentSoft,
          }}
        >
          <View className="flex-row items-center gap-2">
            <Ionicons name="sparkles" size={16} color={colors.accent} />
            <Text className="text-[13px] font-semibold capitalize text-accent">
              {TIER_LABEL[tier] ?? tier} · Active
            </Text>
          </View>
          <Text className="mt-1.5 text-[22px] font-bold text-apple-ink">
            {tier === 'free' ? 'Upgrade to unlock perks' : 'Manage subscription'}
          </Text>
          <Text className="mt-0.5 text-sm text-apple-secondary">
            {tier === 'free'
              ? 'Badges, verification, and export tools'
              : 'Member perks, badges, and verification'}
          </Text>
        </AppleCard>
      </Pressable>

      <Text className="mb-2.5 px-1 text-[13px] font-semibold text-apple-secondary">
        My garage
      </Text>
      {primaryVehicle ? (
        <Pressable onPress={() => router.push(`/vehicle/${primaryVehicle.id}`)}>
          <AppleCard
            style={{
              padding: 14,
              marginBottom: 20,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <VehicleThumb size={52} color={colors.accent} />
            <View className="min-w-0 flex-1">
              <Text className="text-base font-semibold text-apple-ink">
                {primaryVehicle.nickname ??
                  `${primaryVehicle.year} ${primaryVehicle.make} ${primaryVehicle.model}`}
              </Text>
              <Text className="text-[13px] text-apple-secondary">
                {primaryVehicle.mod_count} mods · $
                {(Number(primaryVehicle.total_spend) / 1000).toFixed(1)}k invested
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.tertiary} />
          </AppleCard>
        </Pressable>
      ) : (
        <Pressable onPress={() => router.push('/garage/add-vehicle')}>
          <AppleCard style={{ padding: 14, marginBottom: 20 }}>
            <Text className="font-semibold text-apple-ink">Add your first vehicle</Text>
            <Text className="mt-0.5 text-sm text-apple-secondary">
              Start logging mods and tracking spend
            </Text>
          </AppleCard>
        </Pressable>
      )}

      <Text className="mb-2.5 px-1 text-[13px] font-semibold text-apple-secondary">
        Badges earned
      </Text>
      <View className="mb-6 flex-row flex-wrap gap-2.5">
        {badges.map((b) => (
          <BadgeTile key={b.name} badge={b} />
        ))}
      </View>

      <Text className="mb-2 px-1 text-[13px] font-semibold text-apple-secondary">Account</Text>
      <AppleCard style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
        <MenuRow label="Appearance" onPress={() => router.push('/settings/appearance')} />
        <MenuRow label="Edit profile" onPress={() => router.push('/profile/edit')} />
        <MenuRow label="Identity verification" onPress={() => router.push('/profile/verify')} />
        <MenuRow
          label="Notification settings"
          onPress={() => router.push('/settings/notifications')}
        />
        <MenuRow label="Saved" onPress={() => router.push('/settings/saved')} />
        <MenuRow
          label="Saved searches"
          detail={canSaveSearches(tier) ? undefined : 'Member'}
          onPress={() => router.push('/settings/saved-searches')}
        />
        <MenuRow label="Blocked accounts" onPress={() => router.push('/settings/blocked')} />
        {profile?.account_type === 'workshop' ? (
          <>
            <MenuRow
              label="Business profile"
              detail={canManageWorkshopProfile(tier) ? undefined : 'Workshop'}
              onPress={() => router.push('/workshop/profile-edit')}
            />
            <MenuRow label="Customer jobs" onPress={() => router.push('/workshop/jobs')} />
            <MenuRow label="Enquiries" onPress={() => router.push('/workshop/enquiries')} />
            <MenuRow label="Portfolio" onPress={() => router.push('/workshop/portfolio')} />
            <MenuRow label="Reviews" onPress={() => router.push('/workshop/reviews')} />
          </>
        ) : (
          <>
            <MenuRow
              label="Workshop profile"
              detail={canManageWorkshopProfile(tier) ? undefined : 'Workshop'}
              onPress={() => router.push('/workshop/profile-edit')}
            />
            {profile?.is_workshop ? (
              <MenuRow
                label="Workshop installs"
                detail={canManageWorkshopProfile(tier) ? undefined : 'Workshop'}
                onPress={() => router.push('/profile/workshop-installs')}
              />
            ) : null}
          </>
        )}
        <MenuRow
          label="Pending uploads"
          onPress={() => router.push('/settings/upload-queue')}
          last={!profile?.is_admin}
        />
      </AppleCard>

      {profile?.is_admin ? (
        <>
          <Text className="mb-2 px-1 text-[13px] font-semibold text-apple-secondary">Admin</Text>
          <AppleCard style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
            <MenuRow label="Moderate parts" onPress={() => router.push('/admin/moderation')} />
            <MenuRow label="Affiliate links" onPress={() => router.push('/admin/affiliate')} />
            <MenuRow label="Part clicks" onPress={() => router.push('/admin/part-clicks')} last />
          </AppleCard>
        </>
      ) : null}

      <View className="flex-row gap-4 px-1">
        <Pressable onPress={() => router.push('/legal/privacy')}>
          <Text className="text-sm text-apple-tertiary">Privacy</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/legal/terms')}>
          <Text className="text-sm text-apple-tertiary">Terms</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => signOut()}
        className="mt-6 self-start rounded-xl border border-apple-border px-4 py-2"
      >
        <Text className="text-apple-secondary">Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

type BadgeDef = {
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  earned: boolean;
};

function buildBadges({
  modCount,
  totalSpend,
  verified,
  tier,
}: {
  modCount: number;
  totalSpend: number;
  verified: boolean;
  tier: string;
}): BadgeDef[] {
  return [
    { name: 'Builder', icon: 'ribbon-outline', color: colors.accent, earned: modCount >= 1 },
    { name: 'Verified', icon: 'checkmark-circle', color: colors.green, earned: verified },
    {
      name: 'Big Spender',
      icon: 'cash-outline',
      color: colors.amber,
      earned: totalSpend >= 10000,
    },
    {
      name: 'Scholar',
      icon: 'school-outline',
      color: colors.purple,
      earned: tier === 'pro' || tier === 'workshop' || tier === 'member',
    },
  ];
}

function BadgeTile({ badge }: { badge: BadgeDef }) {
  const tint = badge.earned ? badge.color : colors.tertiary;
  return (
    <View style={{ width: '23%' }}>
      <AppleCard
        style={{
          aspectRatio: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 6,
          opacity: badge.earned ? 1 : 0.45,
        }}
      >
        <Ionicons name={badge.icon} size={22} color={tint} />
        <Text
          className="mt-1.5 text-center text-[11px] font-semibold text-apple-secondary"
          numberOfLines={1}
        >
          {badge.name}
        </Text>
      </AppleCard>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="items-center">
      <Text className="text-lg font-bold text-apple-ink">{value}</Text>
      <Text className="text-[13px] text-apple-secondary">{label}</Text>
    </View>
  );
}

function MenuRow({
  label,
  detail,
  onPress,
  last,
}: {
  label: string;
  detail?: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center justify-between px-4 py-3.5 active:bg-apple-bg2 ${
        last ? '' : 'border-b border-apple-border'
      }`}
    >
      <Text className="text-[15px] text-apple-ink">{label}</Text>
      <View className="flex-row items-center gap-2">
        {detail ? (
          <Text className="text-xs font-semibold uppercase tracking-wider text-accent">
            {detail}
          </Text>
        ) : null}
        <Ionicons name="chevron-forward" size={18} color={colors.tertiary} />
      </View>
    </Pressable>
  );
}
