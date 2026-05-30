import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
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
import { toolCostLabel, toolLabel } from '@/lib/mod-tools';
import { fetchProductShopping } from '@/lib/product-resolve';
import { routeParam } from '@/lib/route-param';
import {
  getToolProductContext,
  listModsUsingTool,
  toolShoppingQuery,
  type ToolInstallRow,
  type ToolProductContext,
} from '@/lib/tool-page';
import { colors } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

export default function ToolProductScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = routeParam(params.id);
  const router = useRouter();

  const [ctx, setCtx] = useState<ToolProductContext | null>(null);
  const [related, setRelated] = useState<ToolInstallRow[]>([]);
  const [shopping, setShopping] = useState<ShoppingOffer[]>([]);
  const [shoppingSearchUrl, setShoppingSearchUrl] = useState<string | null>(null);
  const [shoppingLoading, setShoppingLoading] = useState(true);
  const [shoppingError, setShoppingError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    try {
      const tool = await getToolProductContext(id);
      if (!tool) {
        setCtx(null);
        return;
      }
      const relatedMods = await listModsUsingTool(tool, tool.mod.id);
      setCtx(tool);
      setRelated(relatedMods);

      if (tool.url) {
        setShoppingLoading(true);
        setShoppingError(null);
        const result = await fetchProductShopping({
          query: toolShoppingQuery(tool),
          url: tool.url,
        });
        setShopping(result.shopping);
        setShoppingSearchUrl(result.shopping_search_url);
        setShoppingError(result.error ?? null);
        setShoppingLoading(false);
      } else {
        setShopping([]);
        setShoppingSearchUrl(null);
        setShoppingLoading(false);
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not load tool');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

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
    { cacheKey: id, onCacheKeyChange: resetEntity }
  );

  if (loading && !ctx) {
    return (
      <View className="flex-1 items-center justify-center bg-apple-bg2">
        <Stack.Screen options={{ title: 'Tool' }} />
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!ctx) {
    return (
      <View className="flex-1 items-center justify-center bg-apple-bg2 px-6">
        <Stack.Screen options={{ title: 'Not found' }} />
        <Text className="text-apple-secondary">This tool is not available.</Text>
      </View>
    );
  }

  const title = toolLabel(ctx);

  return (
    <ScrollView
      className="flex-1 bg-apple-bg2"
      contentContainerClassName="pb-10"
      refreshControl={
        <RefreshControl
          tintColor={colors.accent}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
        />
      }
    >
      <Stack.Screen options={{ title: 'Tool' }} />

      <View className="border-b border-apple-border bg-apple-surface px-4 py-5">
        <View className="flex-row items-start gap-3">
          <View
            className="h-12 w-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: colors.accentSoft }}
          >
            <Text style={{ fontSize: 22 }}>🔧</Text>
          </View>
          <View className="min-w-0 flex-1">
            {ctx.brand ? (
              <Text className="text-xs font-semibold uppercase tracking-wider text-apple-secondary">
                {ctx.brand}
              </Text>
            ) : null}
            <Text className="text-xl font-bold text-apple-ink">{ctx.name}</Text>
            <Text className="mt-1 text-sm text-apple-secondary">
              {ctx.ownership === 'hired' ? 'Hired for install' : 'Owned tool'} ·{' '}
              {toolCostLabel(ctx)}
            </Text>
          </View>
        </View>

        {ctx.url ? (
          <Pressable
            onPress={() => Linking.openURL(ctx.url!)}
            className="mt-4 flex-row items-center gap-2 self-start rounded-lg bg-accent-soft px-3 py-2"
          >
            <Text className="text-sm font-semibold text-accent">View product page</Text>
          </Pressable>
        ) : null}

        {ctx.mod.postId ? (
          <Pressable
            onPress={() => router.push(`/post/${ctx.mod.postId}`)}
            className="mt-3 self-start"
          >
            <Text className="text-sm font-semibold text-signal-blue">See install post →</Text>
          </Pressable>
        ) : null}
      </View>

      <View className="px-6 pt-6">
        <ProductPriceRangeCard
          offers={shopping}
          targetPrice={ctx.cost}
          targetLabel={ctx.ownership === 'hired' ? 'Hire cost' : 'Logged cost'}
          loading={shoppingLoading}
          error={shoppingError}
          shoppingSearchUrl={shoppingSearchUrl}
        />
      </View>

      <View className="px-6 pt-6">
        <WhereToBuySection
          offers={shopping}
          shoppingSearchUrl={shoppingSearchUrl}
          extraLinks={
            ctx.url
              ? [{ url: ctx.url, label: title, subtitle: ctx.url }]
              : []
          }
        />
      </View>

      {related.length > 0 ? (
        <View className="px-6 pt-6">
          <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-apple-secondary">
            Used on other builds
          </Text>
          {related.map((row) => (
            <Pressable
              key={row.toolId}
              onPress={() =>
                row.postId
                  ? router.push(`/post/${row.postId}`)
                  : router.push(`/product/tool/${row.toolId}`)
              }
              className="mb-2 flex-row items-center justify-between rounded-xl border border-apple-border bg-apple-surface px-4 py-3 active:opacity-80"
            >
              <View className="min-w-0 flex-1 pr-3">
                <Text className="font-semibold text-apple-ink" numberOfLines={1}>
                  {row.vehicleLabel}
                </Text>
                <Text className="text-xs text-apple-secondary">
                  @{row.ownerHandle} · {row.ownership === 'hired' ? 'Hired' : 'Owned'}
                  {row.cost != null ? ` · $${Number(row.cost).toLocaleString()}` : ''}
                </Text>
              </View>
              <Text className="text-xs text-apple-tertiary">View</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
