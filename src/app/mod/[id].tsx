import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
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

import { AppleCard } from '@/components/apple/AppleCard';
import { SaveButton } from '@/components/social/SaveButton';
import { AppleChip, MoneyText } from '@/components/apple/ApplePrimitives';
import { ModToolsDisplay } from '@/components/mods/ModToolsDisplay';
import { ModProductLinksDisplay } from '@/components/social/ModProductLinksForm';
import { MediaCarousel } from '@/components/ui/MediaCarousel';
import { useAuth } from '@/lib/auth-context';
import { getModDetail, type ModDetail } from '@/lib/mods';
import { navigateToModProduct } from '@/lib/product-nav';
import { parseProductLinks } from '@/lib/mod-products';
import { routeParam } from '@/lib/route-param';
import { useFocusData } from '@/lib/use-focus-data';
import { colors } from '@/lib/theme';

export default function ModDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const modId = routeParam(params.id);
  const router = useRouter();
  const { session } = useAuth();

  const [detail, setDetail] = useState<ModDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!modId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const row = await getModDetail(modId);
      setDetail(row);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load mod';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [modId]);

  const resetEntity = useCallback(() => {
    setDetail(null);
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

  const isOwner =
    !!session && !!detail && session.user.id === detail.vehicle.current_owner_id;

  async function handleViewReceipt() {
    if (!detail?.mod.receipt?.previewUrl) return;
    try {
      await Linking.openURL(detail.mod.receipt.previewUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not open receipt';
      Alert.alert('Receipt', message);
    }
  }

  if (loading && !detail) {
    return (
      <View className="flex-1 items-center justify-center bg-apple-bg2">
        <Stack.Screen options={{ title: 'Mod' }} />
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!detail) {
    return (
      <View className="flex-1 items-center justify-center bg-apple-bg2 px-6">
        <Stack.Screen options={{ title: 'Not found' }} />
        <Text className="text-center text-apple-ink">This mod is not available.</Text>
        <Pressable onPress={() => router.back()} className="mt-4 active:opacity-80">
          <Text className="font-semibold text-accent">Go back</Text>
        </Pressable>
      </View>
    );
  }

  const { mod, vehicle, tools } = detail;
  const partLabel = mod.part
    ? `${mod.part.brand} ${mod.part.name}`
    : mod.custom_part_name ?? 'Custom mod';
  const vehicleTitle =
    vehicle.nickname ?? `${vehicle.year ?? ''} ${vehicle.make} ${vehicle.model}`.trim();
  const productLinks = parseProductLinks(mod.product_links);
  const mediaItems = mod.photos.map((p) => ({ url: p.url, kind: 'photo' as const }));

  return (
    <View className="flex-1 bg-apple-bg2">
      <Stack.Screen
        options={{
          title: partLabel,
          headerRight: () => (
            <View className="flex-row items-center">
              {!isOwner ? (
                <SaveButton targetType="mod" targetId={mod.id} className="mr-1 px-2 active:opacity-70" />
              ) : null}
              {isOwner ? (
                <Pressable
                  onPress={() => router.push(`/log/edit?modId=${mod.id}`)}
                  hitSlop={8}
                  className="mr-2 active:opacity-70"
                >
                  <Text className="text-[16px] font-semibold text-accent">Edit</Text>
                </Pressable>
              ) : null}
            </View>
          ),
        }}
      />

      <ScrollView
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
        {mediaItems.length > 0 ? (
          <MediaCarousel items={mediaItems} aspectRatio={4 / 3} />
        ) : (
          <View className="aspect-[4/3] items-center justify-center bg-apple-surface">
            <Ionicons name="construct-outline" size={48} color={colors.tertiary} />
          </View>
        )}

        <View className="px-4 pt-4">
          <View className="flex-row flex-wrap items-center gap-2">
            <AppleChip>{mod.category.replace(/_/g, ' ')}</AppleChip>
            {mod.is_verified_by_workshop ? (
              <View className="flex-row items-center gap-1 rounded-full bg-signal-blue/10 px-2.5 py-1">
                <Ionicons name="checkmark-circle" size={14} color={colors.blue} />
                <Text className="text-xs font-semibold text-signal-blue">Workshop verified</Text>
              </View>
            ) : null}
          </View>

          {mod.part ? (
            <Pressable
              onPress={() => router.push(`/part/${mod.part!.id}`)}
              className="mt-3 active:opacity-80"
            >
              <Text className="text-sm font-semibold text-apple-secondary">{mod.part.brand}</Text>
              <Text className="text-2xl font-bold text-apple-ink" style={{ letterSpacing: -0.4 }}>
                {mod.part.name}
              </Text>
            </Pressable>
          ) : (
            <Text className="mt-3 text-2xl font-bold text-apple-ink" style={{ letterSpacing: -0.4 }}>
              {partLabel}
            </Text>
          )}

          <Pressable
            onPress={() => router.push(`/vehicle/${vehicle.id}`)}
            className="mt-2 active:opacity-80"
          >
            <Text className="text-sm text-apple-secondary">
              {vehicleTitle}
              {vehicle.year ? ` · ${vehicle.year}` : ''}
            </Text>
          </Pressable>

          <AppleCard style={{ padding: 16, marginTop: 16 }}>
            <View className="flex-row flex-wrap gap-6">
              <View>
                <Text className="text-xs text-apple-secondary">Installed</Text>
                <Text className="mt-0.5 text-[15px] font-semibold text-apple-ink">
                  {formatDate(mod.install_date)}
                  {mod.date_is_approximate ? ' (approx.)' : ''}
                </Text>
              </View>
              <View>
                <Text className="text-xs text-apple-secondary">By</Text>
                <Text className="mt-0.5 text-[15px] font-semibold capitalize text-apple-ink">
                  {labelForInstaller(mod.installer_type)}
                </Text>
              </View>
              {mod.cost != null ? (
                <View>
                  <Text className="text-xs text-apple-secondary">Cost</Text>
                  <MoneyText
                    value={Number(mod.cost)}
                    size={18}
                    weight="700"
                    color={colors.accent}
                  />
                  {mod.cost_is_approximate ? (
                    <Text className="text-[11px] text-apple-secondary">approx.</Text>
                  ) : null}
                </View>
              ) : null}
            </View>
            <Text className="mt-3 text-xs capitalize text-apple-secondary">
              Privacy · {mod.privacy.replace(/_/g, ' ')}
            </Text>
          </AppleCard>

          {mod.notes ? (
            <AppleCard style={{ padding: 16, marginTop: 12 }}>
              <Text className="text-xs font-semibold uppercase tracking-wider text-apple-secondary">
                Notes
              </Text>
              <Text className="mt-2 text-[15px] leading-[22px] text-apple-ink">{mod.notes}</Text>
            </AppleCard>
          ) : null}

          <View className="mt-4 flex-row flex-wrap gap-2">
            <Pressable
              onPress={() => navigateToModProduct(router, { id: mod.id, part: mod.part })}
              className="flex-row items-center gap-2 rounded-xl border border-apple-border bg-white px-4 py-3 active:opacity-80"
            >
              <Ionicons name="pricetag-outline" size={18} color={colors.accent} />
              <Text className="font-semibold text-accent">View product</Text>
            </Pressable>
            {isOwner && mod.has_receipt ? (
              <Pressable
                onPress={() => void handleViewReceipt()}
                className="flex-row items-center gap-2 rounded-xl border border-apple-border bg-white px-4 py-3 active:opacity-80"
              >
                <Ionicons name="document-text-outline" size={18} color={colors.secondary} />
                <Text className="font-semibold text-apple-secondary">Receipt</Text>
              </Pressable>
            ) : null}
          </View>

          <ModProductLinksDisplay links={productLinks} modId={mod.id} />
          <ModToolsDisplay tools={tools} />

          {isOwner ? (
            <Pressable
              onPress={() => router.push(`/log/edit?modId=${mod.id}`)}
              className="mt-6 rounded-xl bg-accent py-3.5 active:opacity-90"
            >
              <Text className="text-center text-[16px] font-semibold text-white">Edit mod</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function labelForInstaller(t: string) {
  return t.replace(/_/g, ' ');
}
