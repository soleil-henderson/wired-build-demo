import * as ImagePicker from 'expo-image-picker';
import { Alert, Image, Pressable, Text, View } from 'react-native';

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
            exif: false,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 1,
            exif: false,
          });

    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    onPick({
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

  return (
    <Pressable onPress={showAvatarPicker} className="items-center active:opacity-80">
      <AvatarPreview previewUri={previewUri} fallbackInitial={fallbackInitial} />
      <Text className="mt-2 text-sm font-semibold text-accent">Change photo</Text>
    </Pressable>
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
