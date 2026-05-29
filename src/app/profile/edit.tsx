import { Stack, useRouter } from 'expo-router';
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

import {
  AvatarPhotoField,
  type PickedAvatarImage,
} from '@/components/AvatarPhotoField';
import { showAppAlert } from '@/lib/app-alert';
import { useAuth } from '@/lib/auth-context';
import {
  getMyProfile,
  normalizeHandle,
  updateProfile,
  validateHandle,
} from '@/lib/profile';
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [localAvatar, setLocalAvatar] = useState<PickedAvatarImage | null>(null);

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
      setAvatarUrl(p.avatar_url);
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
        nextAvatarUrl = await uploadAvatar({
          uri: localAvatar.uri,
          ownerId: liveSession.user.id,
          width: localAvatar.width,
          height: localAvatar.height,
        });
      }

      await updateProfile(liveSession.user.id, {
        handle: normalized,
        display_name: displayName.trim(),
        bio: bio.trim() || null,
        avatar_url: nextAvatarUrl,
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-apple-bg2"
    >
      <Stack.Screen options={{ title: 'Edit profile' }} />
      <ScrollView contentContainerClassName="px-6 pt-6 pb-24">
        <Text className="text-apple-secondary">
          Your handle is how people find you (@handle). Display name and bio
          show on your public profile and across the feed.
        </Text>

        <View className="mt-6">
          <AvatarPhotoField
            previewUri={previewUri}
            fallbackInitial={(displayName || handle || '?')[0].toUpperCase()}
            onPick={setLocalAvatar}
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

          <Field label="Bio">
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="What are you building?"
              placeholderTextColor="#A1A1A6"
              multiline
              numberOfLines={4}
              className="rounded-xl border border-apple-border bg-white px-4 py-3 text-apple-ink"
              style={{ minHeight: 96, textAlignVertical: 'top' }}
            />
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
