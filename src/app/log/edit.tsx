import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { KeyboardSafeScrollView } from '@/components/ui/KeyboardSafeView';

import { useAuth } from '@/lib/auth-context';
import {
  addModPhotos,
  deleteMod,
  deleteModMedia,
  getModForEdit,
  updateMod,
  type ModForEdit,
  type ModPhoto,
} from '@/lib/mods';
import { InstallDateField } from '@/components/InstallDateField';
import { ModToolsForm } from '@/components/mods/ModToolsForm';
import {
  ExtraProductUrlField,
  ProductUrlResolver,
} from '@/components/social/ProductUrlResolver';
import { emptyProductLinks } from '@/lib/mod-products';
import { extractReceiptCostFromImage } from '@/lib/receipt-ocr';
import {
  parseProductLinks,
  serializeProductLinks,
  type ModProductLinks,
} from '@/lib/mod-products';
import { attachReceiptToMod, removeReceiptFromMod } from '@/lib/receipts';
import {
  listModTools,
  modToolToDraft,
  saveModTools,
  type ModToolDraft,
} from '@/lib/mod-tools';
import { canUseReceiptOcr, getUserSubscriptionTier } from '@/lib/subscription';
import { searchWorkshops, type WorkshopUser } from '@/lib/workshops';
import type { InstallerType, ModCategory, ModPrivacy } from '@/types/database';

const CATEGORIES: { value: ModCategory; label: string }[] = [
  { value: 'suspension', label: 'Suspension' },
  { value: 'wheels_tyres', label: 'Wheels & tyres' },
  { value: 'recovery', label: 'Recovery' },
  { value: 'body', label: 'Body' },
  { value: 'lighting', label: 'Lighting' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'drivetrain', label: 'Drivetrain' },
  { value: 'camping', label: 'Camping' },
  { value: 'interior', label: 'Interior' },
  { value: 'other', label: 'Other' },
];

const INSTALLERS: { value: InstallerType; label: string }[] = [
  { value: 'self', label: 'Me' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'friend', label: 'Friend' },
  { value: 'dealer', label: 'Dealer' },
];

const PRIVACIES: { value: ModPrivacy; label: string }[] = [
  { value: 'public', label: 'Public' },
  { value: 'followers', label: 'Followers' },
  { value: 'private', label: 'Private' },
];

const MAX_PHOTOS = 8;

type PendingPhoto = {
  uri: string;
  width: number | null;
  height: number | null;
  mimeType: string | null;
};

type PendingReceipt = {
  uri: string;
  width: number | null;
  height: number | null;
};

export default function EditModScreen() {
  const { modId } = useLocalSearchParams<{ modId: string }>();
  const { session } = useAuth();
  const router = useRouter();

  const [mod, setMod] = useState<ModForEdit | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [category, setCategory] = useState<ModCategory>('other');
  const [customPartName, setCustomPartName] = useState('');
  const [cost, setCost] = useState('');
  const [costIsApproximate, setCostIsApproximate] = useState(false);
  const [installerType, setInstallerType] = useState<InstallerType>('self');
  const [installerWorkshopId, setInstallerWorkshopId] = useState<string | null>(null);
  const [workshopQuery, setWorkshopQuery] = useState('');
  const [workshopHits, setWorkshopHits] = useState<WorkshopUser[]>([]);
  const [installDate, setInstallDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateIsApproximate, setDateIsApproximate] = useState(false);
  const [notes, setNotes] = useState('');
  const [privacy, setPrivacy] = useState<ModPrivacy>('public');
  const [productLinks, setProductLinks] = useState<ModProductLinks>(emptyProductLinks());
  const [tools, setTools] = useState<ModToolDraft[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<ModPhoto[]>([]);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);
  const [newPhotos, setNewPhotos] = useState<PendingPhoto[]>([]);
  const [existingReceipt, setExistingReceipt] = useState<ModForEdit['receipt']>(null);
  const [removeReceipt, setRemoveReceipt] = useState(false);
  const [newReceipt, setNewReceipt] = useState<PendingReceipt | null>(null);
  const [receiptCostHint, setReceiptCostHint] = useState<string | null>(null);
  const [scanningReceipt, setScanningReceipt] = useState(false);

  const visibleExisting = existingPhotos.filter(
    (p) => !removedPhotoIds.includes(p.id)
  );
  const totalPhotoCount = visibleExisting.length + newPhotos.length;
  const canAddMore = totalPhotoCount < MAX_PHOTOS;

  const load = useCallback(async () => {
    if (!modId) return;
    try {
      const m = await getModForEdit(modId);
      if (!m) {
        Alert.alert('Not found', 'This mod is not available.');
        router.back();
        return;
      }
      setMod(m);
      setCategory(m.category);
      setCustomPartName(m.custom_part_name ?? '');
      setCost(m.cost != null ? String(m.cost) : '');
      setCostIsApproximate(m.cost_is_approximate);
      setInstallerType(m.installer_type);
      setInstallerWorkshopId(m.installer_workshop_id);
      setInstallDate(m.install_date);
      setDateIsApproximate(m.date_is_approximate);
      setNotes(m.notes ?? '');
      setPrivacy(m.privacy);
      setProductLinks(parseProductLinks(m.product_links));
      const modTools = await listModTools(modId).catch(() => []);
      setTools(modTools.map(modToolToDraft));
      setExistingPhotos(m.photos);
      setRemovedPhotoIds([]);
      setNewPhotos([]);
      setExistingReceipt(m.receipt);
      setRemoveReceipt(false);
      setNewReceipt(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load mod';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, [modId, router]);

  useEffect(() => {
    load();
  }, [load]);

  const addPhotosFromResult = useCallback(
    (result: ImagePicker.ImagePickerResult) => {
      if (result.canceled) return;
      const kept = existingPhotos.filter((p) => !removedPhotoIds.includes(p.id)).length;
      setNewPhotos((current) => {
        const room = MAX_PHOTOS - kept - current.length;
        if (room <= 0) return current;
        const next = result.assets.slice(0, room).map((a) => ({
          uri: a.uri,
          width: a.width ?? null,
          height: a.height ?? null,
          mimeType: a.mimeType ?? null,
        }));
        return [...current, ...next];
      });
    },
    [existingPhotos, removedPhotoIds]
  );

  async function handlePickFromLibrary() {
    if (!canAddMore) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to attach photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - totalPhotoCount,
      quality: 0.85,
    });
    addPhotosFromResult(result);
  }

  async function handleTakePhoto() {
    if (!canAddMore) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow camera access to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    addPhotosFromResult(result);
  }

  function showPhotoPicker() {
    Alert.alert('Add photo', undefined, [
      { text: 'Take photo', onPress: handleTakePhoto },
      { text: 'Choose from library', onPress: handlePickFromLibrary },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function removeExistingPhoto(id: string) {
    setRemovedPhotoIds((ids) => [...ids, id]);
  }

  function removeNewPhotoAt(index: number) {
    setNewPhotos((current) => current.filter((_, i) => i !== index));
  }

  async function pickReceipt(source: 'library' | 'camera') {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to attach a receipt.');
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.9,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.9,
          });

    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setNewReceipt({
      uri: asset.uri,
      width: asset.width ?? null,
      height: asset.height ?? null,
    });
    setRemoveReceipt(false);
    setReceiptCostHint(null);

    if (!cost.trim() && session) {
      const tier = await getUserSubscriptionTier(session.user.id);
      if (!canUseReceiptOcr(tier)) {
        setReceiptCostHint('Receipt OCR is a Pro feature — enter cost manually or upgrade.');
        return;
      }
      setScanningReceipt(true);
      try {
        const parsed = await extractReceiptCostFromImage(asset.uri);
        if (parsed) {
          setCost(String(parsed.amount));
          setCostIsApproximate(parsed.confidence === 'low');
          setReceiptCostHint(
            parsed.confidence === 'high'
              ? `Detected $${parsed.amount.toLocaleString()} from receipt — review before saving.`
              : `Guessed $${parsed.amount.toLocaleString()} from receipt — double-check the total.`
          );
        }
      } catch {
        // OCR unavailable — manual entry.
      } finally {
        setScanningReceipt(false);
      }
    }
  }

  function showReceiptPicker() {
    Alert.alert('Receipt', 'Private — only you can view it.', [
      { text: 'Take photo', onPress: () => pickReceipt('camera') },
      { text: 'Choose from library', onPress: () => pickReceipt('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  const receiptPreviewUri =
    newReceipt?.uri ??
    (!removeReceipt ? existingReceipt?.previewUrl ?? null : null);

  async function handleSave() {
    if (!mod || !session) return;

    const costValue = cost.trim() ? Number(cost.replace(/[^0-9.]/g, '')) : null;
    if (cost.trim() && (Number.isNaN(costValue) || costValue! < 0)) {
      Alert.alert('Bad cost', 'Enter a number, or leave empty if undisclosed.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(installDate)) {
      Alert.alert('Bad date', 'Use the format YYYY-MM-DD.');
      return;
    }

    setSubmitting(true);
    try {
      await updateMod(mod.id, {
        category,
        cost: costValue,
        cost_is_approximate: costIsApproximate,
        installer_type: installerType,
        installer_workshop_id:
          installerType === 'workshop' ? installerWorkshopId : null,
        install_date: installDate,
        date_is_approximate: dateIsApproximate,
        notes: notes.trim() || null,
        privacy,
        custom_part_name: mod.part_id ? null : customPartName.trim() || null,
        product_links: serializeProductLinks(productLinks),
      });

      await saveModTools(mod.id, tools);

      for (const mediaId of removedPhotoIds) {
        await deleteModMedia(mediaId);
      }
      if (newPhotos.length > 0) {
        await addModPhotos(mod.id, session.user.id, newPhotos);
      }

      if (removeReceipt && existingReceipt) {
        await removeReceiptFromMod(mod.id, existingReceipt.id);
      } else if (newReceipt) {
        if (existingReceipt && !removeReceipt) {
          await removeReceiptFromMod(mod.id, existingReceipt.id);
        }
        await attachReceiptToMod({
          modId: mod.id,
          ownerId: session.user.id,
          uri: newReceipt.uri,
          width: newReceipt.width,
          height: newReceipt.height,
        });
      }

      router.back();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save';
      Alert.alert('Save failed', message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleDelete() {
    if (!mod) return;
    const label = mod.part
      ? `${mod.part.brand} ${mod.part.name}`
      : mod.custom_part_name ?? 'this mod';

    Alert.alert(
      'Delete this mod?',
      `${label} will be removed from your build history. If it was public, the feed post goes too. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            try {
              await deleteMod(mod.id);
              router.replace(`/vehicle/${mod.vehicle_id}`);
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Could not delete';
              Alert.alert('Delete failed', message);
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-apple-bg2">
        <Stack.Screen options={{ title: 'Edit mod' }} />
        <ActivityIndicator color="#FF6A2B" />
      </View>
    );
  }

  if (!mod) return null;

  const partLabel = mod.part
    ? `${mod.part.brand} ${mod.part.name}`
    : mod.custom_part_name ?? 'Custom part';

  return (
    <>
      <Stack.Screen options={{ title: 'Edit mod' }} />
      <KeyboardSafeScrollView className="flex-1 bg-apple-bg2" contentContainerClassName="px-6 pt-6">
        <Text className="text-apple-secondary">
          Update install details. The catalogue part cannot be swapped after
          logging — delete and re-log if you picked the wrong item.
        </Text>

        <View className="mt-6 rounded-2xl border border-apple-border bg-white p-4">
          <Text className="text-[11px] uppercase tracking-wider text-apple-secondary">
            Part
          </Text>
          <Text className="mt-1 text-lg font-semibold text-apple-ink">{partLabel}</Text>
          {!mod.part_id ? (
            <TextInput
              value={customPartName}
              onChangeText={setCustomPartName}
              placeholder="Custom part name"
              placeholderTextColor="#A1A1A6"
              className="mt-3 rounded-xl border border-apple-border bg-white px-4 py-3 text-apple-ink"
            />
          ) : null}
        </View>

        <View className="mt-6">
          <Text className="mb-2 text-xs uppercase tracking-wider text-apple-secondary">
            Photos ({totalPhotoCount}/{MAX_PHOTOS})
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {visibleExisting.map((p) => (
              <View key={p.id} className="relative">
                <Image
                  source={{ uri: p.url }}
                  className="h-20 w-20 rounded-xl bg-apple-bg2"
                />
                <Pressable
                  onPress={() => removeExistingPhoto(p.id)}
                  className="absolute -right-1 -top-1 h-6 w-6 items-center justify-center rounded-full bg-apple-bg2"
                >
                  <Text className="text-xs text-signal-red">✕</Text>
                </Pressable>
              </View>
            ))}
            {newPhotos.map((p, idx) => (
              <View key={p.uri} className="relative">
                <Image
                  source={{ uri: p.uri }}
                  className="h-20 w-20 rounded-xl bg-apple-bg2"
                />
                <Pressable
                  onPress={() => removeNewPhotoAt(idx)}
                  className="absolute -right-1 -top-1 h-6 w-6 items-center justify-center rounded-full bg-apple-bg2"
                >
                  <Text className="text-xs text-signal-red">✕</Text>
                </Pressable>
              </View>
            ))}
            {canAddMore ? (
              <Pressable
                onPress={showPhotoPicker}
                className="h-20 w-20 items-center justify-center rounded-xl border border-dashed border-apple-border active:bg-apple-bg2"
              >
                <Text className="text-2xl text-apple-tertiary">+</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View className="mt-6">
          <Text className="mb-2 text-xs uppercase tracking-wider text-apple-secondary">
            Category
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Chip
                key={c.value}
                label={c.label}
                active={category === c.value}
                onPress={() => setCategory(c.value)}
              />
            ))}
          </View>
        </View>

        <View className="mt-4">
          <Text className="mb-2 text-xs uppercase tracking-wider text-apple-secondary">
            Cost (AUD)
          </Text>
          <TextInput
            value={cost}
            onChangeText={setCost}
            keyboardType="decimal-pad"
            placeholder="Optional"
            placeholderTextColor="#A1A1A6"
            className="rounded-xl border border-apple-border bg-white px-4 py-3 text-apple-ink"
          />
          <Pressable
            onPress={() => setCostIsApproximate((v) => !v)}
            className="mt-2 flex-row items-center gap-2"
          >
            <View
              className={`h-5 w-5 rounded border ${
                costIsApproximate ? 'border-accent bg-accent' : 'border-apple-border'
              }`}
            />
            <Text className="text-sm text-apple-secondary">Approximate cost</Text>
          </Pressable>
        </View>

        <View className="mt-4">
          <Text className="mb-2 text-xs uppercase tracking-wider text-apple-secondary">
            Receipt (private)
          </Text>
          {receiptPreviewUri ? (
            <View className="relative self-start">
              <Image
                source={{ uri: receiptPreviewUri }}
                className="h-28 w-40 rounded-xl bg-apple-bg2"
                resizeMode="cover"
              />
              <Pressable
                onPress={() => {
                  if (newReceipt) {
                    setNewReceipt(null);
                    setReceiptCostHint(null);
                  } else {
                    setRemoveReceipt(true);
                    setReceiptCostHint(null);
                  }
                }}
                className="absolute -right-1 -top-1 h-6 w-6 items-center justify-center rounded-full bg-apple-bg2"
              >
                <Text className="text-xs text-signal-red">✕</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={showReceiptPicker}
              className="self-start rounded-xl border border-dashed border-apple-border px-4 py-3 active:bg-white"
            >
              <Text className="font-semibold text-apple-secondary">+ Attach receipt</Text>
            </Pressable>
          )}
          {scanningReceipt ? (
            <View className="mt-2 flex-row items-center gap-2">
              <ActivityIndicator color="#FF6A2B" size="small" />
              <Text className="text-xs text-apple-secondary">Reading receipt…</Text>
            </View>
          ) : receiptCostHint ? (
            <Text className="mt-2 text-xs text-signal-green">{receiptCostHint}</Text>
          ) : (
            <Text className="mt-2 text-xs text-apple-secondary">
              Never shown on the public feed. OCR fills cost when the field is
              empty.
            </Text>
          )}
        </View>

        <View className="mt-4">
          <Text className="mb-2 text-xs uppercase tracking-wider text-apple-secondary">
            Installed by
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {INSTALLERS.map((i) => (
              <Chip
                key={i.value}
                label={i.label}
                active={installerType === i.value}
                onPress={() => {
                  setInstallerType(i.value);
                  if (i.value !== 'workshop') setInstallerWorkshopId(null);
                }}
              />
            ))}
          </View>
          {installerType === 'workshop' ? (
            <View className="mt-3">
              <TextInput
                value={workshopQuery}
                onChangeText={async (text) => {
                  setWorkshopQuery(text);
                  try {
                    setWorkshopHits(await searchWorkshops(text));
                  } catch {
                    setWorkshopHits([]);
                  }
                }}
                placeholder="Search workshop"
                placeholderTextColor="#A1A1A6"
                className="rounded-xl border border-apple-border bg-white px-4 py-3 text-apple-ink"
              />
              {workshopHits.map((w) => (
                <Pressable
                  key={w.id}
                  onPress={() => setInstallerWorkshopId(w.id)}
                  className={`mt-2 rounded-xl border px-4 py-3 ${
                    installerWorkshopId === w.id
                      ? 'border-accent bg-accent/10'
                      : 'border-apple-border'
                  }`}
                >
                  <Text className="text-apple-ink">{w.workshop_name ?? w.display_name}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <View className="mt-4">
          <Text className="mb-2 text-xs uppercase tracking-wider text-apple-secondary">
            Install date
          </Text>
          <InstallDateField
            value={installDate}
            onChange={setInstallDate}
            showPicker={showDatePicker}
            onTogglePicker={() => setShowDatePicker((v) => !v)}
          />
          <Pressable
            onPress={() => setDateIsApproximate((v) => !v)}
            className="mt-2 flex-row items-center gap-2"
          >
            <View
              className={`h-5 w-5 rounded border ${
                dateIsApproximate ? 'border-accent bg-accent' : 'border-apple-border'
              }`}
            />
            <Text className="text-sm text-apple-secondary">Approximate date</Text>
          </Pressable>
        </View>

        <View className="mt-4">
          <Text className="mb-2 text-xs uppercase tracking-wider text-apple-secondary">
            Product link
          </Text>
          <ProductUrlResolver
            productLinks={productLinks}
            onProductLinksChange={setProductLinks}
            resolvedPart={
              mod.part
                ? { brand: mod.part.brand, name: mod.part.name }
                : mod.custom_part_name
                  ? { brand: 'Custom', name: mod.custom_part_name }
                  : null
            }
            onPartResolved={() => {}}
            onClearPart={() => setProductLinks(emptyProductLinks())}
          />
          {productLinks.extras.map((extra, i) => (
            <View key={i} className="mt-3">
              <ExtraProductUrlField
                url={extra.url}
                purpose={extra.purpose ?? ''}
                onChangeUrl={(url) => {
                  const extras = [...productLinks.extras];
                  extras[i] = { ...extras[i], url };
                  setProductLinks({ ...productLinks, extras });
                }}
                onChangePurpose={(purpose) => {
                  const extras = [...productLinks.extras];
                  extras[i] = { ...extras[i], purpose };
                  setProductLinks({ ...productLinks, extras });
                }}
                onRemove={() =>
                  setProductLinks({
                    ...productLinks,
                    extras: productLinks.extras.filter((_, idx) => idx !== i),
                  })
                }
              />
            </View>
          ))}
          <Pressable
            onPress={() =>
              setProductLinks({
                ...productLinks,
                extras: [...productLinks.extras, { name: '', url: '', purpose: '' }],
              })
            }
            className="mt-3 flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-apple-border py-3"
          >
            <Text className="font-semibold text-accent">+ Add another product link</Text>
          </Pressable>
        </View>

        <View className="mt-4">
          <Text className="mb-2 text-xs uppercase tracking-wider text-apple-secondary">
            Tools used (optional)
          </Text>
          <ModToolsForm tools={tools} onChange={setTools} />
        </View>

        <View className="mt-4">
          <Text className="mb-2 text-xs uppercase tracking-wider text-apple-secondary">
            Notes
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            placeholder="Optional"
            placeholderTextColor="#A1A1A6"
            className="rounded-xl border border-apple-border bg-white px-4 py-3 text-apple-ink"
            style={{ minHeight: 80, textAlignVertical: 'top' }}
          />
        </View>

        <View className="mt-4">
          <Text className="mb-2 text-xs uppercase tracking-wider text-apple-secondary">
            Privacy
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {PRIVACIES.map((p) => (
              <Chip
                key={p.value}
                label={p.label}
                active={privacy === p.value}
                onPress={() => setPrivacy(p.value)}
              />
            ))}
          </View>
          <Text className="mt-2 text-xs text-apple-secondary">
            Switching to public creates a feed post if one does not exist yet.
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
            <Text className="text-center text-base font-semibold text-white">
              Save changes
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={handleDelete}
          disabled={submitting}
          className="mt-3 rounded-xl border border-signal-red/50 py-3.5 active:bg-white disabled:opacity-60"
        >
          <Text className="text-center text-base font-semibold text-signal-red">
            Delete mod
          </Text>
        </Pressable>
      </KeyboardSafeScrollView>
    </>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-lg px-3 py-1.5 ${
        active ? 'bg-accent' : 'border border-apple-border bg-white'
      }`}
    >
      <Text
        className={`text-sm ${active ? 'font-semibold text-apple-ink' : 'text-apple-secondary'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
