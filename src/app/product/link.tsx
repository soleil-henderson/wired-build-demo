import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { ProductPriceRangeCard } from '@/components/product/ProductPriceRangeCard';
import { WhereToBuySection } from '@/components/product/WhereToBuySection';
import type { ShoppingOffer } from '@/lib/mod-products';
import { fetchProductShopping } from '@/lib/product-resolve';
import { routeParam } from '@/lib/route-param';
import { useFocusData } from '@/lib/use-focus-data';

export default function ProductLinkScreen() {
  const params = useLocalSearchParams<{ url: string; name?: string }>();
  const productUrl = routeParam(params.url) ?? '';
  const productName = routeParam(params.name) || productUrl || 'Product';

  const [shopping, setShopping] = useState<ShoppingOffer[]>([]);
  const [shoppingSearchUrl, setShoppingSearchUrl] = useState<string | null>(null);
  const [shoppingError, setShoppingError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!productUrl) {
      setLoading(false);
      return;
    }
    try {
      const result = await fetchProductShopping({ query: productName, url: productUrl });
      setShopping(result.shopping);
      setShoppingSearchUrl(result.shopping_search_url);
      setShoppingError(result.error ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load product';
      setShoppingError(message);
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [productUrl, productName]);

  useFocusData(
    async ({ isInitial }) => {
      if (isInitial && shopping.length === 0) setLoading(true);
      await load();
    },
    [load],
    { cacheKey: productUrl }
  );

  if (!productUrl) {
    return (
      <View className="flex-1 items-center justify-center bg-apple-bg2 px-6">
        <Stack.Screen options={{ title: 'Product' }} />
        <Text className="text-apple-ink">Missing product link.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-apple-bg2"
      contentContainerClassName="pb-24"
      refreshControl={
        <RefreshControl
          tintColor="#F5A524"
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
        />
      }
    >
      <Stack.Screen options={{ title: 'Product' }} />

      <View className="bg-white px-6 pt-6 pb-6">
        <Text className="text-2xl font-bold text-apple-ink">{productName}</Text>
        <Pressable
          onPress={() => Linking.openURL(productUrl)}
          className="mt-6 rounded-xl bg-accent px-4 py-2.5 active:bg-accent-dark"
        >
          <Text className="font-semibold text-white">Shop this product ↗</Text>
        </Pressable>
      </View>

      <View className="px-6 pt-6">
        <ProductPriceRangeCard
          offers={shopping}
          loading={loading}
          error={shoppingError}
          shoppingSearchUrl={shoppingSearchUrl}
        />
        <View className="mt-6">
          <WhereToBuySection
            offers={shopping}
            shoppingSearchUrl={shoppingSearchUrl}
            extraLinks={[{ url: productUrl, label: productName, subtitle: productUrl }]}
          />
        </View>
      </View>
    </ScrollView>
  );
}
