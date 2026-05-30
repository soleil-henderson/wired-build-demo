import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth-context';
import { pickStoryMedia } from '@/lib/stories';
import { colors } from '@/lib/theme';

export default function StoryCameraScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [mode, setMode] = useState<'picture' | 'video'>('picture');
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);

  const handleAllowCamera = useCallback(async () => {
    if (Platform.OS === 'web') {
      const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!lib.granted) {
        Alert.alert(
          'Permission needed',
          'On web, choose a photo or video from your library, or allow camera access in the browser when prompted.'
        );
      }
      const picked = await pickStoryMedia();
      if (picked) {
        router.replace({
          pathname: '/stories/create',
          params: {
            uri: picked.uri,
            type: picked.type ?? 'image',
            width: String(picked.width ?? 0),
            height: String(picked.height ?? 0),
            duration: picked.duration != null ? String(picked.duration) : '',
            mimeType: picked.mimeType ?? '',
          },
        });
      }
      return;
    }

    setRequestingPermission(true);
    try {
      const result = await requestCameraPermission();
      if (result.granted) return;

      if (!result.canAskAgain) {
        Alert.alert(
          'Camera access',
          'Enable camera for Wired Build in Settings to post stories.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => void Linking.openSettings(),
            },
          ]
        );
        return;
      }

      Alert.alert(
        'Camera access',
        'Camera permission is required to capture stories. Please allow access when prompted.'
      );
    } finally {
      setRequestingPermission(false);
    }
  }, [requestCameraPermission, router]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (cameraPermission && !cameraPermission.granted && cameraPermission.canAskAgain) {
      void handleAllowCamera();
    }
  }, [cameraPermission, handleAllowCamera]);

  if (!session) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <Text className="text-white">Sign in to post a story.</Text>
      </View>
    );
  }

  if (cameraPermission == null) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!cameraPermission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-black px-8">
        <Stack.Screen options={{ headerShown: false }} />
        <Pressable
          onPress={() => router.back()}
          className="absolute left-4 top-14 z-10 p-2"
          hitSlop={12}
        >
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
        <Text className="text-center text-lg font-semibold text-white">
          Camera access
        </Text>
        <Text className="mt-2 text-center text-white/70">
          {Platform.OS === 'web'
            ? 'Pick a photo or video from your library to post a story.'
            : 'Allow camera access to capture photos and videos for your story.'}
        </Text>
        <Pressable
          onPress={() => void handleAllowCamera()}
          disabled={requestingPermission}
          className="mt-6 rounded-xl bg-accent px-6 py-3.5 active:opacity-80 disabled:opacity-60"
        >
          {requestingPermission ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="font-semibold text-white">
              {Platform.OS === 'web' ? 'Choose from library' : 'Allow camera'}
            </Text>
          )}
        </Pressable>
        {Platform.OS !== 'web' && !cameraPermission.canAskAgain ? (
          <Pressable
            onPress={() => void Linking.openSettings()}
            className="mt-4 rounded-xl border border-white/30 px-5 py-3"
          >
            <Text className="font-semibold text-white">Open Settings</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  async function ensureMicForVideo() {
    if (micPermission?.granted) return true;
    const result = await requestMicPermission();
    if (result.granted) return true;
    if (!result.canAskAgain) {
      Alert.alert('Microphone', 'Enable microphone access in Settings for video stories.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => void Linking.openSettings() },
      ]);
    }
    return false;
  }

  function openComposer(asset: ImagePicker.ImagePickerAsset) {
    router.replace({
      pathname: '/stories/create',
      params: {
        uri: asset.uri,
        type: asset.type ?? 'image',
        width: String(asset.width ?? 0),
        height: String(asset.height ?? 0),
        duration: asset.duration != null ? String(asset.duration) : '',
        mimeType: asset.mimeType ?? '',
      },
    });
  }

  async function handleCapturePhoto() {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (photo?.uri) {
        openComposer({
          uri: photo.uri,
          width: photo.width,
          height: photo.height,
          type: 'image',
        });
      }
    } catch (err) {
      Alert.alert('Capture failed', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleVideo() {
    if (mode === 'picture') {
      const ok = await ensureMicForVideo();
      if (!ok) {
        Alert.alert('Microphone needed', 'Allow microphone access to record story videos.');
        return;
      }
      setMode('video');
      return;
    }
    setMode('picture');
  }

  async function handleRecordToggle() {
    if (!cameraRef.current || busy) return;

    if (recording) {
      setBusy(true);
      try {
        cameraRef.current.stopRecording();
      } catch {
        setRecording(false);
        setBusy(false);
      }
      return;
    }

    const ok = await ensureMicForVideo();
    if (!ok) {
      Alert.alert('Microphone needed', 'Allow microphone access to record story videos.');
      return;
    }

    setRecording(true);
    setBusy(true);
    try {
      const video = await cameraRef.current.recordAsync({ maxDuration: 60 });
      setRecording(false);
      if (video?.uri) {
        openComposer({
          uri: video.uri,
          width: 0,
          height: 0,
          type: 'video',
          duration: 60,
        });
      }
    } catch (err) {
      Alert.alert('Recording failed', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setRecording(false);
      setBusy(false);
    }
  }

  async function handlePickLibrary() {
    setBusy(true);
    try {
      const picked = await pickStoryMedia();
      if (picked) openComposer(picked);
    } catch (err) {
      Alert.alert('Library', err instanceof Error ? err.message : 'Could not open library.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="flex-1 bg-black">
      <Stack.Screen options={{ headerShown: false }} />
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing={facing} mode={mode} />

      <SafeAreaView className="absolute inset-x-0 top-0" edges={['top']}>
        <View className="flex-row items-center justify-between px-4 pt-2">
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={30} color="#fff" />
          </Pressable>
          <Pressable
            onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
            hitSlop={12}
          >
            <Ionicons name="camera-reverse-outline" size={28} color="#fff" />
          </Pressable>
        </View>
      </SafeAreaView>

      <SafeAreaView className="absolute inset-x-0 bottom-0" edges={['bottom']}>
        <View className="items-center pb-4">
          <View className="mb-5 flex-row rounded-full bg-black/40 p-1">
            <Pressable
              onPress={() => setMode('picture')}
              className={`rounded-full px-4 py-1.5 ${mode === 'picture' ? 'bg-white' : ''}`}
            >
              <Text
                className={`text-sm font-semibold ${mode === 'picture' ? 'text-black' : 'text-white'}`}
              >
                Photo
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void handleToggleVideo()}
              className={`rounded-full px-4 py-1.5 ${mode === 'video' ? 'bg-white' : ''}`}
            >
              <Text
                className={`text-sm font-semibold ${mode === 'video' ? 'text-black' : 'text-white'}`}
              >
                Video
              </Text>
            </Pressable>
          </View>

          <View className="flex-row items-center justify-center gap-10">
            <Pressable
              onPress={() => void handlePickLibrary()}
              disabled={busy}
              className="active:opacity-70"
            >
              <Ionicons name="images-outline" size={28} color="#fff" />
            </Pressable>

            <Pressable
              onPress={() => {
                if (mode === 'picture') void handleCapturePhoto();
                else void handleRecordToggle();
              }}
              disabled={busy}
              className="items-center justify-center"
            >
              <View
                className={`h-[74px] w-[74px] items-center justify-center rounded-full border-4 border-white ${
                  recording ? 'bg-red-500' : 'bg-transparent'
                }`}
              >
                {busy && !recording ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View
                    className={`${mode === 'video' ? 'rounded-md' : 'rounded-full'} bg-white`}
                    style={{
                      width: mode === 'video' && recording ? 28 : 58,
                      height: mode === 'video' && recording ? 28 : 58,
                    }}
                  />
                )}
              </View>
            </Pressable>

            <View className="w-7" />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
