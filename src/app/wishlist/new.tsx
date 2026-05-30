import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { KeyboardSafeScrollView } from '@/components/ui/KeyboardSafeView';

import { useAuth } from '@/lib/auth-context';
import { searchParts, type Part } from '@/lib/parts';
import { addWishlistItem } from '@/lib/wishlist';
import type { ModCategory, WishlistPriority } from '@/types/database';

const CATEGORIES: { value: ModCategory; label: string }[] = [
  { value: 'suspension', label: 'Suspension' },
  { value: 'wheels_tyres', label: 'Wheels & tyres' },
  { value: 'recovery', label: 'Recovery' },
  { value: 'body', label: 'Body' },
  { value: 'lighting', label: 'Lighting' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'drivetrain', label: 'Drivetrain' },
  { value: 'camping', label: 'Camping' },
  { value: 'interior', label: 'Interior' },
  { value: 'other', label: 'Other' },
];

const PRIORITIES: { value: WishlistPriority; label: string; hint: string }[] = [
  { value: 'low', label: 'Low', hint: 'Someday' },
  { value: 'medium', label: 'Medium', hint: 'Next few months' },
  { value: 'high', label: 'High', hint: 'Saving up now' },
];

export default function WishlistNewScreen() {
  const router = useRouter();
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const { session } = useAuth();

  const [partQuery, setPartQuery] = useState('');
  const [partResults, setPartResults] = useState<Part[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [customName, setCustomName] = useState('');
  const [customMode, setCustomMode] = useState(false);

  const [category, setCategory] = useState<ModCategory>('suspension');
  const [targetCost, setTargetCost] = useState('');
  const [priority, setPriority] = useState<WishlistPriority>('medium');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);

  // Debounced live search.
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (selectedPart || customMode) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (partQuery.trim().length < 2) {
      setPartResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await searchParts(partQuery, 6);
        setPartResults(results);
      } catch {
        setPartResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [partQuery, selectedPart, customMode]);

  async function handleSubmit() {
    if (!session) return;
    if (!selectedPart && !customName.trim()) {
      Alert.alert(
        'Need a part',
        'Pick something from the catalogue or switch on custom and name it.'
      );
      return;
    }
    const parsedCost = targetCost.trim() ? Number(targetCost) : null;
    if (parsedCost !== null && (Number.isNaN(parsedCost) || parsedCost < 0)) {
      Alert.alert('Bad cost', 'Target cost has to be a positive number, or leave it blank.');
      return;
    }

    setSubmitting(true);
    try {
      await addWishlistItem({
        userId: session.user.id,
        vehicleId: vehicleId ?? null,
        partId: selectedPart?.id ?? null,
        customPartName: selectedPart ? null : customName,
        category,
        targetCost: parsedCost,
        notes: notes.trim() || null,
        priority,
      });
      router.back();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save wishlist item';
      Alert.alert('Save failed', message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Add to wishlist' }} />
      <KeyboardSafeScrollView className="flex-1 bg-apple-bg2" contentContainerClassName="px-5 pt-5">
        {/* Part picker */}
        <Section title="Part">
          {selectedPart ? (
            <View className="flex-row items-start gap-3 rounded-2xl border border-accent/60 bg-white p-3">
              <View className="flex-1">
                <Text className="text-[11px] uppercase tracking-wider text-accent">
                  {selectedPart.category.replace('_', ' ')}
                </Text>
                <Text className="mt-1 font-semibold text-apple-ink">
                  {selectedPart.brand} {selectedPart.name}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setSelectedPart(null);
                  setPartQuery('');
                }}
                className="rounded-lg border border-apple-border px-3 py-1.5"
              >
                <Text className="text-xs text-apple-secondary">Change</Text>
              </Pressable>
            </View>
          ) : customMode ? (
            <View className="rounded-2xl border border-apple-border bg-white p-3">
              <Text className="text-[11px] uppercase tracking-wider text-apple-secondary">
                Custom item
              </Text>
              <TextInput
                value={customName}
                onChangeText={setCustomName}
                placeholder='e.g. "Stedi Type-X 32&quot; light bar"'
                placeholderTextColor="#A1A1A6"
                className="mt-2 rounded-lg bg-apple-bg2 px-3 py-2 text-apple-ink"
              />
              <Pressable
                onPress={() => {
                  setCustomMode(false);
                  setCustomName('');
                }}
                className="mt-3 self-start"
              >
                <Text className="text-xs text-apple-secondary underline">Back to catalogue search</Text>
              </Pressable>
            </View>
          ) : (
            <View>
              <TextInput
                value={partQuery}
                onChangeText={setPartQuery}
                placeholder="Search brand or part name…"
                placeholderTextColor="#A1A1A6"
                className="rounded-lg bg-white px-3 py-2 text-apple-ink"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searching ? (
                <ActivityIndicator color="#FF6A2B" className="mt-2" />
              ) : partResults.length > 0 ? (
                <View className="mt-2 overflow-hidden rounded-xl border border-apple-border">
                  {partResults.map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={() => {
                        setSelectedPart(p);
                        setCategory(p.category as ModCategory);
                        setPartQuery('');
                        setPartResults([]);
                      }}
                      className="border-b border-apple-border bg-white px-3 py-2 active:bg-apple-bg2"
                    >
                      <Text className="text-apple-ink">
                        <Text className="font-semibold">{p.brand}</Text> {p.name}
                      </Text>
                      <Text className="text-[11px] uppercase tracking-wider text-apple-secondary">
                        {p.category.replace('_', ' ')}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : partQuery.trim().length >= 2 ? (
                <Text className="mt-2 text-sm text-apple-secondary">No matches yet.</Text>
              ) : null}

              <Pressable
                onPress={() => setCustomMode(true)}
                className="mt-3 self-start"
              >
                <Text className="text-sm font-semibold text-accent">+ Add custom item</Text>
              </Pressable>
            </View>
          )}
        </Section>

        {/* Category */}
        <Section title="Category">
          <View className="flex-row flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Pressable
                key={c.value}
                onPress={() => setCategory(c.value)}
                className={`rounded-full border px-3 py-1.5 ${
                  category === c.value
                    ? 'border-accent bg-accent/20'
                    : 'border-apple-border bg-white'
                }`}
              >
                <Text
                  className={`text-xs ${
                    category === c.value ? 'font-semibold text-accent' : 'text-apple-secondary'
                  }`}
                >
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Section>

        {/* Target cost */}
        <Section title="Target cost (AUD)">
          <TextInput
            value={targetCost}
            onChangeText={setTargetCost}
            placeholder="Leave blank if you're not sure"
            placeholderTextColor="#A1A1A6"
            keyboardType="decimal-pad"
            className="rounded-lg bg-white px-3 py-2 text-apple-ink"
          />
        </Section>

        {/* Priority */}
        <Section title="Priority">
          <View className="gap-2">
            {PRIORITIES.map((p) => (
              <Pressable
                key={p.value}
                onPress={() => setPriority(p.value)}
                className={`flex-row items-center justify-between rounded-xl border px-3 py-2.5 ${
                  priority === p.value
                    ? 'border-accent bg-accent/15'
                    : 'border-apple-border bg-white'
                }`}
              >
                <View>
                  <Text
                    className={`text-sm font-semibold ${
                      priority === p.value ? 'text-accent' : 'text-apple-ink'
                    }`}
                  >
                    {p.label}
                  </Text>
                  <Text className="text-[11px] text-apple-secondary">{p.hint}</Text>
                </View>
                {priority === p.value ? (
                  <Text className="text-accent">✓</Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        </Section>

        {/* Notes */}
        <Section title="Notes (optional)">
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder='e.g. "Wait for end-of-financial-year sales"'
            placeholderTextColor="#A1A1A6"
            multiline
            className="min-h-[80px] rounded-lg bg-white px-3 py-2 text-apple-ink"
          />
        </Section>

        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          className="mt-6 rounded-xl bg-accent px-5 py-3.5 active:bg-accent-dark disabled:opacity-60"
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-center text-base font-semibold text-white">
              Add to wishlist
            </Text>
          )}
        </Pressable>
      </KeyboardSafeScrollView>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-5">
      <Text className="mb-2 text-[11px] font-semibold uppercase tracking-[2px] text-apple-secondary">
        {title}
      </Text>
      {children}
    </View>
  );
}
