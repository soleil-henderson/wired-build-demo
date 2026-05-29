import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth-context';
import { getMyProfile, normalizeHandle, updateProfile, validateHandle } from '@/lib/profile';

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
    <SafeAreaView className="flex-1 bg-ink-950">
      <Stack.Screen options={{ title: 'Welcome' }} />
      <View className="flex-1 justify-center px-6">
        <Text className="text-accent text-xs font-semibold tracking-[3px]">WELCOME</Text>
        <Text className="mt-2 text-3xl font-bold text-white">Set up your profile</Text>
        <Text className="mt-2 text-ink-300">
          Pick a handle and display name, then add your first 4WD to start logging mods.
        </Text>

        <View className="mt-8 gap-4">
          <View>
            <Text className="mb-2 text-xs uppercase tracking-wider text-ink-300">Handle</Text>
            <View className="flex-row items-center rounded-xl bg-ink-800 px-4">
              <Text className="text-ink-300">@</Text>
              <TextInput
                value={handle}
                onChangeText={(t) => setHandle(normalizeHandle(t))}
                autoCapitalize="none"
                placeholder="your_handle"
                placeholderTextColor="#5A6373"
                className="flex-1 py-3 pl-1 text-white"
              />
            </View>
          </View>
          <View>
            <Text className="mb-2 text-xs uppercase tracking-wider text-ink-300">
              Display name
            </Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Jamie Patterson"
              placeholderTextColor="#5A6373"
              className="rounded-xl bg-ink-800 px-4 py-3 text-white"
            />
          </View>
        </View>

        <Pressable
          onPress={handleContinue}
          disabled={submitting}
          className="mt-8 rounded-xl bg-accent py-3.5 active:bg-accent-dark disabled:opacity-60"
        >
          {submitting ? (
            <ActivityIndicator color="#08090B" />
          ) : (
            <Text className="text-center font-semibold text-ink-950">Continue → Add vehicle</Text>
          )}
        </Pressable>

        <Pressable onPress={handleSkip} className="mt-4 py-2">
          <Text className="text-center text-ink-300">Skip for now</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
