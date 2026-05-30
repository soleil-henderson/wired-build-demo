import { Link, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { requestPasswordReset } from '@/lib/auth-account';
import { KeyboardSafeScrollView } from '@/components/ui/KeyboardSafeView';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    if (!email.trim()) {
      Alert.alert('Email required', 'Enter the address you signed up with.');
      return;
    }
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not send reset email';
      Alert.alert('Failed', message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-apple-bg2">
      <Stack.Screen options={{ title: 'Reset password' }} />
      <KeyboardSafeScrollView
        offsetHeader={false}
        className="flex-1"
        contentContainerClassName="flex-grow justify-center px-6 py-8"
      >
        <Text className="text-2xl font-bold text-apple-ink">Forgot password?</Text>
        <Text className="mt-2 text-apple-secondary">
          We&apos;ll email a link to reset your password. Check spam if it doesn&apos;t arrive.
        </Text>

        {sent ? (
          <Text className="mt-6 text-signal-green">
            If an account exists for that email, a reset link is on its way.
          </Text>
        ) : (
          <>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor="#A1A1A6"
              className="mt-6 rounded-xl bg-apple-bg2 px-4 py-3 text-base text-apple-ink"
            />
            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              className="mt-4 rounded-xl bg-accent py-3.5 active:bg-accent-dark disabled:opacity-60"
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-center font-semibold text-white">Send reset link</Text>
              )}
            </Pressable>
          </>
        )}

        <Link href="/(auth)/sign-in" className="mt-8">
          <Text className="text-center text-accent">Back to sign in</Text>
        </Link>
      </KeyboardSafeScrollView>
    </SafeAreaView>
  );
}
