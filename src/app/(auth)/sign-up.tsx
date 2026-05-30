import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountTypePicker } from '@/components/auth/AccountTypePicker';
import { OAuthButtons } from '@/components/OAuthButtons';
import { KeyboardSafeScrollView } from '@/components/ui/KeyboardSafeView';
import { accountTypeFromParam } from '@/lib/account-routing';
import { normalizeAuthEmail } from '@/lib/auth-account';
import { showAppAlert } from '@/lib/app-alert';
import { useAuth } from '@/lib/auth-context';
import type { AccountType } from '@/types/database';

export default function SignUpScreen() {
  const params = useLocalSearchParams<{ account?: string }>();
  const router = useRouter();
  const { signUpWithEmail } = useAuth();
  const [accountType, setAccountType] = useState<AccountType>(
    accountTypeFromParam(params.account)
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isWorkshop = accountType === 'workshop';

  async function handleSubmit() {
    if (!email.trim() || password.length < 8) {
      showAppAlert('Check your details', 'Use a real email and a password of 8+ characters.');
      return;
    }
    setSubmitting(true);
    try {
      const normalizedEmail = normalizeAuthEmail(email);
      const { session, needsEmailConfirmation } = await signUpWithEmail(
        normalizedEmail,
        password,
        { accountType }
      );

      if (session) {
        router.replace('/(auth)/onboarding');
        return;
      }

      if (needsEmailConfirmation) {
        router.replace({
          pathname: '/(auth)/verify-email',
          params: {
            email: normalizedEmail,
            account: accountType,
          },
        });
        return;
      }

      router.replace({
        pathname: '/(auth)/verify-email',
        params: {
          email: normalizedEmail,
          account: accountType,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not create account';
      showAppAlert('Sign-up failed', message);
    } finally {
      setSubmitting(false);
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
        <Text className="mt-2 text-3xl font-bold text-apple-ink">Create your account</Text>
        <Text className="mt-2 text-apple-secondary">
          Same app for builders and shops — pick a handle, then add your garage or business details on
          your profile.
        </Text>

        <AccountTypePicker value={accountType} onChange={setAccountType} />

        <View className="mt-6">
          <OAuthButtons disabled={submitting} accountType={accountType} />
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
              placeholder="At least 8 characters"
              placeholderTextColor="#A1A1A6"
              className="rounded-xl border border-apple-border bg-white px-4 py-3 text-base text-apple-ink"
            />
          </View>
        </View>

        <Pressable
          onPress={() => void handleSubmit()}
          disabled={submitting}
          className="mt-6 rounded-xl bg-accent py-3.5 active:bg-accent-dark disabled:opacity-60"
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-center text-base font-semibold text-white">Create account</Text>
          )}
        </Pressable>

        <View className="mt-6 flex-row justify-center">
          <Text className="text-apple-secondary">Have an account? </Text>
          <Link href={`/(auth)/sign-in${isWorkshop ? '?account=workshop' : ''}`}>
            <Text className="font-semibold text-accent">Sign in</Text>
          </Link>
        </View>
      </KeyboardSafeScrollView>
    </SafeAreaView>
  );
}
