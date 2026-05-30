import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth-context';
import {
  getViewerCoordinates,
  listNearbyBuilds,
  nearbyDistanceLabel,
  syncViewerLocationCoords,
  type NearbyBuild,
} from '@/lib/nearby-builds';
import { colors } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';
export default function ExploreNearbyScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [builds, setBuilds] = useState<NearbyBuild[]>([]);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const viewer = await getViewerCoordinates();
      setLocationEnabled(viewer != null);
      if (viewer && session?.user.id) {
        await syncViewerLocationCoords(session.user.id, viewer).catch(() => {});
      }
      const list = await listNearbyBuilds(viewer, {
        excludeUserId: session?.user.id ?? null,
        limit: 40,
      });
      setBuilds(list);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.user.id]);

  useFocusData(
    ({ isInitial }) => {
      if (isInitial && builds.length === 0) setLoading(true);
      return load();
    },
    [load]
  );

  return (
    <View className="flex-1 bg-apple-bg2">
      <ScrollView
        contentContainerClassName="pb-24 pt-2"
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
        {loading && builds.length === 0 ? (
          <View className="items-center py-16">
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : builds.length === 0 ? (
          <View className="mx-4 mt-8 rounded-[18px] border border-apple-border bg-apple-surface p-6">
            <Text className="text-base font-semibold text-apple-ink">No public builds yet</Text>
            <Text className="mt-2 text-sm text-apple-secondary">
              When builders make their vehicles public and add a location on their profile,
              they will show up here sorted by distance.
            </Text>
            <Pressable onPress={() => router.back()} className="mt-4">
              <Text className="font-semibold text-signal-blue">Back to Explore</Text>
            </Pressable>
          </View>
        ) : (
          <View className="gap-4">
            <Text className="px-4 text-sm text-apple-secondary">
              Public builds from the community{locationEnabled ? ', sorted by distance' : ''}.
            </Text>
            <View className="px-4">
              {builds.map((b, i) => (
                <View key={b.id} className="mb-3">
                  <NearYouCardListRow build={b} tintIndex={i} />
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/** Full-width row variant for the See-all screen. */
const PLACEHOLDER_TINTS = ['#D6E8FF', '#DDF5E4', '#FFF4D6'];

function NearYouCardListRow({
  build,
  tintIndex,
}: {
  build: NearbyBuild;
  tintIndex: number;
}) {
  const router = useRouter();
  const distance = nearbyDistanceLabel(build.distance_km);
  const tint = PLACEHOLDER_TINTS[tintIndex % PLACEHOLDER_TINTS.length];

  return (
    <Pressable
      onPress={() => router.push(`/build/${build.id}`)}
      className="flex-row items-center gap-3 rounded-[16px] border border-apple-border bg-apple-surface p-3 active:opacity-90"
    >
      <View
        className="h-16 w-16 items-center justify-center rounded-xl"
        style={{ backgroundColor: tint }}
      >
        <Ionicons name="car-sport-outline" size={28} color={colors.tertiary} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-base font-bold text-apple-ink">{build.title}</Text>
        <Text className="text-sm text-apple-secondary">@{build.owner_handle}</Text>
        <View className="mt-1 flex-row justify-between">
          <Text className="text-xs text-apple-tertiary">{distance ?? '—'}</Text>
          <Text className="text-sm font-bold text-signal-blue">{build.price_label}</Text>
        </View>
      </View>
    </Pressable>
  );
}
