import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { supabase } from '@/lib/supabase';

type PartClickRow = {
  part_id: string;
  brand: string;
  name: string;
  clicks: number;
};

export default function AdminPartClicksScreen() {
  const [rows, setRows] = useState<PartClickRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: clicks } = await supabase
      .from('part_clicks')
      .select('part_id')
      .order('created_at', { ascending: false })
      .limit(5000);

    const counts = new Map<string, number>();
    for (const c of clicks ?? []) {
      counts.set(c.part_id, (counts.get(c.part_id) ?? 0) + 1);
    }

    const partIds = [...counts.keys()].slice(0, 30);
    if (partIds.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const { data: parts } = await supabase
      .from('parts')
      .select('id, brand, name')
      .in('id', partIds);

    const ranked = (parts ?? [])
      .map((p) => ({
        part_id: p.id,
        brand: p.brand,
        name: p.name,
        clicks: counts.get(p.id) ?? 0,
      }))
      .sort((a, b) => b.clicks - a.clicks);

    setRows(ranked);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <ScrollView className="flex-1 bg-apple-bg2" contentContainerClassName="px-6 py-6 pb-12">
      <Stack.Screen options={{ title: 'Part clicks' }} />
      <Text className="text-accent text-xs font-semibold tracking-[3px]">ADMIN</Text>
      <Text className="mt-2 text-2xl font-bold text-apple-ink">Affiliate clicks (30d sample)</Text>
      <Text className="mt-2 text-sm text-apple-secondary">
        Internal BI — last 5,000 click events aggregated by part.
      </Text>

      {loading ? (
        <ActivityIndicator className="mt-8" color="#FF6A2B" />
      ) : rows.length === 0 ? (
        <Text className="mt-8 text-apple-secondary">No clicks recorded yet.</Text>
      ) : (
        <View className="mt-6 gap-2">
          {rows.map((r) => (
            <View
              key={r.part_id}
              className="flex-row items-center justify-between rounded-xl border border-apple-border bg-white px-4 py-3"
            >
              <Text className="flex-1 font-medium text-apple-ink">
                {r.brand} {r.name}
              </Text>
              <Text className="font-semibold text-accent">{r.clicks}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
