import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
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

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { consumePendingVin, VIN_PATTERN } from '@/lib/vin-handoff';

export default function AddVehicleScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [vin, setVin] = useState('');
  const [year, setYear] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [trim, setTrim] = useState('');
  const [nickname, setNickname] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Pick up a VIN scanned in /garage/scan-vin without losing any text the
  // user had already typed on this form.
  useFocusEffect(
    useCallback(() => {
      const scanned = consumePendingVin();
      if (scanned) setVin(scanned);
    }, [])
  );

  async function handleSubmit() {
    if (!session) {
      Alert.alert('Not signed in', 'Sign in before adding a vehicle.');
      return;
    }

    const normalisedVin = vin.trim().toUpperCase();
    const yearNum = Number(year);

    if (!VIN_PATTERN.test(normalisedVin)) {
      Alert.alert('Invalid VIN', 'Enter a 17-character VIN (no I, O, or Q).');
      return;
    }
    if (!yearNum || yearNum < 1900) {
      Alert.alert('Invalid year', 'Enter a 4-digit year.');
      return;
    }
    if (!make.trim() || !model.trim()) {
      Alert.alert('Missing details', 'Make and model are required.');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from('vehicles').insert({
      vin: normalisedVin,
      current_owner_id: session.user.id,
      year: yearNum,
      make: make.trim(),
      model: model.trim(),
      trim: trim.trim() || null,
      nickname: nickname.trim() || null,
      ownership_chain: [
        { owner_id: session.user.id, started_at: new Date().toISOString() },
      ],
    });
    setSubmitting(false);

    if (error) {
      const msg = error.code === '23505'
        ? 'A vehicle with that VIN already exists.'
        : error.message;
      Alert.alert('Could not add vehicle', msg);
      return;
    }

    router.back();
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-ink-950"
    >
      <Stack.Screen options={{ title: 'Add vehicle' }} />
      <ScrollView contentContainerClassName="px-6 pt-6 pb-24">
        <Text className="text-3xl font-bold text-white">Add your 4WD</Text>
        <Text className="mt-2 text-ink-300">
          The VIN is the spine of the whole record. Build history attaches to it and
          travels with the car.
        </Text>

        <View className="mt-8 gap-4">
          <Field label="VIN (17 characters)">
            <View className="flex-row gap-2">
              <TextInput
                value={vin}
                onChangeText={(t) => setVin(t.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={17}
                placeholder="1HGCM82633A123456"
                placeholderTextColor="#5A6373"
                className="flex-1 rounded-xl bg-ink-800 px-4 py-3 font-mono text-white"
              />
              <Pressable
                onPress={() => router.push('/garage/scan-vin')}
                className="items-center justify-center rounded-xl border border-accent bg-ink-800 px-4 active:bg-ink-700"
              >
                <Text className="text-xs font-semibold text-accent">Scan</Text>
              </Pressable>
            </View>
            <Text className="mt-2 text-xs text-ink-300">
              Tap <Text className="text-accent">Scan</Text> to read the barcode
              on the driver&apos;s door jamb sticker.
            </Text>
          </Field>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field label="Year">
                <TextInput
                  value={year}
                  onChangeText={setYear}
                  keyboardType="number-pad"
                  maxLength={4}
                  placeholder="2018"
                  placeholderTextColor="#5A6373"
                  className="rounded-xl bg-ink-800 px-4 py-3 text-white"
                />
              </Field>
            </View>
            <View className="flex-[2]">
              <Field label="Make">
                <TextInput
                  value={make}
                  onChangeText={setMake}
                  placeholder="Toyota"
                  placeholderTextColor="#5A6373"
                  className="rounded-xl bg-ink-800 px-4 py-3 text-white"
                />
              </Field>
            </View>
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field label="Model">
                <TextInput
                  value={model}
                  onChangeText={setModel}
                  placeholder="LandCruiser 79"
                  placeholderTextColor="#5A6373"
                  className="rounded-xl bg-ink-800 px-4 py-3 text-white"
                />
              </Field>
            </View>
            <View className="flex-1">
              <Field label="Trim (optional)">
                <TextInput
                  value={trim}
                  onChangeText={setTrim}
                  placeholder="GXL"
                  placeholderTextColor="#5A6373"
                  className="rounded-xl bg-ink-800 px-4 py-3 text-white"
                />
              </Field>
            </View>
          </View>

          <Field label="Nickname (optional)">
            <TextInput
              value={nickname}
              onChangeText={setNickname}
              placeholder="Project Patrol"
              placeholderTextColor="#5A6373"
              className="rounded-xl bg-ink-800 px-4 py-3 text-white"
            />
          </Field>
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          className="mt-8 rounded-xl bg-accent py-3.5 active:bg-accent-dark disabled:opacity-60"
        >
          {submitting ? (
            <ActivityIndicator color="#08090B" />
          ) : (
            <Text className="text-center text-base font-semibold text-ink-950">
              Add vehicle
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text className="mb-2 text-xs uppercase tracking-wider text-ink-300">{label}</Text>
      {children}
    </View>
  );
}
