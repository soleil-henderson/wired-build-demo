import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OAuthButtons } from '@/components/OAuthButtons';
import { useAuth } from '@/lib/auth-context';

export default function SignInScreen() {
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!email.trim() || !password) {
      Alert.alert('Missing details', 'Enter your email and password.');
      return;
    }
    setSubmitting(true);
    try {
      await signInWithEmail(email.trim(), password);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not sign in';
      Alert.alert('Sign-in failed', message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-ink-950">
      <View className="flex-1 justify-center px-6">
        <Text className="text-accent text-sm font-semibold tracking-[3px]">WIRED BUILD</Text>
        <Text className="mt-2 text-3xl font-bold text-white">Sign in to your garage</Text>
        <Text className="mt-2 text-ink-300">
          Log every mod against your VIN. Build a record that follows the car, not the owner.
        </Text>

        <View className="mt-6">
          <OAuthButtons disabled={submitting} />
        </View>

        <View className="my-6 flex-row items-center gap-3">
          <View className="h-px flex-1 bg-ink-700" />
          <Text className="text-xs uppercase tracking-wider text-ink-300">or email</Text>
          <View className="h-px flex-1 bg-ink-700" />
        </View>

        <View className="gap-3">
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
              placeholder="••••••••"
              placeholderTextColor="#5A6373"
              className="rounded-xl bg-ink-800 px-4 py-3 text-white"
            />
          </View>
          <Link href="/(auth)/forgot-password" className="self-end">
            <Text className="text-sm text-accent">Forgot password?</Text>
          </Link>
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          className="mt-6 rounded-xl bg-accent py-3.5 active:bg-accent-dark disabled:opacity-60"
        >
          {submitting ? (
            <ActivityIndicator color="#08090B" />
          ) : (
            <Text className="text-center text-base font-semibold text-ink-950">Sign in</Text>
          )}
        </Pressable>

        <View className="mt-6 flex-row justify-center">
          <Text className="text-ink-300">New here? </Text>
          <Link href="/(auth)/sign-up">
            <Text className="font-semibold text-accent">Create an account</Text>
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}
