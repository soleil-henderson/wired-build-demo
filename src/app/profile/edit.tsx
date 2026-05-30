import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  AvatarPhotoField,
  type PickedAvatarImage,
} from '@/components/AvatarPhotoField';
import { MentionTextInput } from '@/components/social/MentionTextInput';
import { KeyboardSafeScrollView } from '@/components/ui/KeyboardSafeView';
import { showAppAlert } from '@/lib/app-alert';
import { isWorkshopAccount } from '@/lib/account-routing';
import { useAuth } from '@/lib/auth-context';
import {
  getMyProfile,
  normalizeHandle,
  updateProfile,
  validateHandle,
} from '@/lib/profile';
import * as Location from 'expo-location';
import {
  formatUserLocation,
  mergeLocationCoords,
  parseUserLocation,
  serializeUserLocation,
} from '@/lib/user-location';
import { deleteMyAccount } from '@/lib/auth-account';
import { supabase } from '@/lib/supabase';
import {
  deleteStorageObjects,
  storageKeyFromModPhotoPublicUrl,
  uploadAvatar,
} from '@/lib/storage';

export default function EditProfileScreen() {
  const { session } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [localAvatar, setLocalAvatar] = useState<PickedAvatarImage | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isBusiness, setIsBusiness] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const p = await getMyProfile(session.user.id);
      if (!p) {
        Alert.alert('Profile missing', 'Could not load your profile row.');
        router.back();
        return;
      }
      setHandle(p.handle);
      setDisplayName(p.display_name);
      setBio(p.bio ?? '');
      const loc = parseUserLocation(p.location);
      setCity(loc?.city ?? '');
      setCountry(loc?.country ?? '');
      setAvatarUrl(p.avatar_url);
      setIsPrivate(!!p.is_private);
      setIsBusiness(isWorkshopAccount(p));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load profile';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, [session, router]);

  useEffect(() => {
    load();
  }, [load]);

  function handleAvatarPick(image: PickedAvatarImage) {
    if (
      Platform.OS === 'web' &&
      localAvatar?.uri?.startsWith('blob:') &&
      localAvatar.uri !== image.uri
    ) {
      URL.revokeObjectURL(localAvatar.uri);
    }
    setLocalAvatar(image);
  }

  async function handleSave() {
    if (!session) return;

    const {
      data: { session: liveSession },
    } = await supabase.auth.getSession();
    if (!liveSession) {
      showAppAlert('Sign in required', 'Your session expired. Sign in again to save changes.');
      return;
    }

    const normalized = normalizeHandle(handle);
    const handleErr = validateHandle(normalized);
    if (handleErr) {
      Alert.alert('Invalid handle', handleErr);
      return;
    }
    if (!displayName.trim()) {
      Alert.alert('Missing name', 'Enter a display name.');
      return;
    }

    setSubmitting(true);
    try {
      const previousAvatarKey =
        localAvatar && avatarUrl
          ? storageKeyFromModPhotoPublicUrl(avatarUrl)
          : null;

      let nextAvatarUrl = avatarUrl;
      if (localAvatar) {
        try {
          nextAvatarUrl = await uploadAvatar({
            uri: localAvatar.uri,
            ownerId: liveSession.user.id,
            width: localAvatar.width,
            height: localAvatar.height,
          });
        } catch (uploadErr) {
          const detail =
            uploadErr instanceof Error ? uploadErr.message : 'Upload failed';
          throw new Error(`Could not upload photo: ${detail}`);
        }
      }

      let location = serializeUserLocation(city, country);
      if (location && Platform.OS !== 'web') {
        const query = [city, country].filter(Boolean).join(', ');
        if (query) {
          try {
            const hits = await Location.geocodeAsync(query);
            if (hits[0]) {
              location = mergeLocationCoords(location, {
                lat: hits[0].latitude,
                lng: hits[0].longitude,
              });
            }
          } catch {
            // City/country still saved without coordinates.
          }
        }
      }

      await updateProfile(liveSession.user.id, {
        handle: normalized,
        display_name: displayName.trim(),
        bio: bio.trim() || null,
        avatar_url: nextAvatarUrl,
        location,
        is_private: isPrivate,
      });

      if (previousAvatarKey) {
        await deleteStorageObjects('mod-photos', [previousAvatarKey]);
      }

      router.back();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save profile';
      showAppAlert('Save failed', message);
    } finally {
      setSubmitting(false);
    }
  }

  const previewUri = localAvatar?.uri ?? avatarUrl;

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-apple-bg2">
        <Stack.Screen options={{ title: 'Edit profile' }} />
        <ActivityIndicator color="#FF6A2B" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Edit profile' }} />
      <KeyboardSafeScrollView className="flex-1 bg-apple-bg2" contentContainerClassName="px-6 pt-6">
        <Text className="text-apple-secondary">
          Your handle is how people find you (@handle). Display name and bio
          show on your public profile and across the feed.
        </Text>

        <View className="mt-6">
          <AvatarPhotoField
            previewUri={previewUri}
            fallbackInitial={(displayName || handle || '?')[0].toUpperCase()}
            onPick={handleAvatarPick}
          />
        </View>

        <View className="mt-8 gap-4">
          <Field label="Handle">
            <View className="flex-row items-center rounded-xl bg-apple-bg2 px-4">
              <Text className="text-apple-secondary">@</Text>
              <TextInput
                value={handle}
                onChangeText={(t) => setHandle(normalizeHandle(t))}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={30}
                placeholder="your_handle"
                placeholderTextColor="#A1A1A6"
                className="flex-1 py-3 pl-1 font-mono text-apple-ink"
              />
            </View>
            <Text className="mt-1 text-xs text-apple-secondary">
              3–30 chars, lowercase letters, numbers, underscores
            </Text>
          </Field>

          <Field label="Display name">
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Jamie Patterson"
              placeholderTextColor="#A1A1A6"
              className="rounded-xl border border-apple-border bg-white px-4 py-3 text-apple-ink"
            />
          </Field>

          {isBusiness ? (
            <Pressable
              onPress={() => router.push('/workshop/profile-edit')}
              className="rounded-xl border border-apple-border bg-white px-4 py-4 active:bg-apple-bg2"
            >
              <Text className="font-semibold text-apple-ink">Business details</Text>
              <Text className="mt-1 text-sm text-apple-secondary">
                Hours, address, portfolio, booking link, and more
              </Text>
            </Pressable>
          ) : null}

          <Field label="Bio">
            <MentionTextInput
              value={bio}
              onChangeText={setBio}
              placeholder="What are you building? Tag people with @handle"
              multiline
              numberOfLines={4}
              className="rounded-xl border border-apple-border bg-white px-4 py-3 text-apple-ink"
              style={{ minHeight: 96, textAlignVertical: 'top' }}
            />
            <Text className="mt-1 text-xs text-apple-secondary">
              Type @ to mention other accounts in your bio.
            </Text>
          </Field>

          <Field label="Location">
            <View className="flex-row gap-3">
              <TextInput
                value={city}
                onChangeText={setCity}
                placeholder="City"
                placeholderTextColor="#A1A1A6"
                className="flex-1 rounded-xl border border-apple-border bg-white px-4 py-3 text-apple-ink"
              />
              <TextInput
                value={country}
                onChangeText={setCountry}
                placeholder="Country"
                placeholderTextColor="#A1A1A6"
                className="flex-1 rounded-xl border border-apple-border bg-white px-4 py-3 text-apple-ink"
              />
            </View>
            <Text className="mt-1 text-xs text-apple-secondary">
              Shown on your public profile so others know where you&apos;re based.
            </Text>
          </Field>

          <View className="mt-2 rounded-xl border border-apple-border bg-white px-4 py-3.5">
            <View className="flex-row items-center justify-between">
              <View className="mr-3 flex-1">
                <Text className="text-base font-semibold text-apple-ink">Private account</Text>
                <Text className="mt-0.5 text-sm text-apple-secondary">
                  Only approved followers can see your posts. Others must request to follow you.
                </Text>
              </View>
              <Switch value={isPrivate} onValueChange={setIsPrivate} />
            </View>
          </View>
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
              Save profile
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => {
            Alert.alert(
              'Delete account?',
              'This removes your profile, vehicles, mods, and storage files. This cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    if (!session) return;
                    setSubmitting(true);
                    try {
                      await deleteMyAccount(session.user.id);
                      router.replace('/(auth)/sign-in');
                    } catch (err) {
                      const message =
                        err instanceof Error ? err.message : 'Could not delete account';
                      Alert.alert('Delete failed', message);
                    } finally {
                      setSubmitting(false);
                    }
                  },
                },
              ]
            );
          }}
          className="mt-6 rounded-xl border border-signal-red/40 py-3"
        >
          <Text className="text-center font-semibold text-signal-red">Delete account</Text>
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
