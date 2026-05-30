import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';

import { AppleCard } from '@/components/apple/AppleCard';
import {
  analyzeShoppingOffers,
  formatMoney,
  pricePosition,
} from '@/lib/product-pricing';
import type { ShoppingOffer } from '@/lib/mod-products';
import { colors } from '@/lib/theme';

type Props = {
  offers: ShoppingOffer[];
  targetPrice?: number | null;
  targetLabel?: string;
  loading?: boolean;
  error?: string | null;
  shoppingSearchUrl?: string | null;
};

export function ProductPriceRangeCard({
  offers,
  targetPrice,
  targetLabel = 'Avg install cost',
  loading = false,
  error = null,
  shoppingSearchUrl = null,
}: Props) {
  const analysis = analyzeShoppingOffers(offers);

  if (loading) {
    return (
      <AppleCard style={{ padding: 16 }}>
        <View className="items-center py-6">
          <ActivityIndicator color={colors.accent} />
          <Text className="mt-2 text-sm text-apple-secondary">Checking prices…</Text>
        </View>
      </AppleCard>
    );
  }

  if (!analysis) {
    if (!error && !shoppingSearchUrl && offers.length === 0) {
      return null;
    }
    return (
      <AppleCard style={{ padding: 16 }}>
        <Text className="text-base font-semibold text-apple-ink">Price check</Text>
        <Text className="mt-2 text-sm text-apple-secondary">
          {error ?? 'No live prices found for this product yet.'}
        </Text>
        {shoppingSearchUrl ? (
          <Pressable
            onPress={() => Linking.openURL(shoppingSearchUrl)}
            className="mt-4 flex-row items-center gap-2 active:opacity-80"
          >
            <Ionicons name="logo-google" size={16} color={colors.blue} />
            <Text className="text-sm font-semibold text-signal-blue">
              Search Google Shopping
            </Text>
          </Pressable>
        ) : null}
      </AppleCard>
    );
  }

  const { min, max, best } = analysis;
  const markerPos = pricePosition(best.amount, min, max);
  const savings =
    targetPrice != null && targetPrice > best.amount ? targetPrice - best.amount : null;

  return (
    <AppleCard style={{ padding: 16 }}>
      <View className="flex-row items-end justify-between gap-4">
        {targetPrice != null ? (
          <View className="flex-1">
            <Text className="text-xs text-apple-secondary">{targetLabel}</Text>
            <Text className="mt-1 text-2xl font-bold text-apple-ink">
              {formatMoney(targetPrice)}
            </Text>
          </View>
        ) : null}
        <View className={targetPrice != null ? 'flex-1 items-end' : 'flex-1'}>
          <Text className="text-xs text-apple-secondary">Best price found</Text>
          <View className="mt-1 flex-row items-center gap-1">
            <Text className="text-2xl font-bold text-signal-green">
              {formatMoney(best.amount)}
            </Text>
            {savings != null && savings > 0 ? (
              <Ionicons name="trending-down" size={18} color={colors.green} />
            ) : null}
          </View>
        </View>
      </View>

      <View className="mt-5">
        <View className="relative h-2 flex-row overflow-hidden rounded-full">
          <View className="h-2 flex-1 bg-signal-green" />
          <View className="h-2 flex-1 bg-[#FFD60A]" />
          <View className="h-2 flex-1 bg-signal-red" />
          <View
            className="absolute -top-0.5 h-3 w-1 rounded-sm bg-accent"
            style={{ left: `${Math.round(markerPos * 100)}%`, marginLeft: -2 }}
          />
        </View>
        <View className="mt-2 flex-row justify-between">
          <Text className="text-xs text-apple-secondary">{formatMoney(min)}</Text>
          <Text className="text-xs text-apple-secondary">{formatMoney(max)}</Text>
        </View>
      </View>
    </AppleCard>
  );
}
