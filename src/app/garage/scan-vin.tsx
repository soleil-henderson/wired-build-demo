import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { extractVinFromImage } from '@/lib/vin-ocr';
import {
  extractVinFromBarcode,
  setPendingVin,
  VIN_PATTERN,
} from '@/lib/vin-handoff';

/**
 * Full-screen camera that scans VIN barcodes (Code 39 / Code 128 / QR).
 * OCR fallback photographs the printed VIN when the barcode is damaged.
 */
export default function ScanVinScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [manualOpen, setManualOpen] = useState(false);
  const [manualValue, setManualValue] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  // Guards against the scanner firing 60 times/s for the same code while we
  // navigate away.
  const lockedRef = useRef(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleAccept = useCallback(
    (vin: string) => {
      if (lockedRef.current) return;
      lockedRef.current = true;
      setPendingVin(vin);
      router.back();
    },
    [router]
  );

  function handleBarcode(payload: string) {
    const vin = extractVinFromBarcode(payload);
    if (!vin) return;
    handleAccept(vin);
  }

  function handleManualSubmit() {
    const v = manualValue.trim().toUpperCase();
    if (!VIN_PATTERN.test(v)) {
      Alert.alert('Invalid VIN', 'Enter a 17-character VIN (no I, O, or Q).');
      return;
    }
    handleAccept(v);
  }

  async function handleVinOcr(source: 'camera' | 'library') {
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to read the VIN sticker.');
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });

    if (result.canceled || !result.assets[0]) return;

    setOcrLoading(true);
    try {
      const vin = await extractVinFromImage(result.assets[0].uri);
      if (vin) {
        handleAccept(vin);
        return;
      }
      Alert.alert(
        'Could not read VIN',
        'Try a clearer photo of the printed VIN line, or enter it manually.'
      );
    } finally {
      setOcrLoading(false);
    }
  }

  function showOcrPicker() {
    Alert.alert('Photograph VIN sticker', 'Use when the barcode is damaged or missing.', [
      { text: 'Take photo', onPress: () => handleVinOcr('camera') },
      { text: 'Choose from library', onPress: () => handleVinOcr('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-ink-950">
        <Stack.Screen options={{ title: 'Scan VIN' }} />
        <ActivityIndicator color="#F5A524" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-ink-950 px-6">
        <Stack.Screen options={{ title: 'Scan VIN' }} />
        <Text className="text-2xl font-bold text-white">Camera access needed</Text>
        <Text className="mt-2 text-center text-ink-300">
          Wired Build uses the camera to read the VIN barcode on your door jamb.
          We never store the photo — only the decoded 17-character string.
        </Text>
        <Pressable
          onPress={requestPermission}
          className="mt-6 rounded-xl bg-accent px-4 py-2.5 active:bg-accent-dark"
        >
          <Text className="font-semibold text-ink-950">Allow camera</Text>
        </Pressable>
        <Pressable onPress={showOcrPicker} disabled={ocrLoading} className="mt-4">
          {ocrLoading ? (
            <ActivityIndicator color="#F5A524" />
          ) : (
            <Text className="text-sm text-accent">Photograph VIN (OCR)</Text>
          )}
        </Pressable>
        <Pressable onPress={() => setManualOpen(true)} className="mt-2">
          <Text className="text-sm text-ink-300">Enter VIN manually</Text>
        </Pressable>
        {manualOpen ? (
          <ManualEntry
            value={manualValue}
            onChange={setManualValue}
            onSubmit={handleManualSubmit}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <Stack.Screen options={{ title: 'Scan VIN' }} />
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{
          // Door-jamb stickers in Australia / US use code39 most often.
          // 128 + qr cover the rest (luxury + newer models).
          barcodeTypes: ['code39', 'code128', 'qr'],
        }}
        onBarcodeScanned={({ data }) => handleBarcode(data)}
      >
        <View className="flex-1 justify-between p-6">
          <View />
          <View className="items-center">
            <View
              className="rounded-2xl border-2 border-accent"
              style={{ width: '92%', aspectRatio: 4 }}
            />
            <Text className="mt-4 text-center text-sm text-white">
              Hold the barcode inside the frame.{'\n'}
              On most 4WDs the VIN sticker is on the driver&apos;s door jamb.
            </Text>
          </View>
          <View className="items-center gap-3">
            <Pressable
              onPress={showOcrPicker}
              disabled={ocrLoading}
              className="rounded-xl border border-accent/60 bg-ink-900/90 px-4 py-2.5 active:bg-ink-800 disabled:opacity-60"
            >
              {ocrLoading ? (
                <ActivityIndicator color="#F5A524" />
              ) : (
                <Text className="font-semibold text-accent">
                  Photograph VIN (OCR fallback)
                </Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => setManualOpen((v) => !v)}
              className="rounded-xl bg-ink-900/90 px-4 py-2.5 active:bg-ink-800"
            >
              <Text className="font-semibold text-white">
                {manualOpen ? 'Hide manual entry' : 'Enter VIN manually'}
              </Text>
            </Pressable>
            {manualOpen ? (
              <ManualEntry
                value={manualValue}
                onChange={setManualValue}
                onSubmit={handleManualSubmit}
              />
            ) : null}
          </View>
        </View>
      </CameraView>
    </View>
  );
}

function ManualEntry({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <View className="w-full max-w-md gap-2">
      <TextInput
        value={value}
        onChangeText={(t) => onChange(t.toUpperCase())}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={17}
        placeholder="1HGCM82633A123456"
        placeholderTextColor="#5A6373"
        className="rounded-xl bg-ink-900/90 px-4 py-3 font-mono text-white"
      />
      <Pressable
        onPress={onSubmit}
        className="rounded-xl bg-accent px-4 py-3 active:bg-accent-dark"
      >
        <Text className="text-center font-semibold text-ink-950">
          Use this VIN
        </Text>
      </Pressable>
    </View>
  );
}
