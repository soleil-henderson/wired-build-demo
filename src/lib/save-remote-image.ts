import { ActionSheetIOS, Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';

export async function saveRemoteImageToDevice(imageUrl: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof document === 'undefined') {
      throw new Error('Saving images is not supported here.');
    }
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error('Could not download image');
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `wired-build-${Date.now()}.jpg`;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(objectUrl);
    return;
  }

  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Allow photo library access to save images.');
  }

  const ext = /\.png(\?|$)/i.test(imageUrl) ? 'png' : 'jpg';
  const localUri = `${FileSystem.cacheDirectory}wb-dm-${Date.now()}.${ext}`;
  const downloaded = await FileSystem.downloadAsync(imageUrl, localUri);
  await MediaLibrary.saveToLibraryAsync(downloaded.uri);
}

export function promptSaveDmImage(imageUrl: string): void {
  const runSave = () => {
    void saveRemoteImageToDevice(imageUrl)
      .then(() => {
        Alert.alert('Saved', Platform.OS === 'web' ? 'Image downloaded.' : 'Image saved to your photos.');
      })
      .catch((err) => {
        Alert.alert('Could not save', err instanceof Error ? err.message : 'Try again');
      });
  };

  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Save image', 'Cancel'], cancelButtonIndex: 1 },
      (index) => {
        if (index === 0) runSave();
      }
    );
    return;
  }

  Alert.alert('Image', undefined, [
    { text: 'Save image', onPress: runSave },
    { text: 'Cancel', style: 'cancel' },
  ]);
}
