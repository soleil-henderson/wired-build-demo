import { useRef, useState } from 'react';
import { Alert, Image, Pressable, Text, View, type ViewProps } from 'react-native';

import { imageDimensionsFromFile } from '@/lib/image-bytes';

export type PickedCoverImage = {
  uri: string;
  width?: number;
  height?: number;
};

type Props = {
  previewUri: string | null;
  onPick: (image: PickedCoverImage) => void;
  onRemove: () => void;
};

export function CoverPhotoField({ previewUri, onPick, onRemove }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

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

  const webDropHandlers = {
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(true);
    },
    onDragLeave: (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      const file = e.dataTransfer?.files?.[0];
      void applyFile(file);
    },
  } as ViewProps;

  return (
    <View {...webDropHandlers}>
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

      <Pressable
        onPress={openFilePicker}
        className={`active:opacity-90 ${dragOver ? 'opacity-90' : ''}`}
      >
        <View
          className={`overflow-hidden rounded-2xl ${
            dragOver ? 'ring-2 ring-accent' : ''
          }`}
        >
          <CoverPreview previewUri={previewUri} />
        </View>
        <Text className="mt-2 text-sm font-semibold text-accent">
          {dragOver ? 'Drop to set cover' : 'Click or drag an image here'}
        </Text>
        <Text className="mt-1 text-xs text-ink-400">JPEG or PNG · resized on save</Text>
      </Pressable>

      {previewUri ? (
        <Pressable onPress={onRemove} className="mt-3 self-start active:opacity-80">
          <Text className="text-sm font-semibold text-signal-red">Remove cover</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function CoverPreview({ previewUri }: { previewUri: string | null }) {
  if (previewUri) {
    return (
      <Image
        source={{ uri: previewUri }}
        className="h-40 w-full rounded-2xl bg-ink-800"
        resizeMode="cover"
      />
    );
  }
  return (
    <View className="h-40 w-full items-center justify-center rounded-2xl border border-dashed border-ink-600 bg-ink-900 px-4">
      <Text className="text-center text-ink-300">Drag and drop a cover photo</Text>
    </View>
  );
}
