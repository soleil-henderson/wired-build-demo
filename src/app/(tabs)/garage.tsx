import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppleCard } from '@/components/apple/AppleCard';
import { AppleHeader } from '@/components/apple/AppleHeader';
import { VehicleThumb } from '@/components/apple/ApplePrimitives';
import { useAuth } from '@/lib/auth-context';
import { colors } from '@/lib/theme';
import { listUserVehicles, type VehicleSummary } from '@/lib/users';

export default function GarageScreen() {
  const { session, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (authLoading || !session) {
      if (!authLoading) {
        setLoading(false);
        setRefreshing(false);
      }
      return;
    }

    try {
      const list = await listUserVehicles(session.user.id);
      setVehicles(list);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load garage';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session, authLoading]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-apple-bg2" edges={['top']}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-apple-bg2" edges={['top']}>
      <AppleHeader title="Garage" />
      <ScrollView
        contentContainerClassName="px-4 pb-28 pt-2"
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
        {vehicles.length === 0 ? (
          <AppleCard padded style={{ marginTop: 8 }}>
            <Text className="text-base font-semibold text-apple-ink">No vehicles yet</Text>
            <Text className="mt-1 text-apple-secondary">
              Add your 4WD to start planning mods and tracking spend.
            </Text>
            <Pressable
              onPress={() => router.push('/garage/add-vehicle')}
              className="mt-4 self-start rounded-[14px] bg-accent px-4 py-3 active:opacity-90"
            >
              <Text className="font-semibold text-white">Add your vehicle</Text>
            </Pressable>
          </AppleCard>
        ) : (
          <View className="gap-3">
            {vehicles.map((v) => (
              <VehicleListCard
                key={v.id}
                vehicle={v}
                onPress={() => router.push(`/vehicle/${v.id}`)}
              />
            ))}

            <Pressable
              onPress={() => router.push('/garage/add-vehicle')}
              className="mt-2 active:opacity-80"
            >
              <AppleCard
                style={{
                  padding: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  borderStyle: 'dashed',
                }}
              >
                <View
                  className="h-11 w-11 items-center justify-center rounded-xl"
                  style={{ backgroundColor: colors.accentSoft }}
                >
                  <Ionicons name="add" size={24} color={colors.accent} />
                </View>
                <Text className="text-[15px] font-semibold text-accent">Add another vehicle</Text>
              </AppleCard>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function VehicleListCard({
  vehicle,
  onPress,
}: {
  vehicle: VehicleSummary;
  onPress: () => void;
}) {
  const title =
    vehicle.nickname ?? `${vehicle.year} ${vehicle.make} ${vehicle.model}`;

  return (
    <Pressable onPress={onPress} className="active:opacity-90">
      <AppleCard style={{ padding: 0, overflow: 'hidden' }}>
        {vehicle.cover_photo_url ? (
          <Image
            source={{ uri: vehicle.cover_photo_url }}
            className="aspect-[16/9] w-full bg-apple-bg2"
            resizeMode="cover"
          />
        ) : (
          <View
            className="aspect-[16/9] w-full items-center justify-center"
            style={{ backgroundColor: `${colors.accent}10` }}
          >
            <Ionicons name="car-sport-outline" size={48} color={colors.accent} />
          </View>
        )}
        <View className="flex-row items-center gap-3 p-4">
          <VehicleThumb size={48} color={colors.accent} />
          <View className="min-w-0 flex-1">
            <Text className="text-[17px] font-semibold text-apple-ink" numberOfLines={1}>
              {title}
            </Text>
            <Text className="text-[13px] text-apple-secondary">
              {vehicle.year} {vehicle.make} {vehicle.model}
              {vehicle.trim ? ` · ${vehicle.trim}` : ''}
            </Text>
            <Text className="mt-1 text-[13px] text-apple-secondary">
              {vehicle.mod_count} mod{vehicle.mod_count === 1 ? '' : 's'} · $
              {(Number(vehicle.total_spend) / 1000).toFixed(1)}k invested
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.tertiary} />
        </View>
      </AppleCard>
    </Pressable>
  );
}
