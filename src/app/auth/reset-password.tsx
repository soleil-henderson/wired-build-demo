import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { updatePassword } from '@/lib/auth-account';
import { colors } from '@/lib/theme';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (password.length < 8) {
      Alert.alert('Password too short', 'Use at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      await updatePassword(password);
      Alert.alert('Password updated', 'You can sign in with your new password.');
      router.replace('/(auth)/sign-in');
    } catch (err) {
      Alert.alert('Update failed', err instanceof Error ? err.message : 'Try again');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 justify-center bg-apple-bg2 px-6">
      <Text className="text-2xl font-bold text-apple-ink">Set a new password</Text>
      <Text className="mt-2 text-apple-secondary">
        Choose a new password for your Wired Build account.
      </Text>

      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="New password"
        placeholderTextColor={colors.tertiary}
        className="mt-6 rounded-xl border border-apple-border bg-white px-4 py-3 text-base text-apple-ink"
      />
      <TextInput
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        placeholder="Confirm password"
        placeholderTextColor={colors.tertiary}
        className="mt-3 rounded-xl border border-apple-border bg-white px-4 py-3 text-base text-apple-ink"
      />

      <Pressable
        onPress={() => void handleSave()}
        disabled={saving}
        className="mt-6 rounded-xl bg-accent py-3.5 disabled:opacity-60"
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-center font-semibold text-white">Save password</Text>
        )}
      </Pressable>
    </SafeAreaView>
  );
}
