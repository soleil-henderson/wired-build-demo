import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import {
  getModProductContext,
  listModsUsingCustomProduct,
  modPrimaryUrl,
  modProductBrand,
  modProductLabel,
  modShoppingQuery,
  type ModInstallRow,
  type ModProductContext,
} from '@/lib/product-page';
import { fetchProductShopping } from '@/lib/product-resolve';
import { routeParam } from '@/lib/route-param';
import { useFocusData } from '@/lib/use-focus-data';

export default function ModProductScreen() {
  const params = useLocalSearchParams<{ modId: string }>();
  const modId = routeParam(params.modId);
  const router = useRouter();

  const [ctx, setCtx] = useState<ModProductContext | null>(null);
  const [related, setRelated] = useState<ModInstallRow[]>([]);
  const [shopping, setShopping] = useState<ShoppingOffer[]>([]);
  const [shoppingSearchUrl, setShoppingSearchUrl] = useState<string | null>(null);
  const [shoppingLoading, setShoppingLoading] = useState(true);
  const [shoppingError, setShoppingError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!modId) {
      setLoading(false);
      return;
    }
    try {
      const mod = await getModProductContext(modId);
      if (!mod) {
        setCtx(null);
        return;
      }
      if (mod.part_id) {
        setCtx(mod);
        return;
      }

      const relatedMods = await listModsUsingCustomProduct(
        modPrimaryUrl(mod),
        modProductLabel(mod),
        mod.id
      );
      setCtx(mod);
      setRelated(relatedMods);

      setShoppingLoading(true);
      setShoppingError(null);
      const result = await fetchProductShopping({
        query: modShoppingQuery(mod),
        url: modPrimaryUrl(mod),
        cached: mod.product_links.shopping ?? [],
      });
      setShopping(result.shopping);
      setShoppingSearchUrl(result.shopping_search_url);
      setShoppingError(result.error ?? null);
      setShoppingLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load product';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [modId]);

  const resetEntity = useCallback(() => {
    setCtx(null);
    setRelated([]);
    setLoading(true);
  }, []);

  useFocusData(
    async ({ isInitial }) => {
      if (isInitial) setLoading(true);
      await load();
    },
    [load],
    { cacheKey: modId, onCacheKeyChange: resetEntity }
  );

  if (loading && !ctx) {
    return (
      <View className="flex-1 items-center justify-center bg-apple-bg2">
        <Stack.Screen options={{ title: 'Product' }} />
        <ActivityIndicator color="#FF6A2B" />
      </View>
    );
  }

  if (!ctx) {
    return (
      <View className="flex-1 items-center justify-center bg-apple-bg2 px-6">
        <Stack.Screen options={{ title: 'Not found' }} />
        <Text className="text-apple-ink">This product isn&apos;t available.</Text>
      </View>
    );
  }

  if (ctx.part_id) {
    return <Redirect href={`/part/${ctx.part_id}`} />;
  }

  const label = modProductLabel(ctx);
  const brand = modProductBrand(ctx);
  const primary = ctx.product_links.primary;

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
      <Stack.Screen options={{ title: brand }} />

      <View className="bg-white px-6 pt-6 pb-6">
        <Text className="text-[11px] uppercase tracking-wider text-accent">
          {ctx.category.replace('_', ' ')}
        </Text>
        <Text className="mt-2 text-2xl font-bold text-apple-ink">{brand}</Text>
        <Text className="mt-1 text-lg text-apple-secondary">{label}</Text>

        {ctx.cost != null ? (
          <Text className="mt-4 text-sm text-apple-secondary">
            Logged at ${Number(ctx.cost).toLocaleString()}
          </Text>
        ) : null}

        {ctx.owner ? (
          <Pressable
            onPress={() => router.push(`/user/${ctx.owner!.handle}`)}
            className="mt-4 flex-row items-center gap-2 active:opacity-80"
          >
            <Text className="text-xs uppercase tracking-wider text-apple-secondary">
              Saved from a build
            </Text>
            <Text className="text-sm font-semibold text-apple-ink">@{ctx.owner.handle}</Text>
          </Pressable>
        ) : null}

        {primary?.url ? (
          <Pressable
            onPress={() => Linking.openURL(primary.url)}
            className="mt-6 rounded-xl bg-accent px-4 py-2.5 active:bg-accent-dark"
          >
            <Text className="font-semibold text-white">Shop this product ↗</Text>
          </Pressable>
        ) : null}
      </View>

      <View className="px-6 pt-6">
        <ProductPriceRangeCard
          offers={shopping}
          targetPrice={ctx.cost}
          targetLabel="Logged cost"
          loading={shoppingLoading}
          error={shoppingError}
          shoppingSearchUrl={shoppingSearchUrl}
        />
      </View>

      <View className="px-6 pt-6">
        <WhereToBuySection
          offers={shopping}
          shoppingSearchUrl={shoppingSearchUrl}
          extraLinks={[
            ...(primary?.url
              ? [{ url: primary.url, label: primary.name || brand, subtitle: primary.url }]
              : []),
          ]}
        />
      </View>

      {related.length > 0 || ctx.postId ? (
        <View className="px-6 pt-6">
          <Text className="text-xs font-semibold uppercase tracking-[2px] text-apple-secondary">
            Mods using this product
          </Text>
          <View className="mt-3 gap-3">
            <ModRow row={modToRow(ctx)} />
            {related
              .filter((row) => row.modId !== ctx.id)
              .map((row) => (
                <ModRow key={row.modId} row={row} />
              ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

function modToRow(ctx: ModProductContext): ModInstallRow {
  return {
    modId: ctx.id,
    postId: ctx.postId,
    cost: ctx.cost,
    installDate: ctx.install_date,
    photoUrl: ctx.photoUrl,
    vehicle: ctx.vehicle,
    owner: ctx.owner,
  };
}

function ModRow({ row }: { row: ModInstallRow }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => {
        if (row.postId) router.push(`/post/${row.postId}`);
        else if (row.vehicle?.id) router.push(`/vehicle/${row.vehicle.id}`);
      }}
      className="overflow-hidden rounded-2xl border border-apple-border bg-white active:bg-apple-bg2"
    >
      {row.photoUrl ? (
        <Image source={{ uri: row.photoUrl }} className="h-44 w-full bg-apple-bg2" resizeMode="cover" />
      ) : null}
      <View className="p-4">
        {row.owner ? (
          <Text className="text-sm font-semibold text-apple-ink">@{row.owner.handle}</Text>
        ) : null}
        {row.vehicle ? (
          <Text className="mt-1 text-xs uppercase tracking-wider text-apple-secondary">
            {row.vehicle.nickname ??
              `${row.vehicle.year} ${row.vehicle.make} ${row.vehicle.model}`}
          </Text>
        ) : null}
        {row.cost != null ? (
          <Text className="mt-2 text-sm font-semibold text-apple-ink">
            ${Number(row.cost).toLocaleString()}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
