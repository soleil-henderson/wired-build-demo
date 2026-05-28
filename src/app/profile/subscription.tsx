import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { SubscriptionTier } from '@/types/database';

type TierMeta = {
  id: SubscriptionTier;
  label: string;
  pitch: string;
  perks: string[];
};

const TIERS: TierMeta[] = [
  {
    id: 'free',
    label: 'Free',
    pitch: 'Track your builds with no limits on mods or photos.',
    perks: [
      'Up to 3 vehicles in your garage',
      'Unlimited mod logging + photos',
      'Public build profile',
      'Read-only access to parts catalogue',
    ],
  },
  {
    id: 'member',
    label: 'Member',
    pitch: 'For builders who want to share and discover.',
    perks: [
      'Unlimited vehicles',
      'Member-rate affiliate links on the parts catalogue',
      'Comment + react on any public build',
      'Saved searches in Explore',
    ],
  },
  {
    id: 'pro',
    label: 'Pro',
    pitch: 'For serious builders + content creators.',
    perks: [
      'Everything in Member',
      'PRO badge on your profile and posts',
      'Detailed spend analytics + export to CSV',
      'Receipt OCR + auto-extracted cost / supplier',
      'Priority verification review',
    ],
  },
  {
    id: 'workshop',
    label: 'Workshop',
    pitch: 'For installers, retailers and shops.',
    perks: [
      'Everything in Pro',
      'WORKSHOP badge + verified business profile',
      'Tag your installs on customer vehicles',
      'Inventory cross-sell on the parts catalogue',
      'Lead generation from Explore search',
    ],
  },
];

export default function SubscriptionScreen() {
  const { session } = useAuth();
  const [currentTier, setCurrentTier] = useState<SubscriptionTier>('free');

  const load = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase
      .from('users')
      .select('subscription_tier')
      .eq('id', session.user.id)
      .maybeSingle();
    if (data?.subscription_tier) setCurrentTier(data.subscription_tier);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <ScrollView className="flex-1 bg-ink-950" contentContainerClassName="pb-12">
      <Stack.Screen options={{ title: 'Subscription' }} />

      <View className="px-6 pt-6">
        <Text className="text-accent text-xs font-semibold tracking-[3px]">
          SUBSCRIPTION
        </Text>
        <Text className="mt-1 text-3xl font-bold text-white">Pick a tier</Text>
        <Text className="mt-2 text-ink-300">
          Subscription state lives server-side and is only ever updated by
          Stripe / app-store webhooks. The buttons below are placeholders for
          the checkout flow.
        </Text>
      </View>

      <View className="mt-6 gap-3 px-6">
        {TIERS.map((tier) => {
          const isCurrent = tier.id === currentTier;
          return (
            <View
              key={tier.id}
              className={`rounded-2xl border p-5 ${
                isCurrent
                  ? 'border-accent bg-accent/10'
                  : 'border-ink-700 bg-ink-900'
              }`}
            >
              <View className="flex-row items-center justify-between">
                <Text
                  className={`text-lg font-bold ${
                    isCurrent ? 'text-accent' : 'text-white'
                  }`}
                >
                  {tier.label}
                </Text>
                {isCurrent ? (
                  <View className="rounded-full bg-accent px-2 py-0.5">
                    <Text className="text-[10px] font-bold uppercase tracking-wider text-ink-950">
                      Current
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text className="mt-1 text-sm text-ink-200">{tier.pitch}</Text>
              <View className="mt-3 gap-1.5">
                {tier.perks.map((perk) => (
                  <View key={perk} className="flex-row gap-2">
                    <Text className="text-accent">·</Text>
                    <Text className="flex-1 text-sm text-ink-200">{perk}</Text>
                  </View>
                ))}
              </View>
              {!isCurrent && tier.id !== 'free' ? (
                <Pressable
                  onPress={() =>
                    Alert.alert(
                      'Coming soon',
                      'Checkout will route through the App Store / Stripe Billing Portal. The server-side webhook is what flips your subscription_tier — we never trust the client.'
                    )
                  }
                  className="mt-4 self-start rounded-xl bg-accent px-4 py-2 active:bg-accent-dark"
                >
                  <Text className="font-semibold text-ink-950">Upgrade to {tier.label}</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
