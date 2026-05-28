import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/lib/auth-context';
import {
  getMyProfile,
  normalizeHandle,
  updateProfile,
  validateHandle,
} from '@/lib/profile';
import {
  deleteStorageObjects,
  storageKeyFromModPhotoPublicUrl,
  uploadAvatar,
} from '@/lib/storage';

type LocalAvatar = {
  uri: string;
  width?: number;
  height?: number;
};

export default function EditProfileScreen() {
  const { session } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [localAvatar, setLocalAvatar] = useState<LocalAvatar | null>(null);

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

  async function pickAvatar(source: 'library' | 'camera') {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to set your avatar.');
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 1,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 1,
          });

    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setLocalAvatar({
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
    });
  }

  function showAvatarPicker() {
    Alert.alert('Profile photo', undefined, [
      { text: 'Take photo', onPress: () => pickAvatar('camera') },
      { text: 'Choose from library', onPress: () => pickAvatar('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function handleSave() {
    if (!session) return;

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
          ownerId: session.user.id,
          width: localAvatar.width,
          height: localAvatar.height,
        });
      }

      await updateProfile(session.user.id, {
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
      Alert.alert('Save failed', message);
    } finally {
      setSubmitting(false);
    }
  }

  const previewUri = localAvatar?.uri ?? avatarUrl;

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-ink-950">
        <Stack.Screen options={{ title: 'Edit profile' }} />
        <ActivityIndicator color="#F5A524" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-ink-950"
    >
      <Stack.Screen options={{ title: 'Edit profile' }} />
      <ScrollView contentContainerClassName="px-6 pt-6 pb-24">
        <Text className="text-ink-300">
          Your handle is how people find you (@handle). Display name and bio
          show on your public profile and across the feed.
        </Text>

        <Pressable
          onPress={showAvatarPicker}
          className="mt-6 items-center active:opacity-80"
        >
          {previewUri ? (
            <Image
              source={{ uri: previewUri }}
              className="h-24 w-24 rounded-full bg-ink-800"
            />
          ) : (
            <View className="h-24 w-24 items-center justify-center rounded-full bg-ink-800">
              <Text className="text-3xl font-bold text-ink-300">
                {(displayName || handle || '?')[0].toUpperCase()}
              </Text>
            </View>
          )}
          <Text className="mt-2 text-sm font-semibold text-accent">Change photo</Text>
        </Pressable>

        <View className="mt-8 gap-4">
          <Field label="Handle">
            <View className="flex-row items-center rounded-xl bg-ink-800 px-4">
              <Text className="text-ink-300">@</Text>
              <TextInput
                value={handle}
                onChangeText={(t) => setHandle(normalizeHandle(t))}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={30}
                placeholder="your_handle"
                placeholderTextColor="#5A6373"
                className="flex-1 py-3 pl-1 font-mono text-white"
              />
            </View>
            <Text className="mt-1 text-xs text-ink-300">
              3–30 chars, lowercase letters, numbers, underscores
            </Text>
          </Field>

          <Field label="Display name">
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Jamie Patterson"
              placeholderTextColor="#5A6373"
              className="rounded-xl bg-ink-800 px-4 py-3 text-white"
            />
          </Field>

          <Field label="Bio">
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="What are you building?"
              placeholderTextColor="#5A6373"
              multiline
              numberOfLines={4}
              className="rounded-xl bg-ink-800 px-4 py-3 text-white"
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
            <ActivityIndicator color="#08090B" />
          ) : (
            <Text className="text-center text-base font-semibold text-ink-950">
              Save profile
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
