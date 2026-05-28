import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { searchParts, submitCustomPart, type Part } from '@/lib/parts';
import { supabase } from '@/lib/supabase';
import type { InstallerType, ModCategory, ModPrivacy } from '@/types/database';

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

const INSTALLERS: { value: InstallerType; label: string }[] = [
  { value: 'self', label: 'Me' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'friend', label: 'Friend' },
  { value: 'dealer', label: 'Dealer' },
];

const PRIVACIES: { value: ModPrivacy; label: string; hint: string }[] = [
  { value: 'public', label: 'Public', hint: 'Visible to anyone' },
  { value: 'followers', label: 'Followers', hint: 'Only people who follow you' },
  { value: 'private', label: 'Private', hint: 'Only you' },
];

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function LogNewScreen() {
  const router = useRouter();
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();

  // Part picker state
  const [partQuery, setPartQuery] = useState('');
  const [partResults, setPartResults] = useState<Part[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [customMode, setCustomMode] = useState(false);
  const [customBrand, setCustomBrand] = useState('');
  const [customName, setCustomName] = useState('');

  // Mod fields
  const [category, setCategory] = useState<ModCategory>('suspension');
  const [cost, setCost] = useState('');
  const [costIsApproximate, setCostIsApproximate] = useState(false);
  const [installerType, setInstallerType] = useState<InstallerType>('self');
  const [installDate, setInstallDate] = useState(todayISO());
  const [dateIsApproximate, setDateIsApproximate] = useState(false);
  const [notes, setNotes] = useState('');
  const [privacy, setPrivacy] = useState<ModPrivacy>('public');

  const [submitting, setSubmitting] = useState(false);

  // Debounced parts search
  const searchToken = useRef(0);
  useEffect(() => {
    const term = partQuery.trim();
    if (selectedPart || customMode) {
      setPartResults([]);
      return;
    }
    if (!term) {
      setPartResults([]);
      setSearching(false);
      return;
    }
    const token = ++searchToken.current;
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const results = await searchParts(term);
        if (searchToken.current === token) {
          setPartResults(results);
        }
      } catch {
        if (searchToken.current === token) setPartResults([]);
      } finally {
        if (searchToken.current === token) setSearching(false);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [partQuery, selectedPart, customMode]);

  const partDescriptor = useMemo(() => {
    if (selectedPart) {
      return { brand: selectedPart.brand, name: selectedPart.name, category: selectedPart.category };
    }
    if (customMode && customBrand && customName) {
      return { brand: customBrand, name: customName, category };
    }
    return null;
  }, [selectedPart, customMode, customBrand, customName, category]);

  // When a catalogue part is picked, mirror its category onto the form.
  useEffect(() => {
    if (selectedPart) setCategory(selectedPart.category);
  }, [selectedPart]);

  const clearPart = useCallback(() => {
    setSelectedPart(null);
    setCustomMode(false);
    setCustomBrand('');
    setCustomName('');
    setPartQuery('');
  }, []);

  async function handleSubmit() {
    if (!vehicleId) {
      Alert.alert('Missing vehicle', 'This log flow needs a vehicle id in the URL.');
      return;
    }
    if (!partDescriptor) {
      Alert.alert('Pick a part', 'Search the catalogue or add a custom part.');
      return;
    }

    const costValue = cost.trim() ? Number(cost.replace(/[^0-9.]/g, '')) : null;
    if (cost.trim() && (Number.isNaN(costValue) || costValue! < 0)) {
      Alert.alert('Bad cost', 'Enter a number, or leave empty if undisclosed.');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(installDate)) {
      Alert.alert('Bad date', 'Use the format YYYY-MM-DD.');
      return;
    }

    setSubmitting(true);
    try {
      let partId = selectedPart?.id ?? null;
      let customPartName: string | null = null;

      // Custom-part fallback: create the moderation-queue row, link to it.
      if (!selectedPart && customMode) {
        try {
          const created = await submitCustomPart({
            brand: customBrand.trim(),
            name: customName.trim(),
            category,
          });
          partId = created.id;
        } catch {
          customPartName = `${customBrand.trim()} ${customName.trim()}`.trim();
        }
      }

      const { error } = await supabase.from('mods').insert({
        vehicle_id: vehicleId,
        part_id: partId,
        custom_part_name: customPartName,
        category,
        cost: costValue,
        cost_is_approximate: costIsApproximate,
        installer_type: installerType,
        install_date: installDate,
        date_is_approximate: dateIsApproximate,
        notes: notes.trim() || null,
        privacy,
      });

      if (error) throw error;

      router.back();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not log mod';
      Alert.alert('Save failed', message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-ink-950"
    >
      <Stack.Screen options={{ title: 'Log a mod' }} />
      <ScrollView
        contentContainerClassName="px-6 pt-6 pb-24"
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-3xl font-bold text-white">Log a mod</Text>
        <Text className="mt-2 text-ink-300">
          Target: under 90 seconds. Part → cost → confirm.
        </Text>

        {/* ---- Part picker ---- */}
        <SectionHeading>Part</SectionHeading>
        {partDescriptor ? (
          <View className="rounded-2xl border border-ink-700 bg-ink-900 p-4">
            <Text className="text-xs uppercase tracking-wider text-ink-300">
              {partDescriptor.category.replace('_', ' ')}
              {customMode ? ' · pending approval' : ''}
            </Text>
            <Text className="mt-1 text-lg font-semibold text-white">
              {partDescriptor.brand}
            </Text>
            <Text className="text-ink-200">{partDescriptor.name}</Text>
            <Pressable onPress={clearPart} className="mt-3 self-start">
              <Text className="text-sm font-semibold text-accent">Change</Text>
            </Pressable>
          </View>
        ) : (
          <View>
            <TextInput
              value={partQuery}
              onChangeText={setPartQuery}
              placeholder="Search brand or part name…"
              placeholderTextColor="#5A6373"
              autoCapitalize="none"
              autoCorrect={false}
              className="rounded-xl bg-ink-800 px-4 py-3 text-white"
            />
            {searching ? (
              <Text className="mt-2 text-xs text-ink-300">Searching…</Text>
            ) : null}

            {partResults.length > 0 ? (
              <View className="mt-2 overflow-hidden rounded-xl border border-ink-700">
                {partResults.map((p, idx) => (
                  <Pressable
                    key={p.id}
                    onPress={() => setSelectedPart(p)}
                    className={`bg-ink-900 px-4 py-3 active:bg-ink-800 ${
                      idx > 0 ? 'border-t border-ink-700' : ''
                    }`}
                  >
                    <Text className="text-xs uppercase tracking-wider text-ink-300">
                      {p.category.replace('_', ' ')}
                    </Text>
                    <Text className="mt-0.5 font-semibold text-white">{p.brand}</Text>
                    <Text className="text-ink-200">{p.name}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <Pressable
              onPress={() => {
                setCustomMode(true);
                setCustomBrand((b) => b || partQuery.trim());
              }}
              className="mt-3 rounded-xl border border-dashed border-ink-600 px-4 py-3"
            >
              <Text className="text-center text-sm font-semibold text-ink-200">
                + Add a custom part (not in catalogue)
              </Text>
            </Pressable>

            {customMode ? (
              <View className="mt-3 gap-3 rounded-2xl border border-ink-700 bg-ink-900 p-4">
                <View>
                  <Text className="mb-2 text-xs uppercase tracking-wider text-ink-300">
                    Brand
                  </Text>
                  <TextInput
                    value={customBrand}
                    onChangeText={setCustomBrand}
                    placeholder="e.g. ARB"
                    placeholderTextColor="#5A6373"
                    className="rounded-xl bg-ink-800 px-4 py-3 text-white"
                  />
                </View>
                <View>
                  <Text className="mb-2 text-xs uppercase tracking-wider text-ink-300">
                    Part name
                  </Text>
                  <TextInput
                    value={customName}
                    onChangeText={setCustomName}
                    placeholder="e.g. Summit Bull Bar"
                    placeholderTextColor="#5A6373"
                    className="rounded-xl bg-ink-800 px-4 py-3 text-white"
                  />
                </View>
                <Text className="text-xs text-ink-300">
                  Submitted custom parts go to a moderation queue and are visible to you
                  while pending.
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* ---- Category ---- */}
        <SectionHeading>Category</SectionHeading>
        <Chips
          options={CATEGORIES}
          value={category}
          onChange={(v) => setCategory(v as ModCategory)}
        />

        {/* ---- Cost ---- */}
        <SectionHeading>Cost (AUD)</SectionHeading>
        <View className="flex-row items-center gap-3">
          <View className="flex-1 flex-row items-center rounded-xl bg-ink-800 px-4">
            <Text className="text-ink-300">$</Text>
            <TextInput
              value={cost}
              onChangeText={setCost}
              placeholder="0.00"
              placeholderTextColor="#5A6373"
              keyboardType="decimal-pad"
              className="ml-2 flex-1 py-3 text-white"
            />
          </View>
          <Toggle
            value={costIsApproximate}
            onChange={setCostIsApproximate}
            label="Approx"
          />
        </View>
        <Text className="mt-2 text-xs text-ink-300">
          Leave empty if it was a gift or undisclosed.
        </Text>

        {/* ---- Installer ---- */}
        <SectionHeading>Who installed it</SectionHeading>
        <Chips
          options={INSTALLERS}
          value={installerType}
          onChange={(v) => setInstallerType(v as InstallerType)}
        />

        {/* ---- Install date ---- */}
        <SectionHeading>Install date</SectionHeading>
        <View className="flex-row items-center gap-3">
          <TextInput
            value={installDate}
            onChangeText={setInstallDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#5A6373"
            autoCapitalize="none"
            autoCorrect={false}
            className="flex-1 rounded-xl bg-ink-800 px-4 py-3 font-mono text-white"
          />
          <Toggle
            value={dateIsApproximate}
            onChange={setDateIsApproximate}
            label="Approx"
          />
        </View>

        {/* ---- Notes ---- */}
        <SectionHeading>Notes (optional)</SectionHeading>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Anything worth remembering…"
          placeholderTextColor="#5A6373"
          multiline
          numberOfLines={3}
          className="min-h-[80px] rounded-xl bg-ink-800 px-4 py-3 text-white"
        />

        {/* ---- Privacy ---- */}
        <SectionHeading>Privacy</SectionHeading>
        <View className="gap-2">
          {PRIVACIES.map((p) => {
            const active = privacy === p.value;
            return (
              <Pressable
                key={p.value}
                onPress={() => setPrivacy(p.value)}
                className={`flex-row items-center justify-between rounded-xl border px-4 py-3 ${
                  active ? 'border-accent bg-ink-900' : 'border-ink-700 bg-ink-900'
                }`}
              >
                <View className="flex-1">
                  <Text className="font-semibold text-white">{p.label}</Text>
                  <Text className="text-xs text-ink-300">{p.hint}</Text>
                </View>
                <View
                  className={`h-5 w-5 rounded-full border-2 ${
                    active ? 'border-accent bg-accent' : 'border-ink-500 bg-transparent'
                  }`}
                />
              </Pressable>
            );
          })}
        </View>

        {/* ---- Submit ---- */}
        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          className="mt-8 rounded-xl bg-accent py-3.5 active:bg-accent-dark disabled:opacity-60"
        >
          {submitting ? (
            <ActivityIndicator color="#08090B" />
          ) : (
            <Text className="text-center text-base font-semibold text-ink-950">
              Log mod
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <Text className="mb-2 mt-6 text-xs font-semibold uppercase tracking-[2px] text-ink-300">
      {children}
    </Text>
  );
}

function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            className={`rounded-full border px-3.5 py-2 ${
              active
                ? 'border-accent bg-accent'
                : 'border-ink-700 bg-ink-900'
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                active ? 'text-ink-950' : 'text-ink-200'
              }`}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      className={`rounded-full border px-3 py-2 ${
        value ? 'border-accent bg-accent' : 'border-ink-700 bg-ink-900'
      }`}
    >
      <Text
        className={`text-xs font-semibold ${
          value ? 'text-ink-950' : 'text-ink-200'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
