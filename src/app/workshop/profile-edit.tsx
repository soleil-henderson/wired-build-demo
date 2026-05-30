import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useAuth } from '@/lib/auth-context';
import { getMyProfile } from '@/lib/profile';
import {
  updateWorkshopProfile,
  WORKSHOP_BUSINESS_TYPES,
} from '@/lib/workshop-profile';
import { canManageWorkshopProfile } from '@/lib/subscription';
import { useSubscriptionTier } from '@/hooks/use-subscription-tier';

export default function WorkshopProfileEditScreen() {
  const { session } = useAuth();
  const { tier } = useSubscriptionTier();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workshopName, setWorkshopName] = useState('');
  const [contactName, setContactName] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [serviceArea, setServiceArea] = useState('');
  const [hours, setHours] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [businessType, setBusinessType] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    const p = await getMyProfile(session.user.id);
    if (p) {
      setWorkshopName(p.workshop_name ?? '');
      setContactName(p.workshop_contact_name ?? '');
      setBusinessEmail(p.workshop_business_email ?? p.email);
      setPhone(p.workshop_phone ?? '');
      setWebsite(p.workshop_website ?? '');
      setAddress(p.workshop_address ?? '');
      setServiceArea(p.workshop_service_area ?? '');
      setHours(p.workshop_hours ?? '');
      setTagline(p.workshop_tagline ?? '');
      setDescription(p.workshop_description ?? '');
      setBusinessType(p.workshop_business_type ?? '');
    }
    setLoading(false);
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    if (!session) return;
    if (!canManageWorkshopProfile(tier)) {
      router.push('/profile/subscription');
      return;
    }
    setSaving(true);
    try {
      await updateWorkshopProfile(session.user.id, {
        workshop_name: workshopName,
        workshop_contact_name: contactName,
        workshop_business_email: businessEmail,
        workshop_phone: phone,
        workshop_website: website || null,
        workshop_address: address || null,
        workshop_service_area: serviceArea || null,
        workshop_hours: hours || null,
        workshop_tagline: tagline || null,
        workshop_description: description || null,
        workshop_business_type: businessType || null,
        display_name: workshopName,
        bio: tagline || null,
      });
      Alert.alert('Saved', 'Business profile updated.');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save');
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
      <Stack.Screen options={{ title: 'Business profile' }} />
      <Field label="Business name" value={workshopName} onChange={setWorkshopName} />
      <Field label="Contact name" value={contactName} onChange={setContactName} />
      <Field label="Business email" value={businessEmail} onChange={setBusinessEmail} />
      <Field label="Phone" value={phone} onChange={setPhone} />
      <Field label="Website" value={website} onChange={setWebsite} />
      <Field label="Address" value={address} onChange={setAddress} />
      <Field label="Service area" value={serviceArea} onChange={setServiceArea} />
      <Field label="Hours" value={hours} onChange={setHours} />
      <Text className="mb-2 mt-2 text-xs uppercase tracking-wider text-apple-secondary">Type</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
        {WORKSHOP_BUSINESS_TYPES.map((t) => (
          <Pressable
            key={t}
            onPress={() => setBusinessType(t)}
            className={`mr-2 rounded-full border px-3 py-2 ${
              businessType === t ? 'border-accent bg-accent/10' : 'border-apple-border bg-white'
            }`}
          >
            <Text className={`text-sm ${businessType === t ? 'text-accent' : 'text-apple-ink'}`}>{t}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Field label="Tagline" value={tagline} onChange={setTagline} />
      <Field label="About" value={description} onChange={setDescription} multiline />
      <Pressable
        onPress={() => void handleSave()}
        disabled={saving}
        className="mt-4 rounded-xl bg-accent py-3.5 disabled:opacity-60"
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
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
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <View className="mb-3">
      <Text className="mb-2 text-xs uppercase tracking-wider text-apple-secondary">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        className={`rounded-xl border border-apple-border bg-white px-4 py-3 text-base text-apple-ink ${
          multiline ? 'min-h-[100px]' : ''
        }`}
        textAlignVertical={multiline ? 'top' : 'auto'}
      />
    </View>
  );
}
