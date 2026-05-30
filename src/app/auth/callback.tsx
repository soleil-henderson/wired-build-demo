import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { resolvePostAuthRoute } from '@/lib/account-routing';
import { completeEmailConfirmationFromUrl } from '@/lib/auth-account';
import { getMyProfile } from '@/lib/profile';
import { completeOAuthFromCallbackUrl } from '@/lib/oauth';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

/**
 * Web OAuth return target (Google / Apple via Supabase).
 * Native apps use wiredbuilddemo://auth/callback instead.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        if (typeof window === 'undefined') {
          throw new Error('OAuth callback must run in a browser.');
        }
        const href = window.location.href;
        const emailConfirmed = await completeEmailConfirmationFromUrl(href);
        if (!emailConfirmed) {
          await completeOAuthFromCallbackUrl(href);
        }
        if (cancelled) return;
        const { data } = await supabase.auth.getSession();
        const userId = data.session?.user.id;
        if (userId) {
          const profile = await getMyProfile(userId);
          router.replace(resolvePostAuthRoute(profile));
        } else {
          router.replace('/(auth)/sign-in');
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Sign-in failed');
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <View className="flex-1 items-center justify-center bg-apple-bg2 px-8">
      {error ? (
        <>
          <Text className="text-center text-lg font-semibold text-apple-ink">Sign-in failed</Text>
          <Text className="mt-2 text-center text-apple-secondary">{error}</Text>
          <Pressable onPress={() => router.replace('/(auth)/sign-in')} className="mt-6">
            <Text className="text-center font-semibold text-accent">Back to sign in</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.accent} />
          <Text className="mt-4 text-apple-secondary">Finishing sign-in…</Text>
        </>
      )}
    </View>
  );
}
