import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { maxVehiclesForTier } from '@/lib/subscription';
import { supabase } from '@/lib/supabase';
import { decodeVin } from '@/lib/vin-decode';
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
  const [isPublic, setIsPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [decoding, setDecoding] = useState(false);
  const [decodedVin, setDecodedVin] = useState<string | null>(null);
  // Guards the decode effect against re-firing for the same VIN.
  const lastDecodedRef = useRef<string | null>(null);

  // Pick up a VIN scanned in /garage/scan-vin without losing any text the
  // user had already typed on this form.
  useFocusEffect(
    useCallback(() => {
      const scanned = consumePendingVin();
      if (scanned) setVin(scanned);
    }, [])
  );

  // Auto-decode the VIN whenever it reaches 17 valid characters. Only
  // fills empty fields — anything the user already typed is preserved.
  useEffect(() => {
    const candidate = vin.trim().toUpperCase();
    if (!VIN_PATTERN.test(candidate)) return;
    if (lastDecodedRef.current === candidate) return;
    lastDecodedRef.current = candidate;

    let cancelled = false;
    setDecoding(true);
    decodeVin(candidate)
      .then((result) => {
        if (cancelled || !result) return;
        if (!year && result.year) setYear(String(result.year));
        if (!make && result.make) setMake(result.make);
        if (!model && result.model) setModel(result.model);
        if (!trim && result.trim) setTrim(result.trim);
        // Mark the decoded VIN so we can show the "auto-filled" hint;
        // only set if we actually got something useful.
        if (result.year || result.make || result.model || result.trim) {
          setDecodedVin(candidate);
        }
      })
      .finally(() => {
        if (!cancelled) setDecoding(false);
      });

    return () => {
      cancelled = true;
    };
    // Intentionally omit year/make/model/trim from deps — those refs are
    // read inside the effect to decide what to fill, but a change in
    // them shouldn't re-trigger another decode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vin]);

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

    const { data: profile } = await supabase
      .from('users')
      .select('subscription_tier')
      .eq('id', session.user.id)
      .maybeSingle();
    const tier = profile?.subscription_tier ?? 'free';
    const limit = maxVehiclesForTier(tier);
    if (limit != null) {
      const { count } = await supabase
        .from('vehicles')
        .select('id', { count: 'exact', head: true })
        .eq('current_owner_id', session.user.id);
      if ((count ?? 0) >= limit) {
        Alert.alert(
          'Vehicle limit',
          `Free accounts support up to ${limit} vehicles. Upgrade to Member for unlimited garage space.`,
          [{ text: 'View plans', onPress: () => router.push('/profile/subscription') }]
        );
        return;
      }
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
      is_public: isPublic,
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
    <>
      <Stack.Screen options={{ title: 'Add vehicle' }} />
      <KeyboardSafeScrollView className="flex-1 bg-apple-bg2" contentContainerClassName="px-6 pt-6">
        <Text className="text-3xl font-bold text-apple-ink">Add your 4WD</Text>
        <Text className="mt-2 text-apple-secondary">
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
                placeholderTextColor="#A1A1A6"
                className="flex-1 rounded-xl border border-apple-border bg-white px-4 py-3 font-mono text-apple-ink"
              />
              <Pressable
                onPress={() => router.push('/garage/scan-vin')}
                className="items-center justify-center rounded-xl border border-accent bg-apple-bg2 px-4 active:opacity-80"
              >
                <Text className="text-xs font-semibold text-accent">Scan</Text>
              </Pressable>
            </View>
            {decoding ? (
              <View className="mt-2 flex-row items-center gap-2">
                <ActivityIndicator color="#FF6A2B" size="small" />
                <Text className="text-xs text-apple-secondary">
                  Looking up vehicle from VIN…
                </Text>
              </View>
            ) : decodedVin && decodedVin === vin.trim().toUpperCase() ? (
              <Text className="mt-2 text-xs text-signal-green">
                Auto-filled from VIN — review and edit anything that&apos;s wrong.
              </Text>
            ) : (
              <Text className="mt-2 text-xs text-apple-secondary">
                Tap <Text className="text-accent">Scan</Text> to read the
                barcode on the driver&apos;s door jamb sticker.
              </Text>
            )}
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
                  placeholderTextColor="#A1A1A6"
                  className="rounded-xl border border-apple-border bg-white px-4 py-3 text-apple-ink"
                />
              </Field>
            </View>
            <View className="flex-[2]">
              <Field label="Make">
                <TextInput
                  value={make}
                  onChangeText={setMake}
                  placeholder="Toyota"
                  placeholderTextColor="#A1A1A6"
                  className="rounded-xl border border-apple-border bg-white px-4 py-3 text-apple-ink"
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
                  placeholderTextColor="#A1A1A6"
                  className="rounded-xl border border-apple-border bg-white px-4 py-3 text-apple-ink"
                />
              </Field>
            </View>
            <View className="flex-1">
              <Field label="Trim (optional)">
                <TextInput
                  value={trim}
                  onChangeText={setTrim}
                  placeholder="GXL"
                  placeholderTextColor="#A1A1A6"
                  className="rounded-xl border border-apple-border bg-white px-4 py-3 text-apple-ink"
                />
              </Field>
            </View>
          </View>

          <Field label="Nickname (optional)">
            <TextInput
              value={nickname}
              onChangeText={setNickname}
              placeholder="Project Patrol"
              placeholderTextColor="#A1A1A6"
              className="rounded-xl border border-apple-border bg-white px-4 py-3 text-apple-ink"
            />
          </Field>

          <Field label="Visibility">
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => setIsPublic(true)}
                className={`flex-1 rounded-xl border px-4 py-3 ${
                  isPublic
                    ? 'border-accent bg-accent/15'
                    : 'border-apple-border bg-white'
                }`}
              >
                <Text
                  className={`text-center font-semibold ${
                    isPublic ? 'text-accent' : 'text-apple-secondary'
                  }`}
                >
                  Public
                </Text>
                <Text className="mt-1 text-center text-xs text-apple-secondary">
                  Share link when you&apos;re ready
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setIsPublic(false)}
                className={`flex-1 rounded-xl border px-4 py-3 ${
                  !isPublic
                    ? 'border-accent bg-accent/15'
                    : 'border-apple-border bg-white'
                }`}
              >
                <Text
                  className={`text-center font-semibold ${
                    !isPublic ? 'text-accent' : 'text-apple-secondary'
                  }`}
                >
                  Private
                </Text>
                <Text className="mt-1 text-center text-xs text-apple-secondary">
                  Only you until you change it
                </Text>
              </Pressable>
            </View>
          </Field>
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          className="mt-8 rounded-xl bg-accent py-3.5 active:bg-accent-dark disabled:opacity-60"
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-center text-base font-semibold text-white">
              Add vehicle
            </Text>
          )}
        </Pressable>
      </KeyboardSafeScrollView>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text className="mb-2 text-xs uppercase tracking-wider text-apple-secondary">{label}</Text>
      {children}
    </View>
  );
}
