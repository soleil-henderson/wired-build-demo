import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text } from 'react-native';

import { signInWithOAuthProvider } from '@/lib/oauth';
import type { AccountType } from '@/types/database';
import { colors } from '@/lib/theme';

type Props = {
  /** Disable the buttons while another auth action is in progress. */
  disabled?: boolean;
  accountType?: AccountType;
};

/**
 * Google sign-in for /sign-in and /sign-up.
 * Apple Sign In is disabled until the Apple Developer Program is enrolled.
 */
export function OAuthButtons({ disabled, accountType = 'builder' }: Props) {
  const [working, setWorking] = useState(false);

  async function handleGoogle() {
    setWorking(true);
    try {
      await signInWithOAuthProvider('google', { accountType });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not sign in';
      Alert.alert('Google sign-in failed', message);
    } finally {
      setWorking(false);
    }
  }

  return (
    <Pressable
      onPress={() => void handleGoogle()}
      disabled={disabled || working}
      className="flex-row items-center justify-center gap-2 rounded-xl border border-apple-border bg-white py-3 active:bg-apple-bg2 disabled:opacity-60"
    >
      {working ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <>
          <Text className="text-base font-bold text-accent">G</Text>
          <Text className="text-base font-semibold text-apple-ink">Continue with Google</Text>
        </>
      )}
    </Pressable>
  );
}
