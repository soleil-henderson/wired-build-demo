import { CameraView, useCameraPermissions } from 'expo-camera';
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

import {
  extractVinFromBarcode,
  setPendingVin,
  VIN_PATTERN,
} from '@/lib/vin-handoff';

/**
 * Full-screen camera that scans VIN barcodes (Code 39 / Code 128 / QR — the
 * three formats found on door-jamb stickers + windshield placards).
 *
 * Why not OCR: tier-1 VIN sources (door jamb + windshield placard) always
 * carry a barcode. Cameras decode it on-device in Expo Go, no model
 * download, no cloud round-trip, no privacy fine-print. OCR is a polish
 * follow-up if users complain about old/missing stickers.
 */
export default function ScanVinScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [manualOpen, setManualOpen] = useState(false);
  const [manualValue, setManualValue] = useState('');
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
        <Pressable onPress={() => setManualOpen(true)} className="mt-4">
          <Text className="text-sm text-accent">Enter VIN manually</Text>
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
