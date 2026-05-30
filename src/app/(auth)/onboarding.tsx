import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isWorkshopAccount } from '@/lib/account-routing';
import { useAuth } from '@/lib/auth-context';
import { KeyboardSafeScrollView } from '@/components/ui/KeyboardSafeView';
import { getMyProfile, normalizeHandle, updateProfile, validateHandle } from '@/lib/profile';
import { seedWorkshopAccountFromOnboarding } from '@/lib/workshop-profile';

export default function OnboardingScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleContinue() {
    if (!session) return;
    const normalized = normalizeHandle(handle);
    const handleErr = validateHandle(normalized);
    if (handleErr) {
      Alert.alert('Invalid handle', handleErr);
      return;
    }
    if (!displayName.trim()) {
      Alert.alert('Display name', 'Enter how you want to appear on the feed.');
      return;
    }

    setSubmitting(true);
    try {
      const existing = await getMyProfile(session.user.id);
      await updateProfile(session.user.id, {
        handle: normalized,
        display_name: displayName.trim(),
        bio: existing?.bio ?? null,
        avatar_url: existing?.avatar_url ?? null,
      });

      const profile = await getMyProfile(session.user.id);
      if (isWorkshopAccount(profile)) {
        await seedWorkshopAccountFromOnboarding(session.user.id, {
          displayName: displayName.trim(),
          email: profile?.email ?? session.user.email ?? '',
        });
        router.replace('/(tabs)');
        return;
      }

      router.replace('/garage/add-vehicle');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save profile';
      Alert.alert('Error', message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleSkip() {
    router.replace('/(tabs)');
  }

  return (
    <SafeAreaView className="flex-1 bg-apple-bg2">
      <Stack.Screen options={{ title: 'Welcome' }} />
      <KeyboardSafeScrollView
        offsetHeader={false}
        className="flex-1"
        contentContainerClassName="flex-grow justify-center px-6 py-8"
      >
        <Text className="text-accent text-xs font-semibold tracking-[3px]">WELCOME</Text>
        <Text className="mt-2 text-3xl font-bold text-apple-ink">Set up your profile</Text>
        <Text className="mt-2 text-apple-secondary">
          Pick a handle and how you want to appear. You can add business details or a vehicle next.
        </Text>

        <View className="mt-8 gap-4">
          <View>
            <Text className="mb-2 text-xs uppercase tracking-wider text-apple-secondary">Handle</Text>
            <View className="flex-row items-center rounded-xl bg-apple-bg2 px-4">
              <Text className="text-apple-secondary">@</Text>
              <TextInput
                value={handle}
                onChangeText={(t) => setHandle(normalizeHandle(t))}
                autoCapitalize="none"
                placeholder="your_handle"
                placeholderTextColor="#A1A1A6"
                className="flex-1 py-3 pl-1 text-base text-apple-ink"
              />
            </View>
          </View>
          <View>
            <Text className="mb-2 text-xs uppercase tracking-wider text-apple-secondary">
              Display name
            </Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Jamie Patterson"
              placeholderTextColor="#A1A1A6"
              className="rounded-xl border border-apple-border bg-white px-4 py-3 text-base text-apple-ink"
            />
          </View>
        </View>

        <Pressable
          onPress={handleContinue}
          disabled={submitting}
          className="mt-8 rounded-xl bg-accent py-3.5 active:bg-accent-dark disabled:opacity-60"
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-center font-semibold text-white">Continue → Add vehicle</Text>
          )}
        </Pressable>

        <Pressable onPress={handleSkip} className="mt-4 py-2">
          <Text className="text-center text-apple-secondary">Skip for now</Text>
        </Pressable>
      </KeyboardSafeScrollView>
    </SafeAreaView>
  );
}
