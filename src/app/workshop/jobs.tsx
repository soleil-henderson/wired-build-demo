import { Stack } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useAuth } from '@/lib/auth-context';
import { workshopVerifyMod } from '@/lib/workshops';
import {
  listWorkshopCustomerJobs,
  type WorkshopCustomerJob,
} from '@/lib/workshop-jobs';
import { canManageWorkshopProfile } from '@/lib/subscription';
import { useSubscriptionTier } from '@/hooks/use-subscription-tier';
import { colors } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

export default function WorkshopJobsScreen() {
  const { session } = useAuth();
  const { tier } = useSubscriptionTier();
  const [jobs, setJobs] = useState<WorkshopCustomerJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const rows = await listWorkshopCustomerJobs(session.user.id);
      setJobs(rows);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useFocusData(
    ({ isInitial }) => {
      if (isInitial && jobs.length === 0) setLoading(true);
      return load();
    },
    [load]
  );

  async function handleVerify(modId: string) {
    if (!canManageWorkshopProfile(tier)) {
      Alert.alert('Workshop plan required', 'Upgrade to verify customer installs.');
      return;
    }
    setVerifyingId(modId);
    try {
      await workshopVerifyMod(modId);
      await load();
    } catch (err) {
      Alert.alert('Verify failed', err instanceof Error ? err.message : 'Could not verify');
    } finally {
      setVerifyingId(null);
    }
  }

  return (
    <ScrollView className="flex-1 bg-apple-bg2" contentContainerClassName="pb-12">
      <Stack.Screen options={{ title: 'Customer jobs' }} />
      <ScreenHeader subtitle="Vehicles your customers tagged you on — owner details stay private." />
      {loading && jobs.length === 0 ? (
        <ActivityIndicator color={colors.accent} className="mt-8" />
      ) : jobs.length === 0 ? (
        <Text className="mx-6 mt-6 text-apple-secondary">
          No customer jobs yet. Builders tag your workshop when they log a mod.
        </Text>
      ) : (
        <View className="mx-6 mt-4 gap-4">
          {jobs.map((job) => (
            <View key={job.vehicle_id} className="rounded-2xl border border-apple-border bg-white p-4">
              <Text className="text-lg font-semibold text-apple-ink">
                {job.year} {job.make} {job.model}
                {job.nickname ? ` · ${job.nickname}` : ''}
              </Text>
              <Text className="mt-1 text-sm text-apple-secondary">
                {job.mod_count} install{job.mod_count === 1 ? '' : 's'} · {job.verified_count} verified
              </Text>
              <View className="mt-3 gap-2">
                {job.mods.map((mod) => (
                  <View
                    key={mod.id}
                    className="flex-row items-center justify-between rounded-xl bg-apple-bg2 px-3 py-2"
                  >
                    <View className="min-w-0 flex-1">
                      <Text className="font-medium text-apple-ink">
                        {mod.custom_part_name ?? mod.category}
                      </Text>
                      <Text className="text-xs text-apple-secondary">{mod.install_date}</Text>
                    </View>
                    {mod.is_verified_by_workshop ? (
                      <Text className="text-xs font-semibold text-signal-green">Verified</Text>
                    ) : (
                      <Pressable
                        onPress={() => void handleVerify(mod.id)}
                        disabled={verifyingId === mod.id}
                        className="rounded-lg bg-accent px-2 py-1 disabled:opacity-60"
                      >
                        {verifyingId === mod.id ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text className="text-xs font-semibold text-white">Verify</Text>
                        )}
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
