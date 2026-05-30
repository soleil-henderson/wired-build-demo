import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { KeyboardSafeScrollView } from '@/components/ui/KeyboardSafeView';

import { UserBadges } from '@/components/UserBadges';
import { useAuth } from '@/lib/auth-context';
import {
  findRecipientByHandle,
  transferVehicleOwnership,
  type TransferUser,
} from '@/lib/ownership';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type Vehicle = Database['public']['Tables']['vehicles']['Row'];

export default function TransferOwnershipScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loadingVehicle, setLoadingVehicle] = useState(true);

  const [handleInput, setHandleInput] = useState('');
  const [recipient, setRecipient] = useState<TransferUser | null>(null);
  const [looking, setLooking] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadVehicle = useCallback(async () => {
    if (!vehicleId) return;
    const { data } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', vehicleId)
      .maybeSingle();
    setVehicle(data);
    setLoadingVehicle(false);
  }, [vehicleId]);

  useFocusEffect(
    useCallback(() => {
      loadVehicle();
    }, [loadVehicle])
  );

  async function handleLookup() {
    if (!handleInput.trim()) return;
    setLooking(true);
    try {
      const user = await findRecipientByHandle(handleInput);
      if (!user) {
        Alert.alert('No match', `No user with handle @${handleInput.replace(/^@/, '')}.`);
        setRecipient(null);
        return;
      }
      if (session && user.id === session.user.id) {
        Alert.alert("That's you", 'Pick a different handle.');
        setRecipient(null);
        return;
      }
      setRecipient(user);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lookup failed';
      Alert.alert('Lookup failed', message);
    } finally {
      setLooking(false);
    }
  }

  function handleSubmitConfirm() {
    if (!recipient || !vehicle || submitting) return;
    Alert.alert(
      'Transfer this build?',
      `You're handing ${
        vehicle.nickname ?? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
      } (VIN ····${vehicle.vin.slice(-6)}) to @${recipient.handle}.\n\nThis cannot be undone from the app — only @${recipient.handle} can transfer it back. The full mod history travels with the build.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Transfer', style: 'destructive', onPress: doTransfer },
      ]
    );
  }

  async function doTransfer() {
    if (!recipient || !vehicle) return;
    setSubmitting(true);
    try {
      await transferVehicleOwnership({
        vehicleId: vehicle.id,
        newOwnerId: recipient.id,
        note: note.trim() || null,
      });
      Alert.alert(
        'Transferred',
        `${vehicle.nickname ?? vehicle.make} is now @${recipient.handle}'s.`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Caller no longer owns this vehicle. Pop back to garage.
              router.replace('/(tabs)/garage');
            },
          },
        ]
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transfer failed';
      Alert.alert('Transfer failed', message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingVehicle) {
    return (
      <View className="flex-1 items-center justify-center bg-apple-bg2">
        <Stack.Screen options={{ title: 'Transfer ownership' }} />
        <ActivityIndicator color="#FF6A2B" />
      </View>
    );
  }

  if (!vehicle) {
    return (
      <View className="flex-1 items-center justify-center bg-apple-bg2 px-6">
        <Stack.Screen options={{ title: 'Not found' }} />
        <Text className="text-apple-ink">Vehicle not found.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Transfer ownership' }} />
      <KeyboardSafeScrollView className="flex-1 bg-apple-bg2" contentContainerClassName="px-6 pt-6">
        <Text className="text-accent text-xs font-semibold tracking-[3px]">
          OWNERSHIP TRANSFER
        </Text>
        <Text className="mt-1 text-3xl font-bold text-apple-ink">Hand it over</Text>
        <Text className="mt-2 text-apple-secondary">
          Permanently move this VIN to another Wired Build user. The mod
          history, photos and build value travel with the vehicle — that&apos;s
          what makes the build a transferable asset.
        </Text>

        {/* ---- Vehicle preview ---- */}
        <View className="mt-6 rounded-2xl border border-apple-border bg-white p-4">
          <Text className="text-[11px] uppercase tracking-wider text-apple-secondary">
            Transferring
          </Text>
          <Text className="mt-1 text-lg font-semibold text-apple-ink">
            {vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`}
          </Text>
          <Text className="text-sm text-apple-secondary">
            {vehicle.year} · {vehicle.make} · {vehicle.model}
            {vehicle.trim ? ` · ${vehicle.trim}` : ''}
          </Text>
          <Text className="mt-1 font-mono text-xs text-apple-secondary">
            VIN ····{vehicle.vin.slice(-6)}
          </Text>
        </View>

        {/* ---- Recipient ---- */}
        <Text className="mt-8 text-[11px] font-semibold uppercase tracking-[2px] text-apple-secondary">
          Recipient
        </Text>
        <View className="mt-2 flex-row items-stretch gap-2">
          <TextInput
            value={handleInput}
            onChangeText={(t) => {
              setHandleInput(t);
              if (recipient) setRecipient(null);
            }}
            placeholder="@handle"
            placeholderTextColor="#A1A1A6"
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={handleLookup}
            className="flex-1 rounded-xl bg-white px-3 py-2 text-apple-ink"
          />
          <Pressable
            onPress={handleLookup}
            disabled={!handleInput.trim() || looking}
            className="items-center justify-center rounded-xl border border-apple-border bg-white px-4 active:bg-apple-bg2 disabled:opacity-50"
          >
            {looking ? (
              <ActivityIndicator color="#FF6A2B" />
            ) : (
              <Text className="text-sm font-semibold text-apple-secondary">Look up</Text>
            )}
          </Pressable>
        </View>

        {recipient ? (
          <View className="mt-3 flex-row items-center gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-3">
            {recipient.avatar_url ? (
              <Image
                source={{ uri: recipient.avatar_url }}
                className="h-12 w-12 rounded-full bg-apple-bg2"
              />
            ) : (
              <View className="h-12 w-12 items-center justify-center rounded-full bg-apple-bg2">
                <Text className="text-lg font-bold text-apple-ink">
                  {(recipient.display_name || recipient.handle || '?')[0].toUpperCase()}
                </Text>
              </View>
            )}
            <View className="flex-1">
              <View className="flex-row items-center gap-1.5">
                <Text className="font-semibold text-white">{recipient.display_name}</Text>
                <UserBadges user={recipient} />
              </View>
              <Text className="text-xs text-apple-secondary">@{recipient.handle}</Text>
            </View>
          </View>
        ) : null}

        {/* ---- Note ---- */}
        <Text className="mt-8 text-[11px] font-semibold uppercase tracking-[2px] text-apple-secondary">
          Note (optional)
        </Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder='e.g. "Sold June 2026 — pickup Friday"'
          placeholderTextColor="#A1A1A6"
          multiline
          className="mt-2 min-h-[80px] rounded-xl bg-white px-3 py-2 text-apple-ink"
        />
        <Text className="mt-1 text-xs text-apple-secondary">
          Stored on the public ownership chain — visible to anyone who can see
          the build.
        </Text>

        {/* ---- Action ---- */}
        <Pressable
          onPress={handleSubmitConfirm}
          disabled={!recipient || submitting}
          className="mt-8 rounded-xl bg-accent px-5 py-3.5 active:bg-accent-dark disabled:opacity-50"
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-center text-base font-semibold text-white">
              {recipient ? `Transfer to @${recipient.handle}` : 'Look up a recipient first'}
            </Text>
          )}
        </Pressable>

        <Text className="mt-3 text-center text-[11px] text-apple-secondary">
          Need to back out? Pop this screen — no transfer happens until you
          confirm in the alert.
        </Text>
      </KeyboardSafeScrollView>
    </>
  );
}
