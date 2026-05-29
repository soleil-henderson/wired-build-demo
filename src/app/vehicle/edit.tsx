import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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

import { CoverPhotoField, type PickedCoverImage } from '@/components/CoverPhotoField';
import { useAuth } from '@/lib/auth-context';
import { routeParam } from '@/lib/route-param';
import {
  deleteStorageObjects,
  storageKeyFromModPhotoPublicUrl,
  uploadCoverPhoto,
} from '@/lib/storage';
import { deleteVehicle, getVehicleForEdit, updateVehicle } from '@/lib/vehicles';
import { supabase } from '@/lib/supabase';

export default function EditVehicleScreen() {
  const params = useLocalSearchParams<{ vehicleId: string }>();
  const vehicleId = routeParam(params.vehicleId);
  const { session, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState('');
  const [nickname, setNickname] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isForSale, setIsForSale] = useState(false);
  const [askingPrice, setAskingPrice] = useState('');
  const [manualValue, setManualValue] = useState('');
  const [manualValueNote, setManualValueNote] = useState('');
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [localCover, setLocalCover] = useState<PickedCoverImage | null>(null);
  const [removeCover, setRemoveCover] = useState(false);

  const load = useCallback(async () => {
    if (!vehicleId || authLoading || !session) {
      if (!authLoading && !session) setLoading(false);
      return;
    }
    try {
      const v = await getVehicleForEdit(vehicleId);
      if (!v) {
        Alert.alert('Not found', 'This vehicle is not available.');
        router.back();
        return;
      }
      if (v.current_owner_id !== session.user.id) {
        Alert.alert('Not allowed', 'Only the owner can edit this build.');
        router.back();
        return;
      }
      setTitle(
        v.nickname ?? `${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ''}`
      );
      setNickname(v.nickname ?? '');
      setIsPublic(v.is_public);
      setIsForSale(v.is_for_sale);
      setAskingPrice(v.asking_price != null ? String(v.asking_price) : '');
      setManualValue(
        v.manual_build_value != null ? String(v.manual_build_value) : ''
      );
      setManualValueNote(v.manual_build_value_note ?? '');
      setCoverUrl(v.cover_photo_url);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load vehicle';
      Alert.alert('Error', message);
      router.back();
    } finally {
      setLoading(false);
    }
  }, [vehicleId, session, authLoading, router]);

  useEffect(() => {
    load();
  }, [load]);

  function handlePickCover(image: PickedCoverImage) {
    setLocalCover(image);
    setRemoveCover(false);
  }

  function handleRemoveCover() {
    setLocalCover(null);
    setRemoveCover(true);
  }

  async function handleSave() {
    if (!vehicleId) {
      Alert.alert('Save failed', 'Missing vehicle id.');
      return;
    }

    const {
      data: { session: liveSession },
    } = await supabase.auth.getSession();
    if (!liveSession) {
      Alert.alert('Sign in required', 'Your session expired. Sign in again to save changes.');
      return;
    }

    setSubmitting(true);
    try {
      const previousCoverKey =
        coverUrl && (removeCover || localCover)
          ? storageKeyFromModPhotoPublicUrl(coverUrl)
          : null;

      let nextCoverUrl = coverUrl;
      if (removeCover) {
        nextCoverUrl = null;
      } else if (localCover) {
        nextCoverUrl = await uploadCoverPhoto({
          uri: localCover.uri,
          ownerId: liveSession.user.id,
          width: localCover.width,
          height: localCover.height,
        });
      }

      const priceValue = askingPrice.trim()
        ? Number(askingPrice.replace(/[^0-9.]/g, ''))
        : null;
      const manualNum = manualValue.trim()
        ? Number(manualValue.replace(/[^0-9.]/g, ''))
        : null;

      await updateVehicle(vehicleId, {
        nickname: nickname.trim() || null,
        cover_photo_url: nextCoverUrl,
        is_public: isPublic,
        is_for_sale: isForSale,
        asking_price: isForSale && priceValue && !Number.isNaN(priceValue) ? priceValue : null,
        manual_build_value:
          manualNum != null && !Number.isNaN(manualNum) && manualNum > 0 ? manualNum : null,
        manual_build_value_note: manualValueNote.trim() || null,
      });

      if (previousCoverKey) {
        await deleteStorageObjects('mod-photos', [previousCoverKey]);
      }

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('Build saved.');
      }

      router.back();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save build';
      Alert.alert('Save failed', message);
    } finally {
      setSubmitting(false);
    }
  }

  const previewUri = removeCover ? null : (localCover?.uri ?? coverUrl);

  function handleDelete() {
    if (!vehicleId) return;
    Alert.alert(
      'Delete this build?',
      `This removes ${title} and every mod, photo, and wishlist item on it. You cannot undo this from the app.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete build',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            try {
              await deleteVehicle(vehicleId);
              router.replace('/(tabs)/garage');
            } catch (err) {
              const message =
                err instanceof Error ? err.message : 'Could not delete build';
              Alert.alert('Delete failed', message);
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  }

  if (authLoading || loading) {
    return (
      <View className="flex-1 items-center justify-center bg-apple-bg2">
        <Stack.Screen options={{ title: 'Edit build' }} />
        <ActivityIndicator color="#FF6A2B" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-apple-bg2"
    >
      <Stack.Screen options={{ title: 'Edit build' }} />
      <ScrollView contentContainerClassName="px-6 pt-6 pb-24">
        <Text className="text-apple-secondary">{title}</Text>
        <Text className="mt-1 text-xs text-apple-secondary">
          VIN, year, make, and model are fixed after you add the vehicle.
        </Text>

        <View className="mt-6">
          <CoverPhotoField
            previewUri={previewUri}
            onPick={handlePickCover}
            onRemove={handleRemoveCover}
          />
        </View>

        <View className="mt-8 gap-4">
          <Field label="Nickname (optional)">
            <TextInput
              value={nickname}
              onChangeText={setNickname}
              placeholder="Project Patrol"
              placeholderTextColor="#A1A1A6"
              className="rounded-xl border border-apple-border bg-white px-4 py-3 text-apple-ink"
            />
            <Text className="mt-1 text-xs text-apple-secondary">
              Shown on your garage card and build profile header.
            </Text>
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
                  Share link + feed eligible
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
                  Only you can open it
                </Text>
              </Pressable>
            </View>
          </Field>

          <Field label="For sale">
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => setIsForSale(true)}
                className={`flex-1 rounded-xl border px-4 py-3 ${
                  isForSale ? 'border-accent bg-accent/15' : 'border-apple-border bg-white'
                }`}
              >
                <Text
                  className={`text-center font-semibold ${
                    isForSale ? 'text-accent' : 'text-apple-secondary'
                  }`}
                >
                  Listed
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setIsForSale(false)}
                className={`flex-1 rounded-xl border px-4 py-3 ${
                  !isForSale ? 'border-accent bg-accent/15' : 'border-apple-border bg-white'
                }`}
              >
                <Text
                  className={`text-center font-semibold ${
                    !isForSale ? 'text-accent' : 'text-apple-secondary'
                  }`}
                >
                  Not for sale
                </Text>
              </Pressable>
            </View>
            {isForSale ? (
              <TextInput
                value={askingPrice}
                onChangeText={setAskingPrice}
                keyboardType="decimal-pad"
                placeholder="Asking price (AUD, optional)"
                placeholderTextColor="#A1A1A6"
                className="mt-3 rounded-xl border border-apple-border bg-white px-4 py-3 text-apple-ink"
              />
            ) : null}
          </Field>

          <Field label="Build value override (optional)">
            <TextInput
              value={manualValue}
              onChangeText={setManualValue}
              keyboardType="decimal-pad"
              placeholder="Your appraisal (AUD)"
              placeholderTextColor="#A1A1A6"
              className="rounded-xl border border-apple-border bg-white px-4 py-3 text-apple-ink"
            />
            <TextInput
              value={manualValueNote}
              onChangeText={setManualValueNote}
              placeholder="Note for buyers (optional)"
              placeholderTextColor="#A1A1A6"
              className="mt-2 rounded-xl border border-apple-border bg-white px-4 py-3 text-apple-ink"
            />
            <Text className="mt-1 text-xs text-apple-secondary">
              Overrides the automatic estimate on your public build page until you clear it.
            </Text>
          </Field>
        </View>

        <Pressable
          onPress={handleSave}
          disabled={submitting}
          className="mt-8 rounded-xl bg-accent py-3.5 active:bg-accent-dark disabled:opacity-60"
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-center text-base font-semibold text-white">
              Save changes
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={handleDelete}
          disabled={submitting}
          className="mt-6 rounded-xl border border-signal-red/40 py-3 active:bg-white disabled:opacity-60"
        >
          <Text className="text-center text-base font-semibold text-signal-red">
            Delete build
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
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
