import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
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
import { uploadCoverPhoto } from '@/lib/storage';
import { getVehicleForEdit, updateVehicle } from '@/lib/vehicles';

type LocalCover = {
  uri: string;
  width?: number;
  height?: number;
};

export default function EditVehicleScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const { session } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState('');
  const [nickname, setNickname] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [localCover, setLocalCover] = useState<LocalCover | null>(null);
  const [removeCover, setRemoveCover] = useState(false);

  const load = useCallback(async () => {
    if (!vehicleId || !session) return;
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
      setCoverUrl(v.cover_photo_url);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load vehicle';
      Alert.alert('Error', message);
      router.back();
    } finally {
      setLoading(false);
    }
  }, [vehicleId, session, router]);

  useEffect(() => {
    load();
  }, [load]);

  async function pickCover(source: 'library' | 'camera') {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to set a cover image.');
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [16, 9],
            quality: 1,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [16, 9],
            quality: 1,
          });

    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setLocalCover({
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
    });
    setRemoveCover(false);
  }

  function showCoverPicker() {
    const options: { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }[] =
      [
        { text: 'Take photo', onPress: () => pickCover('camera') },
        { text: 'Choose from library', onPress: () => pickCover('library') },
      ];
    if (coverUrl || localCover) {
      options.push({
        text: 'Remove cover',
        style: 'destructive',
        onPress: () => {
          setLocalCover(null);
          setRemoveCover(true);
        },
      });
    }
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Cover photo', undefined, options);
  }

  async function handleSave() {
    if (!vehicleId || !session) return;

    setSubmitting(true);
    try {
      let nextCoverUrl = coverUrl;
      if (removeCover) {
        nextCoverUrl = null;
      } else if (localCover) {
        nextCoverUrl = await uploadCoverPhoto({
          uri: localCover.uri,
          ownerId: session.user.id,
          width: localCover.width,
          height: localCover.height,
        });
      }

      await updateVehicle(vehicleId, {
        nickname: nickname.trim() || null,
        cover_photo_url: nextCoverUrl,
        is_public: isPublic,
      });

      router.back();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save build';
      Alert.alert('Save failed', message);
    } finally {
      setSubmitting(false);
    }
  }

  const previewUri = removeCover ? null : (localCover?.uri ?? coverUrl);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-ink-950">
        <Stack.Screen options={{ title: 'Edit build' }} />
        <ActivityIndicator color="#F5A524" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-ink-950"
    >
      <Stack.Screen options={{ title: 'Edit build' }} />
      <ScrollView contentContainerClassName="px-6 pt-6 pb-24">
        <Text className="text-ink-300">{title}</Text>
        <Text className="mt-1 text-xs text-ink-300">
          VIN, year, make, and model are fixed after you add the vehicle.
        </Text>

        <Pressable
          onPress={showCoverPicker}
          className="mt-6 active:opacity-80"
        >
          {previewUri ? (
            <Image
              source={{ uri: previewUri }}
              className="h-40 w-full rounded-2xl bg-ink-800"
              resizeMode="cover"
            />
          ) : (
            <View className="h-40 w-full items-center justify-center rounded-2xl border border-dashed border-ink-600 bg-ink-900">
              <Text className="text-ink-300">No cover photo</Text>
            </View>
          )}
          <Text className="mt-2 text-sm font-semibold text-accent">Change cover</Text>
        </Pressable>

        <View className="mt-8 gap-4">
          <Field label="Nickname (optional)">
            <TextInput
              value={nickname}
              onChangeText={setNickname}
              placeholder="Project Patrol"
              placeholderTextColor="#5A6373"
              className="rounded-xl bg-ink-800 px-4 py-3 text-white"
            />
            <Text className="mt-1 text-xs text-ink-300">
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
                    : 'border-ink-700 bg-ink-900'
                }`}
              >
                <Text
                  className={`text-center font-semibold ${
                    isPublic ? 'text-accent' : 'text-ink-200'
                  }`}
                >
                  Public
                </Text>
                <Text className="mt-1 text-center text-xs text-ink-300">
                  Share link + feed eligible
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setIsPublic(false)}
                className={`flex-1 rounded-xl border px-4 py-3 ${
                  !isPublic
                    ? 'border-accent bg-accent/15'
                    : 'border-ink-700 bg-ink-900'
                }`}
              >
                <Text
                  className={`text-center font-semibold ${
                    !isPublic ? 'text-accent' : 'text-ink-200'
                  }`}
                >
                  Private
                </Text>
                <Text className="mt-1 text-center text-xs text-ink-300">
                  Only you can open it
                </Text>
              </Pressable>
            </View>
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
              Save changes
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
