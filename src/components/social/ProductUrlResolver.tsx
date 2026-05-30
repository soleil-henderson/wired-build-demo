import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  emptyProductLinks,
  type ModProductLinks,
  type ShoppingOffer,
} from '@/lib/mod-products';
import { isValidHttpUrl, resolveProductUrl, type ResolvedProduct } from '@/lib/product-resolve';
import { colors, inputClassName } from '@/lib/theme';

export type ResolvedPartDescriptor = {
  brand: string;
  name: string;
  category?: string;
};

type Props = {
  productLinks: ModProductLinks;
  onProductLinksChange: (links: ModProductLinks) => void;
  onPartResolved: (part: ResolvedPartDescriptor) => void;
  onClearPart: () => void;
  resolvedPart: ResolvedPartDescriptor | null;
  resolvedImageUrl?: string | null;
  onLookupComplete?: (result: ResolvedProduct) => void;
};

export function ProductUrlResolver({
  productLinks,
  onProductLinksChange,
  onPartResolved,
  onClearPart,
  resolvedPart,
  resolvedImageUrl,
  onLookupComplete,
}: Props) {
  const [url, setUrl] = useState(productLinks.primary?.url ?? '');
  const [resolving, setResolving] = useState(false);
  const [lastResolved, setLastResolved] = useState<ResolvedProduct | null>(null);

  async function handleLookup() {
    const trimmed = url.trim();
    if (!isValidHttpUrl(trimmed)) {
      Alert.alert('Invalid link', 'Paste a full product URL starting with https://');
      return;
    }

    setResolving(true);
    try {
      const result = await resolveProductUrl(trimmed);
      setLastResolved(result);

      const partName = `${result.brand} ${result.name}`.trim();
      onPartResolved({ brand: result.brand, name: result.name });
      onProductLinksChange({
        ...productLinks,
        primary: { name: partName, url: trimmed },
        shopping: result.shopping,
        shopping_search_url: result.shopping_search_url,
      });
      onLookupComplete?.(result);
      if (result.shopping.length === 0 && result.shopping_error) {
        Alert.alert('No prices found', result.shopping_error);
      } else if (result.shopping.length === 0 && result.shopping_search_url) {
        Alert.alert(
          'No live prices',
          'We saved your link but could not find Google Shopping results for this product yet.'
        );
      }
    } catch (err) {
      Alert.alert(
        'Product lookup failed',
        err instanceof Error ? err.message : 'Try another product page URL.'
      );
    } finally {
      setResolving(false);
    }
  }

  function handleClear() {
    setUrl('');
    setLastResolved(null);
    onClearPart();
    onProductLinksChange(emptyProductLinks());
  }

  return (
    <View className="gap-4">
      <View>
        <Text className="text-xs font-semibold uppercase tracking-wider text-apple-secondary">
          Product link
        </Text>
        <Text className="mt-1 text-xs text-apple-tertiary">
          Paste a store URL — we&apos;ll pull the brand, name, and find other sellers.
        </Text>
        <View className="mt-2 flex-row items-center gap-2">
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="https://store.com/product…"
            placeholderTextColor={colors.tertiary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            className={`min-h-[44px] flex-1 ${inputClassName}`}
          />
          <Pressable
            onPress={handleLookup}
            disabled={resolving || !url.trim()}
            className="rounded-xl bg-accent px-4 py-3 disabled:opacity-50"
          >
            {resolving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="font-semibold text-white">Look up</Text>
            )}
          </Pressable>
        </View>
      </View>

      {resolvedPart ? (
        <View className="overflow-hidden rounded-2xl border border-apple-border bg-white">
          <View className="flex-row p-4">
            {resolvedImageUrl ? (
              <Image
                source={{ uri: resolvedImageUrl }}
                style={{ width: 72, height: 72, borderRadius: 12 }}
                contentFit="cover"
              />
            ) : (
              <View className="h-[72px] w-[72px] items-center justify-center rounded-xl bg-apple-bg2">
                <Ionicons name="cube-outline" size={28} color={colors.accent} />
              </View>
            )}
            <View className="ml-3 min-w-0 flex-1">
              <Text className="text-xs uppercase tracking-wider text-apple-secondary">
                {lastResolved?.merchant ?? 'Linked product'}
              </Text>
              <Text className="mt-0.5 text-base font-semibold text-apple-ink">
                {resolvedPart.brand}
              </Text>
              <Text className="text-sm text-apple-secondary">{resolvedPart.name}</Text>
              {lastResolved?.price ? (
                <Text className="mt-1 text-sm font-semibold text-accent">
                  {lastResolved.price}
                </Text>
              ) : null}
              {lastResolved?.scrape_warning ? (
                <Text className="mt-2 text-xs leading-4 text-amber-700">
                  {lastResolved.scrape_warning}
                </Text>
              ) : null}
            </View>
          </View>
          <View className="flex-row border-t border-apple-border">
            <Pressable
              onPress={() => {
                const link = productLinks.primary?.url?.trim() || url.trim();
                if (link) void Linking.openURL(link);
              }}
              className="flex-1 items-center border-r border-apple-border py-2.5 active:bg-apple-bg2"
            >
              <Text className="text-sm font-semibold text-signal-blue">View store</Text>
            </Pressable>
            <Pressable onPress={handleClear} className="flex-1 items-center py-2.5 active:bg-apple-bg2">
              <Text className="text-sm font-semibold text-apple-secondary">Change</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {(productLinks.shopping?.length ?? 0) > 0 ? (
        <ShoppingAlternativesList offers={productLinks.shopping!} />
      ) : productLinks.shopping_search_url ? (
        <Pressable
          onPress={() => Linking.openURL(productLinks.shopping_search_url!)}
          className="flex-row items-center gap-2 rounded-xl border border-apple-border bg-white px-4 py-3 active:bg-apple-bg2"
        >
          <Ionicons name="logo-google" size={18} color={colors.blue} />
          <Text className="flex-1 text-sm font-semibold text-signal-blue">
            Compare prices on Google Shopping
          </Text>
          <Ionicons name="open-outline" size={16} color={colors.tertiary} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function ShoppingAlternativesList({ offers }: { offers: ShoppingOffer[] }) {
  return (
    <View>
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-apple-secondary">
        Also available at
      </Text>
      <View className="gap-2">
        {offers.map((offer, i) => (
          <Pressable
            key={`${offer.url}-${i}`}
            onPress={() => Linking.openURL(offer.url)}
            className="flex-row items-center gap-3 rounded-xl border border-apple-border bg-white p-3 active:bg-apple-bg2"
          >
            <View className="h-9 w-9 items-center justify-center rounded-lg bg-apple-bg2">
              <Ionicons name="storefront-outline" size={18} color={colors.accent} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-sm font-semibold text-apple-ink" numberOfLines={2}>
                {offer.title}
              </Text>
              <Text className="text-xs text-apple-secondary">{offer.source}</Text>
            </View>
            {offer.price ? (
              <Text className="text-sm font-bold text-accent">{offer.price}</Text>
            ) : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Extra product URL row — URL + optional purpose, auto-resolves name on lookup. */
export function ExtraProductUrlField({
  url,
  purpose,
  onChangeUrl,
  onChangePurpose,
  onRemove,
}: {
  url: string;
  purpose: string;
  onChangeUrl: (v: string) => void;
  onChangePurpose: (v: string) => void;
  onRemove: () => void;
}) {
  const [resolving, setResolving] = useState(false);
  const [resolvedName, setResolvedName] = useState<string | null>(null);

  async function lookup() {
    if (!isValidHttpUrl(url)) return;
    setResolving(true);
    try {
      const r = await resolveProductUrl(url, false);
      setResolvedName(`${r.brand} ${r.name}`.trim());
      /* Keep the URL the user pasted — never overwrite from scrape. */
    } catch {
      /* keep manual url */
    } finally {
      setResolving(false);
    }
  }

  return (
    <View className="rounded-xl border border-apple-border bg-white p-3">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-xs font-semibold text-apple-secondary">Other product</Text>
        <Pressable onPress={onRemove} hitSlop={8}>
          <Ionicons name="close-circle" size={20} color={colors.tertiary} />
        </Pressable>
      </View>
      <View className="flex-row gap-2">
        <TextInput
          value={url}
          onChangeText={(v) => {
            setResolvedName(null);
            onChangeUrl(v);
          }}
          onBlur={() => {
            if (url.trim() && !resolvedName) void lookup();
          }}
          placeholder="https://…"
          placeholderTextColor={colors.tertiary}
          autoCapitalize="none"
          keyboardType="url"
          className={`min-h-[44px] flex-1 ${inputClassName}`}
        />
        {resolving ? <ActivityIndicator color={colors.accent} /> : null}
      </View>
      {resolvedName ? (
        <Text className="mt-1 text-xs text-signal-green">{resolvedName}</Text>
      ) : null}
      <TextInput
        value={purpose}
        onChangeText={onChangePurpose}
        placeholder="What was this used for?"
        placeholderTextColor={colors.tertiary}
        className={`mt-2 ${inputClassName}`}
      />
    </View>
  );
}
