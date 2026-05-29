import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth-context';
import { startIdentityVerification } from '@/lib/payments';
import { supabase } from '@/lib/supabase';

export default function VerifyScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase
      .from('users')
      .select('is_identity_verified')
      .eq('id', session.user.id)
      .maybeSingle();
    setVerified(!!data?.is_identity_verified);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleStart() {
    setLoading(true);
    try {
      await startIdentityVerification();
      Alert.alert(
        'Continue in browser',
        'Complete verification in the secure window. Return here when finished — status updates within a minute.'
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not start verification';
      Alert.alert('Verification', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-apple-bg2" contentContainerClassName="pb-12">
      <Stack.Screen options={{ title: 'Identity verification' }} />

      <View className="px-6 pt-6">
        <Text className="text-accent text-xs font-semibold tracking-[3px]">
          VERIFY
        </Text>
        <Text className="mt-1 text-3xl font-bold text-apple-ink">
          {verified ? "You're verified" : 'Get the verified tick'}
        </Text>
        <Text className="mt-2 text-apple-secondary">
          Verified accounts get a ✓ next to their name on every post, comment,
          and profile. It signals real-builder identity to buyers, sellers and
          workshops on the platform.
        </Text>

        {verified ? (
          <View className="mt-6 rounded-2xl border border-cyan-500/40 bg-cyan-500/10 p-5">
            <Text className="text-base font-semibold text-cyan-200">
              ✓ Identity verified
            </Text>
            <Text className="mt-1 text-sm text-cyan-100/80">
              The Verified badge is live on your public profile.
            </Text>
          </View>
        ) : (
          <View className="mt-6 rounded-2xl border border-apple-border bg-white p-5">
            <Text className="text-base font-semibold text-apple-secondary">
              What we&apos;ll ask for
            </Text>
            <View className="mt-3 gap-2">
              {[
                'A photo of your government-issued ID',
                'A short selfie to match the ID',
                'Your legal name and date of birth',
              ].map((row) => (
                <View key={row} className="flex-row gap-2">
                  <Text className="text-accent">·</Text>
                  <Text className="flex-1 text-sm text-apple-secondary">{row}</Text>
                </View>
              ))}
            </View>
            <Pressable
              onPress={handleStart}
              disabled={loading}
              className="mt-5 self-start rounded-xl bg-accent px-4 py-2.5 active:bg-accent-dark disabled:opacity-60"
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="font-semibold text-white">Start verification</Text>
              )}
            </Pressable>
          </View>
        )}

        <Pressable
          onPress={() => router.push('/profile/subscription')}
          className="mt-6 self-start"
        >
          <Text className="text-sm font-semibold text-accent">Subscription tiers →</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
