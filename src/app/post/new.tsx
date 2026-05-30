import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
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
import { useAuth } from '@/lib/auth-context';
import { createStandalonePost } from '@/lib/posts';
import { colors } from '@/lib/theme';

const MAX_MEDIA = 10;

type PendingMedia = {
  uri: string;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  kind: 'photo' | 'video';
};

export default function NewPostScreen() {
  const router = useRouter();
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const { session } = useAuth();

  const [media, setMedia] = useState<PendingMedia[]>([]);
  const [caption, setCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const addFromResult = useCallback((result: ImagePicker.ImagePickerResult) => {
    if (result.canceled) return;
    setMedia((current) => {
      const room = MAX_MEDIA - current.length;
      if (room <= 0) return current;
      const next = result.assets.slice(0, room).map((a) => ({
        uri: a.uri,
        width: a.width ?? null,
        height: a.height ?? null,
        mimeType: a.mimeType ?? null,
        kind: (a.type === 'video' ? 'video' : 'photo') as 'photo' | 'video',
      }));
      return [...current, ...next];
    });
  }, []);

  async function handlePickFromLibrary() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to attach media.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_MEDIA - media.length,
      videoMaxDuration: 60,
      quality: 0.85,
    });
    addFromResult(result);
  }

  async function handleTakePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow camera access to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    addFromResult(result);
  }

  function showMediaPicker() {
    Alert.alert('Add photos or video', undefined, [
      { text: 'Take photo', onPress: handleTakePhoto },
      { text: 'Choose from library', onPress: handlePickFromLibrary },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function handleSubmit() {
    if (!session) {
      Alert.alert('Not signed in', 'Sign in before posting.');
      return;
    }
    if (!vehicleId) {
      Alert.alert('Missing vehicle', 'Pick a vehicle first.');
      return;
    }
    if (media.length === 0) {
      Alert.alert('Add media', 'Share at least one photo or video.');
      return;
    }

    setSubmitting(true);
    try {
      const postId = await createStandalonePost({
        userId: session.user.id,
        vehicleId,
        body: caption.trim() || null,
        media,
      });
      router.replace(`/post/${postId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not publish post';
      Alert.alert('Post failed', message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'New post' }} />
      <KeyboardSafeScrollView
        className="flex-1 bg-apple-bg2"
        contentContainerClassName="px-4 pb-28 pt-2"
      >
        <Text className="mb-4 text-[15px] text-apple-secondary">
          Share photos or videos from the trail, garage, or road — no mod required.
        </Text>

        <Text className="mb-2 text-xs font-semibold uppercase tracking-[2px] text-apple-secondary">
          Photos & video
        </Text>
        <View className="mb-2 flex-row flex-wrap gap-2">
          {media.map((item, index) => (
            <View key={`${item.uri}-${index}`} className="relative">
              <Image
                source={{ uri: item.uri }}
                className="h-24 w-24 rounded-xl bg-apple-border"
                resizeMode="cover"
              />
              {item.kind === 'video' ? (
                <View className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5">
                  <Ionicons name="videocam" size={12} color="#fff" />
                </View>
              ) : null}
              <Pressable
                onPress={() => setMedia((current) => current.filter((_, i) => i !== index))}
                className="absolute -right-1 -top-1 h-6 w-6 items-center justify-center rounded-full border border-apple-border bg-apple-surface"
              >
                <Text className="text-xs font-bold text-apple-ink">×</Text>
              </Pressable>
            </View>
          ))}
          {media.length < MAX_MEDIA ? (
            <Pressable
              onPress={showMediaPicker}
              className="h-24 w-24 items-center justify-center rounded-xl border border-dashed border-apple-border bg-apple-surface active:bg-apple-bg2"
            >
              <Ionicons name="add" size={28} color={colors.accent} />
            </Pressable>
          ) : null}
        </View>
        <Text className="mb-4 text-xs text-apple-secondary">
          Up to {MAX_MEDIA} photos or clips · 60s max per video
        </Text>

        <Text className="mb-2 text-xs font-semibold uppercase tracking-[2px] text-apple-secondary">
          Caption
        </Text>
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder="Where were you? What happened on the trip?"
          placeholderTextColor={colors.tertiary}
          multiline
          numberOfLines={4}
          className="min-h-[100px] rounded-xl border border-apple-border bg-apple-surface px-4 py-3 text-apple-ink"
        />

        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          className="mt-8 rounded-xl bg-accent py-3.5 active:bg-accent-dark disabled:opacity-60"
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-center text-base font-semibold text-white">Share post</Text>
          )}
        </Pressable>
      </KeyboardSafeScrollView>
    </>
  );
}
