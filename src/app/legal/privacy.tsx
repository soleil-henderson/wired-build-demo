import { Stack } from 'expo-router';
import { ScrollView, Text } from 'react-native';

export default function PrivacyPolicyScreen() {
  return (
    <ScrollView className="flex-1 bg-apple-bg2" contentContainerClassName="px-6 py-8 pb-24">
      <Stack.Screen options={{ title: 'Privacy policy' }} />
      <Text className="text-2xl font-bold text-apple-ink">Privacy policy</Text>
      <Text className="mt-4 text-apple-secondary leading-6">
        Wired Build stores your account details, vehicle VIN and build history, mod photos,
        and optional receipt scans. Receipt images live in a private storage bucket visible
        only to you. Mod photos on public builds may be viewed by anyone.
      </Text>
      <Text className="mt-4 text-apple-secondary leading-6">
        VIN scans use on-device barcode or OCR processing where supported; we store the
        decoded 17-character string, not the camera frame.
      </Text>
      <Text className="mt-4 text-apple-secondary leading-6">
        Push notification tokens are stored to deliver social alerts. You can disable
        notification categories in Settings.
      </Text>
      <Text className="mt-4 text-apple-secondary text-sm">
        Contact: privacy@wiredautogroup.com — full legal text to be published before public
        launch.
      </Text>
    </ScrollView>
  );
}
