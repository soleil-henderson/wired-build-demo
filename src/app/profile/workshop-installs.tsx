import { Stack, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useSubscriptionTier } from '@/hooks/use-subscription-tier';
import { useAuth } from '@/lib/auth-context';
import { canManageWorkshopProfile } from '@/lib/subscription';
import {
  listWorkshopPendingInstalls,
  workshopVerifyMod,
  type WorkshopPendingMod,
} from '@/lib/workshops';
import { useFocusData } from '@/lib/use-focus-data';

export default function WorkshopInstallsScreen() {
  const { session } = useAuth();
  const { tier, loading: tierLoading } = useSubscriptionTier();
  const router = useRouter();
  const [mods, setMods] = useState<WorkshopPendingMod[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const allowed = canManageWorkshopProfile(tier);

  const load = useCallback(async () => {
    if (!session || !allowed) {
      setMods([]);
      setLoading(false);
      return;
    }
    try {
      const rows = await listWorkshopPendingInstalls(session.user.id);
      setMods(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load installs';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, [session, allowed]);

  useFocusData(
    ({ isInitial }) => {
      if (isInitial && mods.length === 0) setLoading(true);
      return load();
    },
    [load]
  );

  async function handleVerify(modId: string) {
    if (!canManageWorkshopProfile(tier)) return;
    setVerifyingId(modId);
    try {
      await workshopVerifyMod(modId);
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not verify';
      Alert.alert('Verify failed', message);
    } finally {
      setVerifyingId(null);
    }
  }

  if (!tierLoading && !allowed) {
    return (
      <ScrollView className="flex-1 bg-apple-bg2" contentContainerClassName="pb-12">
        <Stack.Screen options={{ title: 'Workshop installs' }} />
        <ScreenHeader subtitle="Verify mods tagged to your business." />
        <View className="mx-6 mt-8 gap-4">
          <Text className="text-apple-secondary">
            Install verification is included with the Workshop plan ($50/mo).
          </Text>
          <Pressable
            onPress={() => router.push('/profile/subscription')}
            className="self-start rounded-xl bg-accent px-4 py-2.5"
          >
            <Text className="font-semibold text-white">View plans</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1 bg-apple-bg2" contentContainerClassName="pb-12">
      <Stack.Screen options={{ title: 'Workshop installs' }} />
      <ScreenHeader subtitle="Mods customers tagged to your workshop — verify when the work is done." />
      {loading && mods.length === 0 ? (
        <ActivityIndicator color="#FF6A2B" className="mt-8" />
      ) : mods.length === 0 ? (
        <Text className="mx-6 mt-6 text-apple-secondary">
          No installs are tagged to your workshop yet. Customers tag you when logging a mod.
        </Text>
      ) : (
        <View className="mx-6 mt-6 gap-3">
          {mods.map((m) => (
            <View
              key={m.id}
              className="rounded-xl border border-apple-border bg-white p-4"
            >
              <Text className="font-semibold text-apple-ink">
                {m.custom_part_name ?? m.category}
              </Text>
              <Text className="mt-1 text-sm text-apple-secondary">
                {m.install_date ?? 'Date unknown'}
              </Text>
              <View className="mt-3 flex-row items-center justify-between">
                {m.is_verified_by_workshop ? (
                  <Text className="text-sm font-semibold text-signal-green">Verified</Text>
                ) : (
                  <Pressable
                    onPress={() => void handleVerify(m.id)}
                    disabled={verifyingId === m.id}
                    className="rounded-lg bg-accent px-3 py-1.5 disabled:opacity-60"
                  >
                    {verifyingId === m.id ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text className="text-sm font-semibold text-white">Verify install</Text>
                    )}
                  </Pressable>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
