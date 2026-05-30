import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { KeyboardSafeScrollView } from '@/components/ui/KeyboardSafeView';

import { useAuth } from '@/lib/auth-context';
import { addPlanItem, deletePlanItem, listPlanItems, type PlanItem } from '@/lib/plan-items';

export default function BuildPlanScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [items, setItems] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [targetCost, setTargetCost] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!vehicleId) return;
    try {
      const list = await listPlanItems(vehicleId);
      setItems(list);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load plan';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd() {
    if (!session || !vehicleId || !title.trim()) return;
    setSaving(true);
    try {
      const cost = targetCost.trim()
        ? Number(targetCost.replace(/[^0-9.]/g, ''))
        : null;
      await addPlanItem({
        vehicleId,
        userId: session.user.id,
        title,
        targetCost: Number.isNaN(cost) ? null : cost,
      });
      setTitle('');
      setTargetCost('');
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not add item';
      Alert.alert('Error', message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-apple-bg2">
        <ActivityIndicator color="#FF6A2B" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Build plan' }} />
      <KeyboardSafeScrollView className="flex-1 bg-apple-bg2" contentContainerClassName="px-6">
      <Text className="mt-4 text-apple-secondary">
        Structured plan items beyond the wishlist. Promote to a mod from the wishlist flow
        or log directly when installed.
      </Text>

      <View className="mt-6 gap-2">
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. 2 inch lift kit"
          placeholderTextColor="#A1A1A6"
          className="rounded-xl border border-apple-border bg-white px-4 py-3 text-apple-ink"
        />
        <TextInput
          value={targetCost}
          onChangeText={setTargetCost}
          placeholder="Target cost (optional)"
          placeholderTextColor="#A1A1A6"
          keyboardType="decimal-pad"
          className="rounded-xl border border-apple-border bg-white px-4 py-3 text-apple-ink"
        />
        <Pressable
          onPress={handleAdd}
          disabled={saving || !title.trim()}
          className="rounded-xl bg-accent py-3 disabled:opacity-60"
        >
          <Text className="text-center font-semibold text-white">Add to plan</Text>
        </Pressable>
      </View>

      <View className="mt-8 gap-3">
        {items.length === 0 ? (
          <Text className="text-apple-secondary">No plan items yet.</Text>
        ) : (
          items.map((item) => (
            <View
              key={item.id}
              className="flex-row items-center justify-between rounded-2xl border border-apple-border bg-white p-4"
            >
              <View className="flex-1 pr-3">
                <Text className="font-semibold text-apple-ink">{item.title}</Text>
                {item.target_cost != null ? (
                  <Text className="mt-1 text-sm text-apple-secondary">
                    Target ${Number(item.target_cost).toLocaleString()}
                  </Text>
                ) : null}
                {item.completed_at ? (
                  <Text className="mt-1 text-xs text-signal-green">Completed</Text>
                ) : null}
              </View>
              {!item.completed_at ? (
                <Pressable
                  onPress={() =>
                    router.push(
                      `/log/new?vehicleId=${vehicleId}&planItemId=${item.id}`
                    )
                  }
                  className="mr-3"
                >
                  <Text className="text-accent">Log mod</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => {
                  Alert.alert('Remove item?', item.title, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Remove',
                      style: 'destructive',
                      onPress: async () => {
                        await deletePlanItem(item.id);
                        await load();
                      },
                    },
                  ]);
                }}
              >
                <Text className="text-signal-red">Remove</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>
      </KeyboardSafeScrollView>
    </>
  );
}
