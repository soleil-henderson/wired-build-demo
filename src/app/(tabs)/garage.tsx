import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
import { VehicleGarageCard } from '@/components/garage/VehicleGarageCard';
import { useAuth } from '@/lib/auth-context';
import { listGarageVehicleCards, type GarageVehicleCard } from '@/lib/garage-cards';
import { getMyProfile } from '@/lib/profile';
import { listWorkshopCustomerJobs, type WorkshopCustomerJob } from '@/lib/workshop-jobs';
import { isWorkshopAccount } from '@/lib/account-routing';
import { TAB_SCROLL_BOTTOM_INSET } from '@/lib/tab-screen-layout';
import { colors } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';
import { listUserWishlist } from '@/lib/wishlist';

export default function GarageScreen() {
  const { session, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [vehicles, setVehicles] = useState<GarageVehicleCard[]>([]);
  const [workshopJobs, setWorkshopJobs] = useState<WorkshopCustomerJob[]>([]);
  const [isWorkshop, setIsWorkshop] = useState(false);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [wishlistPlanned, setWishlistPlanned] = useState(0);
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
      const profile = await getMyProfile(session.user.id);
      const workshop = isWorkshopAccount(profile);
      setIsWorkshop(workshop);

      const [list, wishlist] = await Promise.all([
        listGarageVehicleCards(session.user.id),
        listUserWishlist(session.user.id).catch(() => []),
      ]);
      setVehicles(list);
      setWishlistCount(wishlist.length);
      setWishlistPlanned(
        wishlist.reduce((sum, item) => sum + Number(item.target_cost ?? 0), 0)
      );

      if (workshop) {
        const jobs = await listWorkshopCustomerJobs(session.user.id);
        setWorkshopJobs(jobs);
      } else {
        setWorkshopJobs([]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load garage';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session, authLoading]);

  useFocusData(
    async ({ isInitial }) => {
      if (isInitial && vehicles.length === 0) setLoading(true);
      await load();
    },
    [load]
  );

  if (loading && vehicles.length === 0 && workshopJobs.length === 0) {
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
        contentContainerClassName="px-4 pt-2"
        contentContainerStyle={{ paddingBottom: TAB_SCROLL_BOTTOM_INSET }}
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
        {isWorkshop && workshopJobs.length > 0 ? (
          <View className="mb-6">
            <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-apple-secondary">
              Customer jobs
            </Text>
            <View className="gap-3">
              {workshopJobs.slice(0, 3).map((job) => (
                <AppleCard key={job.vehicle_id} padded>
                  <Text className="text-base font-semibold text-apple-ink">
                    {job.year} {job.make} {job.model}
                  </Text>
                  <Text className="mt-1 text-sm text-apple-secondary">
                    {job.mod_count} install{job.mod_count === 1 ? '' : 's'} · {job.verified_count}{' '}
                    verified
                  </Text>
                </AppleCard>
              ))}
              <Pressable onPress={() => router.push('/workshop/jobs')}>
                <Text className="text-center text-sm font-semibold text-accent">
                  View all customer jobs →
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {isWorkshop ? (
          <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-apple-secondary">
            Your vehicles
          </Text>
        ) : null}

        <WishlistSummaryCard
          count={wishlistCount}
          plannedTotal={wishlistPlanned}
          onPress={() => router.push('/wishlist')}
        />

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
          <View className="gap-4">
            {vehicles.map((v) => (
              <VehicleGarageCard key={v.id} vehicle={v} />
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

function WishlistSummaryCard({
  count,
  plannedTotal,
  onPress,
}: {
  count: number;
  plannedTotal: number;
  onPress: () => void;
}) {
  const subtitle =
    count === 0
      ? 'Save parts from Explore or product pages'
      : plannedTotal > 0
        ? `${count} item${count === 1 ? '' : 's'} · $${Math.round(plannedTotal).toLocaleString()} planned`
        : `${count} saved item${count === 1 ? '' : 's'} across your builds`;

  return (
    <Pressable onPress={onPress} className="mb-3 active:opacity-90">
      <AppleCard
        style={{
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: colors.accentSoft,
        }}
      >
        <View
          className="h-11 w-11 items-center justify-center rounded-xl bg-white"
        >
          <Ionicons name="bookmark-outline" size={22} color={colors.accent} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[15px] font-semibold text-apple-ink">Saved parts</Text>
          <Text className="mt-0.5 text-[13px] text-apple-secondary">{subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.tertiary} />
      </AppleCard>
    </Pressable>
  );
}

