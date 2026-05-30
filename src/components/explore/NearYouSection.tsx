import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';

import { AppleCard } from '@/components/apple/AppleCard';
import { nearbyDistanceLabel, type NearbyBuild } from '@/lib/nearby-builds';
import { colors } from '@/lib/theme';

const CARD_WIDTH = 156;
const PLACEHOLDER_TINTS = ['#D6E8FF', '#DDF5E4', '#FFF4D6'];

type Props = {
  builds: NearbyBuild[];
  locationEnabled: boolean;
};

export function NearYouSection({ builds, locationEnabled }: Props) {
  const router = useRouter();

  if (builds.length === 0) return null;

  return (
    <View>
      <View className="mb-3 flex-row items-center justify-between px-4">
        <View className="flex-row items-center gap-2">
          <Text
            className="text-[22px] font-bold text-apple-ink"
            style={{ letterSpacing: -0.44 }}
          >
            Near you
          </Text>
          <Ionicons name="location" size={20} color="#FF3B30" />
        </View>
        <Pressable onPress={() => router.push('/explore/nearby')} hitSlop={8}>
          <Text className="text-[15px] font-semibold text-signal-blue">See all</Text>
        </Pressable>
      </View>

      {!locationEnabled ? (
        <Text className="mb-2 px-4 text-[13px] text-apple-secondary">
          Enable location to sort builds by distance. Showing public builds nearby.
        </Text>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 4 }}
      >
        {builds.map((b, i) => (
          <NearYouCard key={b.id} build={b} tintIndex={i} />
        ))}
      </ScrollView>
    </View>
  );
}

function NearYouCard({ build, tintIndex }: { build: NearbyBuild; tintIndex: number }) {
  const router = useRouter();
  const tint = PLACEHOLDER_TINTS[tintIndex % PLACEHOLDER_TINTS.length];
  const distance = nearbyDistanceLabel(build.distance_km);

  return (
    <Pressable
      onPress={() => router.push(`/build/${build.id}`)}
      style={{ width: CARD_WIDTH }}
      className="active:opacity-90"
    >
      <AppleCard style={{ padding: 0, overflow: 'hidden' }}>
        {build.cover_photo_url ? (
          <Image
            source={{ uri: build.cover_photo_url }}
            style={{ width: '100%', height: 100, backgroundColor: colors.bg2 }}
            resizeMode="cover"
          />
        ) : (
          <View
            style={{
              height: 100,
              backgroundColor: tint,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="car-sport-outline" size={44} color={colors.tertiary} />
          </View>
        )}
        <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 }}>
          <Text
            className="text-[15px] font-bold text-apple-ink"
            numberOfLines={1}
            style={{ letterSpacing: -0.2 }}
          >
            {build.title}
          </Text>
          <Text className="mt-0.5 text-[13px] text-apple-secondary" numberOfLines={1}>
            @{build.owner_handle}
          </Text>
          <View className="mt-2.5 flex-row items-center justify-between">
            <Text className="text-[12px] text-apple-tertiary">
              {distance ?? '—'}
            </Text>
            <Text
              style={{
                fontSize: 15,
                fontWeight: '700',
                color: '#007AFF',
                letterSpacing: -0.2,
              }}
            >
              {build.price_label}
            </Text>
          </View>
        </View>
      </AppleCard>
    </Pressable>
  );
}
