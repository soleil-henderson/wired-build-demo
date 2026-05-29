import * as ImagePicker from 'expo-image-picker';
import { Alert, Image, Pressable, Text, View } from 'react-native';

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
    onPick({
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
    });
  }

  function showCoverPicker() {
    const options: {
      text: string;
      onPress?: () => void;
      style?: 'cancel' | 'destructive';
    }[] = [
      { text: 'Take photo', onPress: () => pickCover('camera') },
      { text: 'Choose from library', onPress: () => pickCover('library') },
    ];
    if (previewUri) {
      options.push({
        text: 'Remove cover',
        style: 'destructive',
        onPress: onRemove,
      });
    }
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Cover photo', undefined, options);
  }

  return (
    <Pressable onPress={showCoverPicker} className="active:opacity-80">
      <CoverPreview previewUri={previewUri} />
      <Text className="mt-2 text-sm font-semibold text-accent">Change cover</Text>
    </Pressable>
  );
}

function CoverPreview({ previewUri }: { previewUri: string | null }) {
  if (previewUri) {
    return (
      <Image
        source={{ uri: previewUri }}
        className="h-40 w-full rounded-2xl bg-apple-bg2"
        resizeMode="cover"
      />
    );
  }
  return (
    <View className="h-40 w-full items-center justify-center rounded-2xl border border-dashed border-apple-border bg-white px-4">
      <Text className="text-center text-apple-secondary">No cover photo</Text>
    </View>
  );
}
