import { Stack } from 'expo-router';
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
import { supabase } from '@/lib/supabase';

export default function WorkshopProfileScreen() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workshopName, setWorkshopName] = useState('');
  const [workshopPhone, setWorkshopPhone] = useState('');
  const [workshopWebsite, setWorkshopWebsite] = useState('');
  const [isWorkshop, setIsWorkshop] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const { data, error } = await supabase
      .from('users')
      .select('is_workshop, workshop_name, workshop_phone, workshop_website')
      .eq('id', session.user.id)
      .maybeSingle();
    if (error) {
      Alert.alert('Error', error.message);
    } else if (data) {
      setIsWorkshop(!!data.is_workshop);
      setWorkshopName(data.workshop_name ?? '');
      setWorkshopPhone(data.workshop_phone ?? '');
      setWorkshopWebsite(data.workshop_website ?? '');
    }
    setLoading(false);
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    if (!session) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          is_workshop: isWorkshop,
          workshop_name: workshopName.trim() || null,
          workshop_phone: workshopPhone.trim() || null,
          workshop_website: workshopWebsite.trim() || null,
        })
        .eq('id', session.user.id);
      if (error) throw error;
      Alert.alert('Saved', 'Workshop profile updated.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save';
      Alert.alert('Save failed', message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-apple-bg2">
        <ActivityIndicator color="#FF6A2B" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-apple-bg2" contentContainerClassName="px-6 pb-12">
      <Stack.Screen options={{ title: 'Workshop profile' }} />
      <Text className="mt-4 text-apple-secondary">
        Workshops appear in the installer picker when builders log mods. Upgrade to the
        Workshop subscription tier for lead-gen perks (see Subscription).
      </Text>

      <Pressable
        onPress={() => setIsWorkshop((v) => !v)}
        className="mt-6 flex-row items-center gap-3"
      >
        <View
          className={`h-6 w-6 rounded border ${
            isWorkshop ? 'border-accent bg-accent' : 'border-apple-border'
          }`}
        />
        <Text className="text-apple-ink">List me as a workshop on the platform</Text>
      </Pressable>

      <Field label="Business name" value={workshopName} onChange={setWorkshopName} />
      <Field label="Phone" value={workshopPhone} onChange={setWorkshopPhone} />
      <Field
        label="Website"
        value={workshopWebsite}
        onChange={setWorkshopWebsite}
        placeholder="https://…"
      />

      <Pressable
        onPress={handleSave}
        disabled={saving}
        className="mt-8 rounded-xl bg-accent py-3.5 disabled:opacity-60"
      >
        {saving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text className="text-center font-semibold text-white">Save</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <View className="mt-4">
      <Text className="mb-2 text-xs uppercase tracking-wider text-apple-secondary">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#A1A1A6"
        autoCapitalize="none"
        className="rounded-xl border border-apple-border bg-white px-4 py-3 text-apple-ink"
      />
    </View>
  );
}
