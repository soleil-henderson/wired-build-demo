import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth-context';

export default function SignUpScreen() {
  const { signUpWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!email.trim() || password.length < 8) {
      Alert.alert('Check your details', 'Use a real email and a password of 8+ characters.');
      return;
    }
    setSubmitting(true);
    try {
      await signUpWithEmail(email.trim(), password);
      Alert.alert(
        'Almost there',
        'Check your inbox for a verification link, then sign in.'
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not create account';
      Alert.alert('Sign-up failed', message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-ink-950">
      <View className="flex-1 justify-center px-6">
        <Text className="text-accent text-sm font-semibold tracking-[3px]">WIRED BUILD</Text>
        <Text className="mt-2 text-3xl font-bold text-white">Start your build log</Text>
        <Text className="mt-2 text-ink-300">
          One account per person. Add your 4WD next.
        </Text>

        <View className="mt-8 gap-3">
          <View>
            <Text className="mb-2 text-xs uppercase tracking-wider text-ink-300">Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor="#5A6373"
              className="rounded-xl bg-ink-800 px-4 py-3 text-white"
            />
          </View>
          <View>
            <Text className="mb-2 text-xs uppercase tracking-wider text-ink-300">Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="At least 8 characters"
              placeholderTextColor="#5A6373"
              className="rounded-xl bg-ink-800 px-4 py-3 text-white"
            />
          </View>
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          className="mt-6 rounded-xl bg-accent py-3.5 active:bg-accent-dark disabled:opacity-60"
        >
          {submitting ? (
            <ActivityIndicator color="#08090B" />
          ) : (
            <Text className="text-center text-base font-semibold text-ink-950">Create account</Text>
          )}
        </Pressable>

        <View className="mt-6 flex-row justify-center">
          <Text className="text-ink-300">Have an account? </Text>
          <Link href="/(auth)/sign-in">
            <Text className="font-semibold text-accent">Sign in</Text>
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}
