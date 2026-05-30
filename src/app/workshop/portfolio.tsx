import { Stack } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useAuth } from '@/lib/auth-context';
import {
  createPortfolioItem,
  deletePortfolioItem,
  listWorkshopPortfolio,
  type WorkshopPortfolioItem,
} from '@/lib/workshop-portfolio';
import { colors } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';

export default function WorkshopPortfolioManageScreen() {
  const { session } = useAuth();
  const [items, setItems] = useState<WorkshopPortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [vehicleLabel, setVehicleLabel] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const rows = await listWorkshopPortfolio(session.user.id, { includeUnpublished: true });
    setItems(rows);
    setLoading(false);
  }, [session]);

  useFocusData(
    ({ isInitial }) => {
      if (isInitial && items.length === 0) setLoading(true);
      return load();
    },
    [load]
  );

  async function handleAdd() {
    if (!session || !title.trim()) {
      Alert.alert('Title required', 'Add a title for this portfolio item.');
      return;
    }
    setSaving(true);
    try {
      await createPortfolioItem(session.user.id, {
        title: title.trim(),
        vehicle_label: vehicleLabel.trim() || null,
        description: description.trim() || null,
      });
      setTitle('');
      setVehicleLabel('');
      setDescription('');
      await load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not add');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-apple-bg2" contentContainerClassName="pb-12">
      <Stack.Screen options={{ title: 'Portfolio' }} />
      <ScreenHeader subtitle="Showcase jobs on your public profile. Add photos from Settings later." />

      <View className="mx-6 mt-4 rounded-2xl border border-apple-border bg-white p-4">
        <Text className="mb-2 text-xs uppercase tracking-wider text-apple-secondary">New item</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Bull bar + winch install"
          placeholderTextColor="#A1A1A6"
          className="mb-2 rounded-xl border border-apple-border px-3 py-2 text-base text-apple-ink"
        />
        <TextInput
          value={vehicleLabel}
          onChangeText={setVehicleLabel}
          placeholder="2022 Ford Ranger (optional)"
          placeholderTextColor="#A1A1A6"
          className="mb-2 rounded-xl border border-apple-border px-3 py-2 text-base text-apple-ink"
        />
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Short description"
          placeholderTextColor="#A1A1A6"
          multiline
          className="mb-3 min-h-[72px] rounded-xl border border-apple-border px-3 py-2 text-base text-apple-ink"
        />
        <Pressable
          onPress={() => void handleAdd()}
          disabled={saving}
          className="rounded-xl bg-accent py-2.5 disabled:opacity-60"
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-center font-semibold text-white">Add to portfolio</Text>
          )}
        </Pressable>
      </View>

      {loading && items.length === 0 ? (
        <ActivityIndicator color={colors.accent} className="mt-8" />
      ) : (
        <View className="mx-6 mt-6 gap-3">
          {items.map((item) => (
            <View key={item.id} className="overflow-hidden rounded-2xl border border-apple-border bg-white">
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} className="h-40 w-full" resizeMode="cover" />
              ) : (
                <View className="h-24 items-center justify-center bg-apple-bg2">
                  <Text className="text-apple-tertiary">No photo</Text>
                </View>
              )}
              <View className="p-4">
                <Text className="font-semibold text-apple-ink">{item.title}</Text>
                {item.vehicle_label ? (
                  <Text className="text-sm text-apple-secondary">{item.vehicle_label}</Text>
                ) : null}
                <Pressable
                  onPress={() => {
                    if (!session) return;
                    Alert.alert('Remove item?', item.title, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: async () => {
                          await deletePortfolioItem(item.id, session.user.id);
                          load();
                        },
                      },
                    ]);
                  }}
                  className="mt-2 self-start"
                >
                  <Text className="text-sm font-semibold text-signal-red">Remove</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
