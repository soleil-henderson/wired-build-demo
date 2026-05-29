import { useRef } from 'react';
import { Alert, Image, Pressable, Text, View } from 'react-native';

import { imageDimensionsFromFile } from '@/lib/image-bytes';

export type PickedAvatarImage = {
  uri: string;
  width?: number;
  height?: number;
};

type Props = {
  previewUri: string | null;
  fallbackInitial: string;
  onPick: (image: PickedAvatarImage) => void;
};

export function AvatarPhotoField({ previewUri, fallbackInitial, onPick }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function applyFile(file: globalThis.File | undefined) {
    if (!file || !file.type.startsWith('image/')) {
      Alert.alert('Invalid file', 'Choose an image file (JPEG, PNG, etc.).');
      return;
    }
    try {
      const { width, height } = await imageDimensionsFromFile(file);
      onPick({
        uri: URL.createObjectURL(file),
        width,
        height,
      });
    } catch {
      Alert.alert('Could not load image', 'Try a different photo.');
    }
  }

  function openFilePicker() {
    inputRef.current?.click();
  }

  return (
    <View className="items-center">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          void applyFile(file);
          e.target.value = '';
        }}
      />

      <Pressable onPress={openFilePicker} className="items-center active:opacity-80">
        <AvatarPreview previewUri={previewUri} fallbackInitial={fallbackInitial} />
        <Text className="mt-2 text-sm font-semibold text-accent">Change photo</Text>
        <Text className="mt-1 text-xs text-apple-tertiary">Click to choose an image</Text>
      </Pressable>
    </View>
  );
}

function AvatarPreview({
  previewUri,
  fallbackInitial,
}: {
  previewUri: string | null;
  fallbackInitial: string;
}) {
  if (previewUri) {
    return (
      <Image
        source={{ uri: previewUri }}
        className="h-24 w-24 rounded-full bg-apple-bg2"
      />
    );
  }
  return (
    <View className="h-24 w-24 items-center justify-center rounded-full bg-apple-bg2">
      <Text className="text-3xl font-bold text-apple-secondary">{fallbackInitial}</Text>
    </View>
  );
}
