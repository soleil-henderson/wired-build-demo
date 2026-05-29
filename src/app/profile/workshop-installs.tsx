import { Stack, useFocusEffect } from 'expo-router';
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
import { useAuth } from '@/lib/auth-context';
import {
  listWorkshopPendingInstalls,
  workshopVerifyMod,
  type WorkshopPendingMod,
} from '@/lib/workshops';

export default function WorkshopInstallsScreen() {
  const { session } = useAuth();
  const [mods, setMods] = useState<WorkshopPendingMod[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const rows = await listWorkshopPendingInstalls(session.user.id);
      setMods(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load installs';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleVerify(modId: string) {
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

  return (
    <ScrollView className="flex-1 bg-apple-bg2" contentContainerClassName="pb-12">
      <Stack.Screen options={{ title: 'Workshop installs' }} />
      <ScreenHeader
        eyebrow="WORKSHOP"
        title="Tagged installs"
        subtitle="Confirm mods your shop installed to show the verified badge."
      />

      {loading ? (
        <ActivityIndicator className="mt-8" color="#FF6A2B" />
      ) : mods.length === 0 ? (
        <Text className="mx-6 mt-6 text-apple-secondary">
          No installs are tagged to your workshop yet. Customers tag you when logging a mod.
        </Text>
      ) : (
        <View className="mx-6 mt-6 gap-3">
          {mods.map((m) => {
            const label = m.vehicle
              ? m.vehicle.nickname ??
                `${m.vehicle.year} ${m.vehicle.make} ${m.vehicle.model}`
              : 'Vehicle';
            return (
              <View
                key={m.id}
                className="rounded-2xl border border-apple-border bg-white p-4"
              >
                <Text className="font-semibold text-apple-ink">{label}</Text>
                <Text className="mt-1 text-sm text-apple-secondary">
                  {m.custom_part_name ?? m.category} · {m.install_date}
                </Text>
                {m.is_verified_by_workshop ? (
                  <Text className="mt-3 text-sm font-semibold text-signal-green">
                    Verified install
                  </Text>
                ) : (
                  <Pressable
                    onPress={() => handleVerify(m.id)}
                    disabled={verifyingId === m.id}
                    className="mt-3 self-start rounded-xl bg-accent px-4 py-2.5 active:bg-accent-dark"
                  >
                    <Text className="font-semibold text-white">
                      {verifyingId === m.id ? 'Confirming…' : 'Confirm install'}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
