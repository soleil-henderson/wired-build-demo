import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppleCard } from '@/components/apple/AppleCard';
import { AppleHeader } from '@/components/apple/AppleHeader';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { TAB_SCROLL_BOTTOM_INSET } from '@/lib/tab-screen-layout';
import { colors } from '@/lib/theme';
import { useFocusData } from '@/lib/use-focus-data';
import type { Database } from '@/types/database';

type Vehicle = Database['public']['Tables']['vehicles']['Row'];
type CreateMode = 'mod' | 'post';

export default function LogTabScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<CreateMode>('mod');

  useFocusData(
    async ({ isInitial }) => {
      if (!session) return;
      if (isInitial && vehicles.length === 0) setLoading(true);
      const { data } = await supabase
        .from('vehicles')
        .select('*')
        .eq('current_owner_id', session.user.id)
        .order('created_at', { ascending: false });
      setVehicles(data ?? []);
      setLoading(false);
    },
    [session, vehicles.length]
  );

  const modeCopy =
    mode === 'mod'
      ? {
          title: 'Log a mod',
          subtitle: 'Pick the vehicle this mod is going on.',
          cta: 'Log a mod →',
          route: (id: string) => `/log/new?vehicleId=${id}` as const,
        }
      : {
          title: 'Share a post',
          subtitle: 'Pick which vehicle to tag — photos, videos, and adventures.',
          cta: 'Create post →',
          route: (id: string) => `/post/new?vehicleId=${id}` as const,
        };

  return (
    <SafeAreaView className="flex-1 bg-apple-bg2" edges={['top']}>
      <AppleHeader title="Create" />
      <ScrollView
        contentContainerClassName="px-4 pt-2"
        contentContainerStyle={{ paddingBottom: TAB_SCROLL_BOTTOM_INSET }}
      >
        <View className="mb-5 flex-row gap-2">
          <ModeChip
            label="Log a mod"
            icon="construct-outline"
            active={mode === 'mod'}
            onPress={() => setMode('mod')}
          />
          <ModeChip
            label="Share photos"
            icon="images-outline"
            active={mode === 'post'}
            onPress={() => setMode('post')}
          />
        </View>

        <Text className="mb-4 text-[15px] text-apple-secondary">{modeCopy.subtitle}</Text>

        {loading && vehicles.length === 0 ? (
          <View className="mt-12 items-center">
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : vehicles.length === 0 ? (
          <AppleCard padded>
            <Text className="text-base font-semibold text-apple-ink">No vehicles yet</Text>
            <Text className="mt-1 text-apple-secondary">
              Add your vehicle first — mods and posts tag to your garage.
            </Text>
            <Pressable
              onPress={() => router.push('/garage/add-vehicle')}
              className="mt-4 self-start rounded-xl bg-accent px-4 py-2.5 active:opacity-90"
            >
              <Text className="font-semibold text-white">Add your vehicle</Text>
            </Pressable>
          </AppleCard>
        ) : (
          <View className="gap-3">
            {vehicles.map((v) => (
              <Pressable key={v.id} onPress={() => router.push(modeCopy.route(v.id))}>
                <AppleCard style={{ padding: 16 }}>
                  <Text className="text-xs font-medium text-apple-secondary">
                    {v.year} · {v.make} · {v.model}
                  </Text>
                  <Text
                    className="mt-1 text-xl font-bold text-apple-ink"
                    style={{ letterSpacing: -0.4 }}
                  >
                    {v.nickname ?? `${v.make} ${v.model}`}
                  </Text>
                  <Text className="mt-3 text-sm font-semibold text-accent">{modeCopy.cta}</Text>
                </AppleCard>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ModeChip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl border px-3 py-3 ${
        active ? 'border-accent bg-accent/10' : 'border-apple-border bg-apple-surface'
      }`}
    >
      <Ionicons name={icon} size={18} color={active ? colors.accent : colors.secondary} />
      <Text
        className={`text-sm font-semibold ${active ? 'text-accent' : 'text-apple-secondary'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
