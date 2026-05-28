import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, Text, View } from 'react-native';

import {
  signInWithApple,
  signInWithOAuthProvider,
  type OAuthProvider,
} from '@/lib/oauth';

type Props = {
  /** Disable the buttons while another auth action is in progress. */
  disabled?: boolean;
};

/**
 * Apple + Google sign-in row, shared by /sign-in and /sign-up. The
 * underlying flow is the same regardless of whether the user has an
 * account: Supabase OAuth provisions a user on first sign-in and signs
 * them in on subsequent attempts.
 */
export function OAuthButtons({ disabled }: Props) {
  const [working, setWorking] = useState<OAuthProvider | null>(null);

  async function handle(provider: OAuthProvider) {
    setWorking(provider);
    try {
      if (provider === 'apple') {
        await signInWithApple();
      } else {
        await signInWithOAuthProvider(provider);
      }
      // Successful auth lands in AuthProvider's onAuthStateChange and
      // the root layout redirects to the tabs.
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not sign in';
      Alert.alert(`${labelFor(provider)} sign-in failed`, message);
    } finally {
      setWorking(null);
    }
  }

  return (
    <View className="gap-2">
      {/* Apple — primary on iOS per Apple's HIG. */}
      {Platform.OS !== 'android' ? (
        <Pressable
          onPress={() => handle('apple')}
          disabled={disabled || working !== null}
          className="flex-row items-center justify-center gap-2 rounded-xl bg-white py-3 active:opacity-80 disabled:opacity-60"
        >
          {working === 'apple' ? (
            <ActivityIndicator color="#08090B" />
          ) : (
            <>
              <Text className="text-base"></Text>
              <Text className="text-base font-semibold text-ink-950">
                Continue with Apple
              </Text>
            </>
          )}
        </Pressable>
      ) : null}

      <Pressable
        onPress={() => handle('google')}
        disabled={disabled || working !== null}
        className="flex-row items-center justify-center gap-2 rounded-xl border border-ink-700 bg-ink-900 py-3 active:bg-ink-800 disabled:opacity-60"
      >
        {working === 'google' ? (
          <ActivityIndicator color="#F5A524" />
        ) : (
          <>
            <Text className="text-base font-bold text-accent">G</Text>
            <Text className="text-base font-semibold text-white">
              Continue with Google
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

function labelFor(p: OAuthProvider) {
  return p === 'apple' ? 'Apple' : 'Google';
}
