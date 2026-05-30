import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, Text, View } from 'react-native';

import { AppleCard } from '@/components/apple/AppleCard';
import { analyzeShoppingOffers, formatMoney, parsePrice } from '@/lib/product-pricing';
import type { ShoppingOffer } from '@/lib/mod-products';
import { colors } from '@/lib/theme';

type BuyLink = {
  url: string;
  label: string;
  subtitle?: string;
  price?: string | null;
  isBest?: boolean;
};

type Props = {
  offers: ShoppingOffer[];
  extraLinks?: BuyLink[];
  shoppingSearchUrl?: string | null;
  onOpenLink?: (url: string) => void;
};

function hostFromUrl(raw: string): string {
  try {
    return new URL(raw).hostname.replace(/^www\./, '');
  } catch {
    return raw;
  }
}

export function WhereToBuySection({
  offers,
  extraLinks = [],
  shoppingSearchUrl,
  onOpenLink,
}: Props) {
  const analysis = analyzeShoppingOffers(offers);
  const bestUrl = analysis?.best.url ?? null;

  const rows: BuyLink[] = [];

  for (const offer of offers) {
    rows.push({
      url: offer.url,
      label: offer.source || hostFromUrl(offer.url),
      subtitle: offer.title,
      price: offer.price,
      isBest: offer.url === bestUrl,
    });
  }

  for (const link of extraLinks) {
    if (rows.some((r) => r.url === link.url)) continue;
    rows.push(link);
  }

  if (rows.length === 0 && !shoppingSearchUrl) {
    return null;
  }

  async function open(url: string) {
    if (onOpenLink) {
      onOpenLink(url);
      return;
    }
    await Linking.openURL(url);
  }

  return (
    <View>
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-xs font-semibold uppercase tracking-[2px] text-apple-secondary">
          Where to buy
        </Text>
        {shoppingSearchUrl ? (
          <Pressable onPress={() => open(shoppingSearchUrl)} className="active:opacity-80">
            <Text className="text-sm font-semibold text-signal-blue">More on Google</Text>
          </Pressable>
        ) : null}
      </View>

      {rows.length > 0 ? (
        <AppleCard style={{ padding: 0, overflow: 'hidden' }}>
          {rows.map((row, i) => {
            const amount = parsePrice(row.price ?? null);
            return (
              <Pressable
                key={`${row.url}-${i}`}
                onPress={() => open(row.url)}
                className={`flex-row items-center gap-3 px-4 py-3.5 active:bg-apple-bg2 ${
                  i > 0 ? 'border-t border-apple-border' : ''
                }`}
              >
                <View
                  className={`h-9 w-9 items-center justify-center rounded-lg ${
                    row.isBest ? 'bg-signal-green/15' : 'bg-apple-bg2'
                  }`}
                >
                  <Ionicons
                    name="link"
                    size={16}
                    color={row.isBest ? colors.green : colors.secondary}
                  />
                </View>
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="font-semibold text-apple-ink" numberOfLines={1}>
                      {row.label}
                    </Text>
                    {row.isBest ? (
                      <View className="rounded-md bg-signal-green/15 px-1.5 py-0.5">
                        <Text className="text-[10px] font-bold uppercase text-signal-green">
                          Best
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {row.subtitle ? (
                    <Text className="mt-0.5 text-xs text-apple-secondary" numberOfLines={1}>
                      {row.subtitle}
                    </Text>
                  ) : (
                    <Text className="mt-0.5 text-xs text-apple-tertiary" numberOfLines={1}>
                      {hostFromUrl(row.url)}
                    </Text>
                  )}
                </View>
                {amount != null ? (
                  <Text className="text-sm font-semibold text-apple-ink">
                    {formatMoney(amount)}
                  </Text>
                ) : row.price ? (
                  <Text className="text-sm font-semibold text-apple-ink">{row.price}</Text>
                ) : null}
                <Ionicons name="open-outline" size={16} color={colors.tertiary} />
              </Pressable>
            );
          })}
        </AppleCard>
      ) : shoppingSearchUrl ? (
        <Pressable
          onPress={() => open(shoppingSearchUrl)}
          className="flex-row items-center gap-2 rounded-2xl border border-apple-border bg-white p-4 active:bg-apple-bg2"
        >
          <Ionicons name="logo-google" size={18} color={colors.blue} />
          <Text className="text-sm font-semibold text-signal-blue">Compare on Google Shopping</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
