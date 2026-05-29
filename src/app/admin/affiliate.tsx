import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/lib/auth-context';
import { isCurrentUserAdmin, updatePartAffiliate } from '@/lib/admin';
import { supabase } from '@/lib/supabase';
import type { Part } from '@/lib/parts';

export default function AffiliateAdminScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('Buy');

  const load = useCallback(async () => {
    if (!session) return;
    const admin = await isCurrentUserAdmin(session.user.id);
    setAllowed(admin);
    if (!admin) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('parts')
      .select('*')
      .order('brand')
      .limit(50);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setParts(data ?? []);
    }
    setLoading(false);
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(partId: string) {
    if (!url.trim()) {
      Alert.alert('URL required', 'Enter an affiliate URL.');
      return;
    }
    try {
      await updatePartAffiliate(partId, { url: url.trim(), label: label.trim() || 'Buy' });
      setEditingId(null);
      setUrl('');
      await load();
      Alert.alert('Saved', 'Affiliate link updated.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save';
      Alert.alert('Save failed', message);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-apple-bg2">
        <ActivityIndicator color="#FF6A2B" />
      </View>
    );
  }

  if (!allowed) {
    return (
      <View className="flex-1 bg-apple-bg2 px-6 pt-12">
        <Stack.Screen options={{ title: 'Affiliate links' }} />
        <Text className="text-apple-ink">Admin access required.</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-accent">Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-apple-bg2" contentContainerClassName="px-6 pb-12 pt-4">
      <Stack.Screen options={{ title: 'Affiliate links' }} />
      <Text className="text-apple-secondary">
        Set buy links on catalogue parts (admin only). Member tier uses enhanced rates in
        the part detail screen when configured.
      </Text>
      <View className="mt-6 gap-3">
        {parts.map((p) => (
          <View
            key={p.id}
            className="rounded-2xl border border-apple-border bg-white p-4"
          >
            <Text className="font-semibold text-apple-ink">
              {p.brand} {p.name}
            </Text>
            {editingId === p.id ? (
              <View className="mt-3 gap-2">
                <TextInput
                  value={url}
                  onChangeText={setUrl}
                  placeholder="https://…"
                  placeholderTextColor="#A1A1A6"
                  autoCapitalize="none"
                  className="rounded-xl border border-apple-border bg-white px-4 py-3 text-apple-ink"
                />
                <TextInput
                  value={label}
                  onChangeText={setLabel}
                  placeholder="Button label"
                  placeholderTextColor="#A1A1A6"
                  className="rounded-xl border border-apple-border bg-white px-4 py-3 text-apple-ink"
                />
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => handleSave(p.id)}
                    className="rounded-xl bg-accent px-4 py-2"
                  >
                    <Text className="font-semibold text-white">Save</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setEditingId(null)}
                    className="rounded-xl border border-apple-border px-4 py-2"
                  >
                    <Text className="text-apple-secondary">Cancel</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  setEditingId(p.id);
                  const links = p.affiliate_links as { url?: string; label?: string } | null;
                  setUrl(links?.url ?? '');
                  setLabel(links?.label ?? 'Buy');
                }}
                className="mt-2"
              >
                <Text className="text-sm text-accent">Edit affiliate link</Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
