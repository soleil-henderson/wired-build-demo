import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OAuthButtons } from '@/components/OAuthButtons';
import { AccountTypeSignInLinks } from '@/components/auth/AccountTypePicker';
import { KeyboardSafeScrollView } from '@/components/ui/KeyboardSafeView';
import { normalizeAuthEmail, resendSignupConfirmation } from '@/lib/auth-account';
import { showAppAlert } from '@/lib/app-alert';
import { useAuth } from '@/lib/auth-context';

export default function SignInScreen() {
  const router = useRouter();
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showVerifyHelp, setShowVerifyHelp] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleSubmit() {
    if (!email.trim() || !password) {
      showAppAlert('Missing details', 'Enter your email and password.');
      return;
    }
    setSubmitting(true);
    setShowVerifyHelp(false);
    try {
      await signInWithEmail(email.trim(), password);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not sign in';
      setShowVerifyHelp(true);
      showAppAlert('Sign-in failed', message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendVerification() {
    if (!email.trim()) {
      showAppAlert('Email required', 'Enter your email above first.');
      return;
    }
    setResending(true);
    try {
      await resendSignupConfirmation(email);
      showAppAlert(
        'Verification sent',
        'Check your inbox and spam folder for the confirmation link, then try signing in again.'
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not send email';
      showAppAlert('Resend failed', message);
    } finally {
      setResending(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-apple-bg2">
      <KeyboardSafeScrollView
        offsetHeader={false}
        className="flex-1"
        contentContainerClassName="flex-grow justify-center px-6 py-8"
      >
        <Text className="text-accent text-sm font-semibold tracking-[3px]">WIRED BUILD</Text>
        <Text className="mt-2 text-3xl font-bold text-apple-ink">Sign in to your garage</Text>
        <Text className="mt-2 text-apple-secondary">
          Log every mod against your VIN. Build a record that follows the car, not the owner.
        </Text>

        <View className="mt-6">
          <OAuthButtons disabled={submitting} />
        </View>

        <View className="my-6 flex-row items-center gap-3">
          <View className="h-px flex-1 bg-apple-bg2" />
          <Text className="text-xs uppercase tracking-wider text-apple-secondary">or email</Text>
          <View className="h-px flex-1 bg-apple-bg2" />
        </View>

        <View className="gap-3">
          <View>
            <Text className="mb-2 text-xs uppercase tracking-wider text-apple-secondary">Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor="#A1A1A6"
              className="rounded-xl border border-apple-border bg-white px-4 py-3 text-base text-apple-ink"
            />
          </View>
          <View>
            <Text className="mb-2 text-xs uppercase tracking-wider text-apple-secondary">Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor="#A1A1A6"
              className="rounded-xl border border-apple-border bg-white px-4 py-3 text-base text-apple-ink"
            />
          </View>
          <Link href="/(auth)/forgot-password" className="self-end">
            <Text className="text-sm text-accent">Forgot password?</Text>
          </Link>
        </View>

        {showVerifyHelp ? (
          <View className="mt-4 rounded-xl border border-apple-border bg-white p-4">
            <Text className="text-sm font-semibold text-apple-ink">Just signed up?</Text>
            <Text className="mt-1 text-sm text-apple-secondary">
              Enter the 6-digit code from your email, or resend a new one.
            </Text>
            <Pressable
              onPress={() => {
                if (!email.trim()) {
                  showAppAlert('Email required', 'Enter your email above first.');
                  return;
                }
                router.push({
                  pathname: '/(auth)/verify-email',
                  params: { email: normalizeAuthEmail(email) },
                });
              }}
              className="mt-3 self-start"
            >
              <Text className="text-sm font-semibold text-accent">Enter verification code</Text>
            </Pressable>
            <Pressable
              onPress={() => void handleResendVerification()}
              disabled={resending}
              className="mt-2 self-start"
            >
              {resending ? (
                <ActivityIndicator color="#FF6A2B" />
              ) : (
                <Text className="text-sm font-semibold text-accent">Resend code</Text>
              )}
            </Pressable>
          </View>
        ) : null}

        <Pressable
          onPress={() => void handleSubmit()}
          disabled={submitting}
          className="mt-6 rounded-xl bg-accent py-3.5 active:bg-accent-dark disabled:opacity-60"
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-center text-base font-semibold text-white">Sign in</Text>
          )}
        </Pressable>

        <View className="mt-6 flex-row justify-center">
          <Text className="text-apple-secondary">New here? </Text>
          <Link href="/(auth)/sign-up">
            <Text className="font-semibold text-accent">Create an account</Text>
          </Link>
        </View>

        <AccountTypeSignInLinks />
      </KeyboardSafeScrollView>
    </SafeAreaView>
  );
}
