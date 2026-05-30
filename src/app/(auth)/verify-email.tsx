import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmailOtpForm } from '@/components/auth/EmailOtpForm';
import { KeyboardSafeScrollView } from '@/components/ui/KeyboardSafeView';
import { accountTypeFromParam } from '@/lib/account-routing';
import {
  normalizeAuthEmail,
  resendSignupConfirmation,
  verifySignupEmailOtp,
} from '@/lib/auth-account';
import { showAppAlert } from '@/lib/app-alert';

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{ email?: string; account?: string }>();
  const router = useRouter();
  const email = normalizeAuthEmail(
    (Array.isArray(params.email) ? params.email[0] : params.email) ?? ''
  );
  const accountType = accountTypeFromParam(params.account);
  const isWorkshop = accountType === 'workshop';

  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  async function afterVerified() {
    router.replace('/(auth)/onboarding');
  }

  async function handleVerify(code: string) {
    if (!email) {
      showAppAlert('Missing email', 'Go back and create your account again.');
      return;
    }
    setSubmitting(true);
    try {
      await verifySignupEmailOtp(email, code);
      await afterVerified();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not verify code';
      showAppAlert('Verification failed', message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (!email) return;
    setResending(true);
    try {
      await resendSignupConfirmation(email);
      showAppAlert('Code sent', `We sent a new code to ${email}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not resend code';
      showAppAlert('Resend failed', message);
    } finally {
      setResending(false);
    }
  }

  if (!email) {
    return (
      <SafeAreaView className="flex-1 bg-apple-bg2 px-6">
        <View className="flex-1 justify-center">
          <Text className="text-lg font-semibold text-apple-ink">No email on file</Text>
          <Text className="mt-2 text-apple-secondary">
            Start from sign up so we know where to send your code.
          </Text>
          <Link href="/(auth)/sign-up" asChild>
            <Pressable className="mt-6 self-start rounded-xl bg-accent px-4 py-2.5">
              <Text className="font-semibold text-white">Create account</Text>
            </Pressable>
          </Link>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-apple-bg2">
      <KeyboardSafeScrollView
        offsetHeader={false}
        className="flex-1"
        contentContainerClassName="flex-grow justify-center px-6 py-8"
      >
        <Text className="text-accent text-sm font-semibold tracking-[3px]">WIRED BUILD</Text>
        <Text className="mt-2 text-3xl font-bold text-apple-ink">Check your email</Text>
        <Text className="mt-2 text-apple-secondary">
          {isWorkshop
            ? 'Enter your code to finish creating your business account.'
            : 'Enter your code to finish creating your account — then set up your garage.'}
        </Text>

        <View className="mt-8">
          <EmailOtpForm
            email={email}
            submitting={submitting}
            resending={resending}
            onSubmit={(code) => void handleVerify(code)}
            onResend={() => void handleResend()}
          />
        </View>

        <View className="mt-8 flex-row justify-center">
          <Text className="text-apple-secondary">Wrong email? </Text>
          <Link
            href={
              isWorkshop ? '/(auth)/sign-up?account=workshop' : '/(auth)/sign-up'
            }
          >
            <Text className="font-semibold text-accent">Start over</Text>
          </Link>
        </View>
      </KeyboardSafeScrollView>
    </SafeAreaView>
  );
}
