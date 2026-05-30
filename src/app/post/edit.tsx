import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { KeyboardSafeScrollView } from '@/components/ui/KeyboardSafeView';

import { AppleCard } from '@/components/apple/AppleCard';
import { showAppAlert } from '@/lib/app-alert';
import { useAuth } from '@/lib/auth-context';
import { getPost, updatePost } from '@/lib/feed';
import { routeParam } from '@/lib/route-param';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

export default function EditPostScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = routeParam(params.id);
  const { session } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [body, setBody] = useState('');
  const [vehicleTitle, setVehicleTitle] = useState('');
  const [partLabel, setPartLabel] = useState<string | null>(null);
  const [modId, setModId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    try {
      const post = await getPost(id, session?.user.id ?? null);
      if (!post) {
        Alert.alert('Not found', 'This post is no longer available.');
        router.back();
        return;
      }
      const owner = session?.user.id === post.user_id;
      setIsOwner(owner);
      if (!owner) {
        Alert.alert('Not allowed', 'You can only edit your own posts.');
        router.back();
        return;
      }
      setBody(post.body ?? '');
      const title = post.vehicle.nickname ?? `${post.vehicle.make} ${post.vehicle.model}`;
      setVehicleTitle(`${title} · ${post.vehicle.year} ${post.vehicle.make} ${post.vehicle.model}`);
      setPartLabel(
        post.mod?.part
          ? `${post.mod.part.brand} ${post.mod.part.name}`
          : post.mod?.custom_part_name ?? null
      );
      setModId(post.mod?.id ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load post';
      Alert.alert('Error', message);
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, session, router]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    if (!id) return;

    const {
      data: { session: liveSession },
    } = await supabase.auth.getSession();
    if (!liveSession) {
      showAppAlert('Sign in required', 'Your session expired. Sign in again to save changes.');
      return;
    }

    setSubmitting(true);
    try {
      await updatePost(id, { body: body.trim() || null });
      router.back();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save post';
      showAppAlert('Save failed', message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-apple-bg2">
        <Stack.Screen options={{ title: 'Edit post' }} />
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!isOwner) {
    return null;
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Edit post' }} />
      <KeyboardSafeScrollView className="flex-1 bg-apple-bg2" contentContainerClassName="px-6 pt-6">
        <Text className="text-apple-secondary">
          {modId
            ? 'Update your caption or edit mod details like photos, cost, and product links.'
            : 'Update the caption on your photo post.'}
        </Text>

        <View className="mt-4">
          <Text className="text-xs uppercase tracking-wider text-apple-secondary">
            {modId ? 'Build' : 'Tagged vehicle'}
          </Text>
          <Text className="mt-1 text-sm font-medium text-apple-ink">{vehicleTitle}</Text>
        </View>

        {modId && partLabel ? (
          <AppleCard padded style={{ marginTop: 24 }}>
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-apple-bg2">
                <Ionicons name="pricetag-outline" size={18} color={colors.accent} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-xs font-semibold text-apple-secondary">Mod</Text>
                <Text className="text-[15px] font-semibold text-apple-ink" numberOfLines={2}>
                  {partLabel}
                </Text>
              </View>
              <Pressable
                onPress={() => router.push(`/log/edit?modId=${modId}`)}
                className="rounded-lg bg-accent-soft px-3 py-2 active:opacity-80"
              >
                <Text className="text-xs font-semibold text-accent">Edit mod</Text>
              </Pressable>
            </View>
            <Text className="mt-3 text-xs text-apple-secondary">
              Photos, install date, cost, privacy, and product links are edited on the mod screen.
            </Text>
          </AppleCard>
        ) : null}

        <View className="mt-8">
          <Text className="mb-2 text-xs uppercase tracking-wider text-apple-secondary">
            Caption
          </Text>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder={
              modId && partLabel
                ? `Installed ${partLabel}`
                : 'Say something about this photo…'
            }
            placeholderTextColor="#A1A1A6"
            multiline
            numberOfLines={5}
            maxLength={2000}
            className="rounded-xl border border-apple-border bg-white px-4 py-3 text-apple-ink"
            style={{ minHeight: 120, textAlignVertical: 'top' }}
          />
          <Text className="mt-1 text-xs text-apple-secondary">
            Leave blank to use the default caption in the feed.
          </Text>
        </View>

        <Pressable
          onPress={handleSave}
          disabled={submitting}
          className="mt-8 rounded-xl bg-accent py-3.5 active:bg-accent-dark disabled:opacity-60"
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-center text-base font-semibold text-white">Save post</Text>
          )}
        </Pressable>
      </KeyboardSafeScrollView>
    </>
  );
}
