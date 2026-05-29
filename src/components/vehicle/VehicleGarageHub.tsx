import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  View,
} from 'react-native';

import { AppleCard } from '@/components/apple/AppleCard';
import {
  AppleChip,
  categoryColor,
  MoneyText,
} from '@/components/apple/ApplePrimitives';
import { SegmentedControl } from '@/components/apple/SegmentedControl';
import { showAppAlert } from '@/lib/app-alert';
import { listVehicleMods, type ModWithPart } from '@/lib/mods';
import { listPlanItems, type PlanItem } from '@/lib/plan-items';
import { publicBuildUrl } from '@/lib/public-build';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import {
  listVehicleWishlist,
  wishlistDisplayName,
  type WishlistItem,
} from '@/lib/wishlist';
import {
  deleteVehicleDocument,
  formatDocumentDate,
  listVehicleDocuments,
  openVehicleDocument,
  pickVehicleDocumentNative,
  uploadVehicleDocument,
  type VehicleDocument,
} from '@/lib/vehicle-documents';
import type { Database } from '@/types/database';

type Vehicle = Database['public']['Tables']['vehicles']['Row'];
type HubTab = 'plan' | 'mods' | 'spend' | 'docs';

type Props = {
  vehicleId: string;
};

/** Full vehicle hub — hero, stats, Plan / Mods / Spend / Docs tabs. */
export function VehicleGarageHub({ vehicleId }: Props) {
  const router = useRouter();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [mods, setMods] = useState<ModWithPart[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [tab, setTab] = useState<HubTab>('plan');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: v, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('id', vehicleId)
        .maybeSingle();
      if (error) throw error;
      setVehicle(v);

      if (!v) {
        setMods([]);
        setWishlist([]);
        setPlanItems([]);
        return;
      }

      const [modList, wishlistList, plans] = await Promise.all([
        listVehicleMods(vehicleId),
        listVehicleWishlist(vehicleId).catch(() => [] as WishlistItem[]),
        listPlanItems(vehicleId).catch(() => [] as PlanItem[]),
      ]);
      setMods(modList);
      setWishlist(wishlistList);
      setPlanItems(plans);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load vehicle';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [vehicleId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const plannedTotal = useMemo(
    () =>
      wishlist.reduce((sum, w) => sum + Number(w.target_cost ?? 0), 0) +
      planItems.reduce((sum, p) => sum + Number(p.target_cost ?? 0), 0),
    [wishlist, planItems]
  );

  const spendByCat = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of mods) {
      const label = m.category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      map.set(label, (map.get(label) ?? 0) + Number(m.cost ?? 0));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [mods]);

  async function handleShare() {
    if (!vehicle?.is_public) {
      Alert.alert('Private build', 'Make this build public to share a link.');
      return;
    }
    const url = publicBuildUrl(vehicle.id);
    await Share.share({ message: url, url });
  }

  const title = vehicle?.nickname ?? (vehicle ? `${vehicle.make} ${vehicle.model}` : 'Vehicle');

  if (loading && !vehicle) {
    return (
      <View className="flex-1 items-center justify-center bg-apple-bg2">
        <Stack.Screen options={{ title: 'Vehicle' }} />
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!vehicle) {
    return (
      <View className="flex-1 items-center justify-center bg-apple-bg2 px-6">
        <Stack.Screen options={{ title: 'Not found' }} />
        <Text className="text-center text-apple-secondary">This vehicle is not available.</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="font-semibold text-accent">Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-apple-bg2"
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={
        <RefreshControl
          tintColor={colors.accent}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
        />
      }
      stickyHeaderIndices={[1]}
    >
      <Stack.Screen options={{ title }} />

      <View className="bg-white pb-3">
        <View className="flex-row items-center justify-between px-4 pb-3 pt-2">
          <Text className="text-[13px] font-semibold text-apple-secondary">My Garage</Text>
          <View className="flex-row gap-4">
            <Pressable onPress={handleShare} hitSlop={8}>
              <Ionicons name="share-outline" size={20} color={colors.blue} />
            </Pressable>
            <Pressable
              onPress={() => router.push(`/vehicle/edit?vehicleId=${vehicle.id}`)}
              hitSlop={8}
            >
              <Ionicons name="settings-outline" size={20} color={colors.secondary} />
            </Pressable>
          </View>
        </View>

        {vehicle.cover_photo_url ? (
          <Image
            source={{ uri: vehicle.cover_photo_url }}
            className="mx-4 mb-4 aspect-[16/9] rounded-[18px] bg-apple-bg2"
            resizeMode="cover"
          />
        ) : (
          <View
            className="mx-4 mb-4 aspect-[16/9] items-center justify-center rounded-[18px]"
            style={{ backgroundColor: `${colors.accent}12` }}
          >
            <Ionicons name="car-sport-outline" size={72} color={colors.accent} />
          </View>
        )}

        <View className="px-4">
          <Text
            className="text-[28px] font-bold text-apple-ink"
            style={{ letterSpacing: -0.84 }}
          >
            {vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`}
          </Text>
          <View className="mt-1 flex-row flex-wrap items-center gap-2">
            <Text className="text-[15px] text-apple-secondary">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </Text>
            {vehicle.trim ? <AppleChip>{vehicle.trim}</AppleChip> : null}
          </View>

          <View className="mt-4 flex-row gap-2.5">
            <StatPill label="Spent" value={`$${(Number(vehicle.total_spend) / 1000).toFixed(1)}k`} />
            <StatPill
              label="Value"
              value={
                vehicle.build_value
                  ? `$${(Number(vehicle.build_value) / 1000).toFixed(1)}k`
                  : '—'
              }
              highlight
            />
            <StatPill label="Mods" value={String(mods.length)} />
            <StatPill
              label="Planned"
              value={plannedTotal > 0 ? `$${(plannedTotal / 1000).toFixed(0)}k` : '—'}
              amber
            />
          </View>
        </View>
      </View>

      <View className="border-b border-apple-border bg-white px-4 pb-3 pt-1">
        <SegmentedControl
          options={[
            { id: 'plan', label: 'Plan' },
            { id: 'mods', label: 'Mods' },
            { id: 'spend', label: 'Spend' },
            { id: 'docs', label: 'Docs' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      <View className="px-4 pt-4">
        {tab === 'plan' ? (
          <PlanTab
            wishlist={wishlist}
            planItems={planItems}
            plannedTotal={plannedTotal}
            vehicleId={vehicle.id}
            onAdd={() => router.push(`/wishlist/new?vehicleId=${vehicle.id}`)}
          />
        ) : null}
        {tab === 'mods' ? <ModsTab mods={mods} /> : null}
        {tab === 'spend' ? (
          <SpendTab
            total={Number(vehicle.total_spend)}
            mods={mods}
            spendByCat={spendByCat}
          />
        ) : null}
        {tab === 'docs' ? <DocsTab vehicleId={vehicle.id} /> : null}
      </View>
    </ScrollView>
  );
}

function StatPill({
  label,
  value,
  highlight,
  amber,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  amber?: boolean;
}) {
  const valueColor = highlight ? colors.accent : amber ? colors.amber : colors.ink;
  return (
    <View className="flex-1 rounded-[14px] bg-apple-bg2 px-2 py-3">
      <Text
        className="text-center text-xl font-bold"
        style={{ color: valueColor, letterSpacing: -0.4, fontVariant: ['tabular-nums'] }}
      >
        {value}
      </Text>
      <Text className="mt-0.5 text-center text-xs font-medium text-apple-secondary">{label}</Text>
    </View>
  );
}

function PlanTab({
  wishlist,
  planItems,
  plannedTotal,
  vehicleId,
  onAdd,
}: {
  wishlist: WishlistItem[];
  planItems: PlanItem[];
  plannedTotal: number;
  vehicleId: string;
  onAdd: () => void;
}) {
  const router = useRouter();
  const activeWishlist = wishlist.filter((w) => w.priority === 'high' || w.priority === 'medium');
  const someday = wishlist.filter((w) => w.priority === 'low');

  return (
    <View>
      <AppleCard
        style={{
          padding: 18,
          marginBottom: 16,
          backgroundColor: colors.accentSoft,
        }}
      >
        <View className="mb-2 flex-row items-center gap-2">
          <Ionicons name="locate-outline" size={16} color={colors.accent} />
          <Text className="text-[13px] font-semibold text-accent">Build Plan</Text>
        </View>
        <MoneyText value={plannedTotal} size={30} weight="700" />
        <Text className="mt-1 text-sm text-apple-secondary">
          {wishlist.length + planItems.length} items planned
        </Text>
      </AppleCard>

      <Pressable onPress={onAdd}>
        <AppleCard style={{ padding: 14, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            className="h-9 w-9 items-center justify-center rounded-[10px]"
            style={{ backgroundColor: colors.accentSoft }}
          >
            <Ionicons name="add" size={20} color={colors.accent} />
          </View>
          <View className="flex-1">
            <Text className="text-[15px] font-semibold text-apple-ink">Add something to your list</Text>
            <Text className="text-[13px] text-apple-secondary">Search parts or add custom</Text>
          </View>
          <Ionicons name="link-outline" size={18} color={colors.tertiary} />
        </AppleCard>
      </Pressable>

      {activeWishlist.length > 0 ? (
        <View className="mb-6">
          <Text className="mb-3 text-[13px] font-semibold text-accent">Up next</Text>
          {activeWishlist.map((item) => (
            <WishlistRow
              key={item.id}
              item={item}
              onPress={() => router.push(`/log/new?vehicleId=${vehicleId}&wishlistId=${item.id}`)}
            />
          ))}
        </View>
      ) : null}

      {planItems.length > 0 ? (
        <View className="mb-6">
          <Text className="mb-3 text-[13px] font-semibold text-apple-secondary">Plan items</Text>
          {planItems.map((p) => (
            <AppleCard key={p.id} style={{ padding: 14, marginBottom: 10 }}>
              <Text className="text-base font-semibold text-apple-ink">{p.title}</Text>
              {p.target_cost != null ? (
                <MoneyText value={Number(p.target_cost)} size={16} color={colors.accent} weight="700" />
              ) : null}
            </AppleCard>
          ))}
        </View>
      ) : null}

      {someday.length > 0 ? (
        <View>
          <Text className="mb-3 text-[13px] font-semibold text-apple-tertiary">Wishlist</Text>
          {someday.map((item) => (
            <WishlistRow key={item.id} item={item} onPress={onAdd} />
          ))}
        </View>
      ) : null}

      {wishlist.length === 0 && planItems.length === 0 ? (
        <AppleCard padded>
          <Text className="text-apple-secondary">Nothing planned yet — add your next upgrade.</Text>
        </AppleCard>
      ) : null}
    </View>
  );
}

function WishlistRow({ item, onPress }: { item: WishlistItem; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <AppleCard style={{ padding: 14, marginBottom: 10 }}>
        <View className="flex-row items-start gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-xl bg-apple-bg2">
            <Ionicons name="construct-outline" size={20} color={colors.secondary} />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-xs font-semibold text-apple-secondary">
              {item.part?.brand ?? 'Custom'}
            </Text>
            <Text className="text-base font-semibold text-apple-ink">{wishlistDisplayName(item)}</Text>
            {item.target_cost != null ? (
              <View className="mt-2">
                <MoneyText value={Number(item.target_cost)} size={16} color={colors.accent} weight="700" />
              </View>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.tertiary} />
        </View>
      </AppleCard>
    </Pressable>
  );
}

function ModsTab({ mods }: { mods: ModWithPart[] }) {
  if (mods.length === 0) {
    return (
      <AppleCard padded>
        <Text className="text-apple-secondary">No mods logged yet.</Text>
      </AppleCard>
    );
  }

  return (
    <View>
      {mods.map((mod) => {
        const d = new Date(mod.install_date);
        const partName = mod.part ? `${mod.part.brand} ${mod.part.name}` : mod.custom_part_name ?? 'Mod';
        return (
          <AppleCard key={mod.id} style={{ padding: 16, marginBottom: 12 }}>
            <View className="flex-row gap-3">
              <View className="h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-apple-bg2">
                <Text className="text-lg font-bold text-apple-ink">{d.getDate()}</Text>
                <Text className="text-[11px] font-semibold text-apple-secondary">
                  {d.toLocaleDateString(undefined, { month: 'short' })}
                </Text>
              </View>
              <View className="min-w-0 flex-1">
                <View className="mb-1 flex-row items-center justify-between">
                  <AppleChip>{mod.category.replace(/_/g, ' ')}</AppleChip>
                </View>
                <Text className="text-xs font-semibold text-apple-secondary">
                  {mod.part?.brand ?? 'Custom'}
                </Text>
                <Text className="text-[17px] font-semibold text-apple-ink" style={{ letterSpacing: -0.17 }}>
                  {partName}
                </Text>
                <View className="mt-3 flex-row items-center gap-4 border-t border-apple-border pt-3">
                  {mod.cost != null ? (
                    <View>
                      <Text className="text-xs text-apple-secondary">Cost</Text>
                      <MoneyText value={Number(mod.cost)} size={16} color={colors.accent} weight="700" />
                    </View>
                  ) : null}
                  <View>
                    <Text className="text-xs text-apple-secondary">Installed by</Text>
                    <Text className="text-sm font-semibold capitalize text-apple-ink">
                      {mod.installer_type.replace(/_/g, ' ')}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </AppleCard>
        );
      })}
    </View>
  );
}

function SpendTab({
  total,
  mods,
  spendByCat,
}: {
  total: number;
  mods: ModWithPart[];
  spendByCat: [string, number][];
}) {
  const modCount = mods.length;
  const catTotal = spendByCat.reduce((s, [, v]) => s + v, 0) || total;
  const monthsSpan = useMemo(() => computeModMonthsSpan(mods), [mods]);

  const subtitle =
    modCount === 0
      ? 'Log mods to track spend'
      : monthsSpan != null
        ? `across ${modCount} mod${modCount === 1 ? '' : 's'} over ${monthsSpan} month${monthsSpan === 1 ? '' : 's'}`
        : `across ${modCount} mod${modCount === 1 ? '' : 's'}`;

  return (
    <View>
      <AppleCard style={{ padding: 20, marginBottom: 12 }}>
        <Text className="text-[13px] font-medium text-apple-secondary">Total invested</Text>
        <MoneyText value={total} size={34} weight="700" color={colors.ink} />
        <Text className="mb-5 mt-1 text-[15px] text-apple-secondary">{subtitle}</Text>

        {spendByCat.length > 0 ? (
          <View className="flex-row overflow-hidden" style={{ height: 10, borderRadius: 5 }}>
            {spendByCat.map(([cat, value], i) => (
              <View
                key={cat}
                style={{
                  flex: value / catTotal,
                  backgroundColor: categoryColor(i),
                  marginRight: i < spendByCat.length - 1 ? 2 : 0,
                }}
              />
            ))}
          </View>
        ) : null}
      </AppleCard>

      {spendByCat.length > 0 ? (
        <AppleCard style={{ padding: 0, overflow: 'hidden' }}>
          {spendByCat.map(([cat, value], i) => {
            const pct = catTotal > 0 ? Math.round((value / catTotal) * 100) : 0;
            const tint = categoryColor(i);
            return (
              <View
                key={cat}
                className={`flex-row items-center gap-3.5 px-4 py-4 ${
                  i < spendByCat.length - 1 ? 'border-b border-apple-border' : ''
                }`}
              >
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: tint }} />
                <View className="min-w-0 flex-1">
                  <Text className="text-[17px] font-semibold text-apple-ink" style={{ letterSpacing: -0.17 }}>
                    {cat}
                  </Text>
                  <Text className="mt-0.5 text-[13px] text-apple-secondary">{pct}% of total</Text>
                </View>
                <MoneyText value={value} size={17} weight="700" color={colors.ink} />
              </View>
            );
          })}
        </AppleCard>
      ) : (
        <AppleCard padded>
          <Text className="font-semibold text-apple-ink">No spend data yet</Text>
          <Text className="mt-1 text-sm text-apple-secondary">
            Log mods with costs to see your breakdown by category.
          </Text>
        </AppleCard>
      )}
    </View>
  );
}

function computeModMonthsSpan(mods: ModWithPart[]): number | null {
  const dates = mods
    .map((m) => m.install_date)
    .filter((d): d is string => !!d)
    .map((d) => new Date(d));
  if (dates.length === 0) return null;

  const earliest = dates.reduce((min, d) => (d < min ? d : min), dates[0]);
  const latest = dates.reduce((max, d) => (d > max ? d : max), dates[0]);
  const months =
    (latest.getFullYear() - earliest.getFullYear()) * 12 +
    (latest.getMonth() - earliest.getMonth());
  return Math.max(1, months);
}

function DocsTab({ vehicleId }: { vehicleId: string }) {
  const [documents, setDocuments] = useState<VehicleDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await listVehicleDocuments(vehicleId);
      setDocuments(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load documents';
      showAppAlert('Error', message);
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  async function handleUpload(input: {
    uri: string;
    fileName: string;
    mimeType: string;
    fileSize?: number | null;
  }) {
    const {
      data: { session: liveSession },
    } = await supabase.auth.getSession();
    if (!liveSession) {
      showAppAlert('Sign in required', 'Your session expired. Sign in again to upload.');
      return;
    }

    setUploading(true);
    try {
      const doc = await uploadVehicleDocument({
        vehicleId,
        ownerId: liveSession.user.id,
        uri: input.uri,
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
      });
      setDocuments((current) => [doc, ...current]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not upload document';
      showAppAlert('Upload failed', message);
    } finally {
      setUploading(false);
    }
  }

  async function handlePickNative() {
    try {
      const picked = await pickVehicleDocumentNative();
      if (!picked) return;
      await handleUpload(picked);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not pick document';
      showAppAlert('Upload failed', message);
    }
  }

  async function applyWebFile(file: globalThis.File | undefined) {
    if (!file) return;
    const mimeType = file.type || 'application/octet-stream';
    if (!mimeType.startsWith('image/') && mimeType !== 'application/pdf') {
      showAppAlert('Invalid file', 'Choose a PDF or image file.');
      return;
    }
    await handleUpload({
      uri: URL.createObjectURL(file),
      fileName: file.name,
      mimeType,
      fileSize: file.size,
    });
  }

  function confirmDelete(doc: VehicleDocument) {
    Alert.alert('Delete document?', `Remove "${doc.title}" from your garage.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteVehicleDocument(doc);
            setDocuments((current) => current.filter((d) => d.id !== doc.id));
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Could not delete document';
            showAppAlert('Delete failed', message);
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View className="items-center py-12">
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View className="pb-6">
      {Platform.OS === 'web' ? (
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            void applyWebFile(file);
            e.target.value = '';
          }}
        />
      ) : null}

      {documents.length === 0 ? (
        <View className="items-center py-12">
          <View className="mb-4 h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-apple-bg2">
            <Ionicons name="document-text-outline" size={32} color={colors.tertiary} />
          </View>
          <Text className="text-xl font-bold text-apple-ink">Your documents</Text>
          <Text className="mt-2 max-w-[260px] text-center text-[15px] leading-[22px] text-apple-secondary">
            Keep registration, insurance, and receipts in one secure place.
          </Text>
          <Pressable
            onPress={() => {
              if (Platform.OS === 'web') fileInputRef.current?.click();
              else void handlePickNative();
            }}
            disabled={uploading}
            className="mt-5 rounded-xl px-6 py-3 active:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: colors.blue }}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-[15px] font-semibold text-white">Upload a document</Text>
            )}
          </Pressable>
          <Text className="mt-2 text-xs text-apple-tertiary">PDF or image · up to 10 MB</Text>
        </View>
      ) : (
        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-[13px] font-semibold text-apple-secondary">
              {documents.length} document{documents.length === 1 ? '' : 's'}
            </Text>
            <Pressable
              onPress={() => {
                if (Platform.OS === 'web') fileInputRef.current?.click();
                else void handlePickNative();
              }}
              disabled={uploading}
              className="rounded-lg px-3 py-1.5 active:opacity-80 disabled:opacity-60"
              style={{ backgroundColor: colors.blueSoft }}
            >
              {uploading ? (
                <ActivityIndicator color={colors.blue} size="small" />
              ) : (
                <Text className="text-[13px] font-semibold text-signal-blue">+ Upload</Text>
              )}
            </Pressable>
          </View>

          <AppleCard style={{ padding: 0, overflow: 'hidden' }}>
            {documents.map((doc, idx) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                last={idx === documents.length - 1}
                onOpen={() =>
                  void openVehicleDocument(doc).catch((err) => {
                    showAppAlert(
                      'Could not open',
                      err instanceof Error ? err.message : 'Try again.'
                    );
                  })
                }
                onDelete={() => confirmDelete(doc)}
              />
            ))}
          </AppleCard>
        </View>
      )}
    </View>
  );
}

function DocumentRow({
  doc,
  last,
  onOpen,
  onDelete,
}: {
  doc: VehicleDocument;
  last: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const isPdf = doc.mime_type === 'application/pdf';
  return (
    <View
      className={`flex-row items-center gap-3 px-4 py-3.5 ${
        last ? '' : 'border-b border-apple-border'
      }`}
    >
      <View className="h-11 w-11 items-center justify-center rounded-[12px] bg-apple-bg2">
        <Ionicons
          name={isPdf ? 'document-outline' : 'image-outline'}
          size={22}
          color={isPdf ? colors.blue : colors.accent}
        />
      </View>
      <Pressable onPress={onOpen} className="min-w-0 flex-1 active:opacity-70">
        <Text className="text-[15px] font-semibold text-apple-ink" numberOfLines={1}>
          {doc.title}
        </Text>
        <Text className="text-[13px] text-apple-secondary" numberOfLines={1}>
          {doc.file_name} · {formatDocumentDate(doc.created_at)}
        </Text>
      </Pressable>
      <Pressable onPress={onDelete} hitSlop={8} className="p-1 active:opacity-60">
        <Ionicons name="trash-outline" size={20} color={colors.tertiary} />
      </Pressable>
    </View>
  );
}
