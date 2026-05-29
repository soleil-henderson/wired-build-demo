import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

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
      <View className="flex-1 items-center justify-center bg-ink-950">
        <ActivityIndicator color="#F5A524" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-ink-950" contentContainerClassName="px-6 pb-12">
      <Stack.Screen options={{ title: 'Build plan' }} />
      <Text className="mt-4 text-ink-300">
        Structured plan items beyond the wishlist. Promote to a mod from the wishlist flow
        or log directly when installed.
      </Text>

      <View className="mt-6 gap-2">
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. 2 inch lift kit"
          placeholderTextColor="#5A6373"
          className="rounded-xl bg-ink-800 px-4 py-3 text-white"
        />
        <TextInput
          value={targetCost}
          onChangeText={setTargetCost}
          placeholder="Target cost (optional)"
          placeholderTextColor="#5A6373"
          keyboardType="decimal-pad"
          className="rounded-xl bg-ink-800 px-4 py-3 text-white"
        />
        <Pressable
          onPress={handleAdd}
          disabled={saving || !title.trim()}
          className="rounded-xl bg-accent py-3 disabled:opacity-60"
        >
          <Text className="text-center font-semibold text-ink-950">Add to plan</Text>
        </Pressable>
      </View>

      <View className="mt-8 gap-3">
        {items.length === 0 ? (
          <Text className="text-ink-300">No plan items yet.</Text>
        ) : (
          items.map((item) => (
            <View
              key={item.id}
              className="flex-row items-center justify-between rounded-2xl border border-ink-700 bg-ink-900 p-4"
            >
              <View className="flex-1 pr-3">
                <Text className="font-semibold text-white">{item.title}</Text>
                {item.target_cost != null ? (
                  <Text className="mt-1 text-sm text-ink-300">
                    Target ${Number(item.target_cost).toLocaleString()}
                  </Text>
                ) : null}
                {item.completed_at ? (
                  <Text className="mt-1 text-xs text-cyan-400">Completed</Text>
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
    </ScrollView>
  );
}
