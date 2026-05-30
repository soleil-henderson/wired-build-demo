import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { getPartById, searchParts, submitCustomPart, type Part } from '@/lib/parts';
import { InstallDateField } from '@/components/InstallDateField';
import { ModToolsForm } from '@/components/mods/ModToolsForm';
import {
  ExtraProductUrlField,
  ProductUrlResolver,
  type ResolvedPartDescriptor,
} from '@/components/social/ProductUrlResolver';
import { extractReceiptCostFromImage } from '@/lib/receipt-ocr';
import { attachReceiptToMod } from '@/lib/receipts';
import { enqueueModPhotoUpload } from '@/lib/offline-queue';
import { markPlanItemComplete } from '@/lib/plan-items';
import { canUseReceiptOcr, getUserSubscriptionTier } from '@/lib/subscription';
import { searchWorkshops, type WorkshopUser } from '@/lib/workshops';
import { uploadModPhoto, uploadModVideo, type UploadedPhoto } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { serializeProductLinks, emptyProductLinks, type ModProductLinks } from '@/lib/mod-products';
import { saveModTools, type ModToolDraft } from '@/lib/mod-tools';
import { colors } from '@/lib/theme';
import { getPostIdForMod } from '@/lib/feed';
import { getWishlistItem, removeWishlistItem } from '@/lib/wishlist';
import type { InstallerType, ModCategory, ModPrivacy } from '@/types/database';

const MAX_PHOTOS = 8;

type PendingPhoto = {
  uri: string;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  kind: 'photo' | 'video';
};

type PendingReceipt = {
  uri: string;
  width: number | null;
  height: number | null;
};

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

const PRIVACIES: { value: ModPrivacy; label: string; hint: string }[] = [
  { value: 'public', label: 'Public', hint: 'Visible to anyone' },
  { value: 'followers', label: 'Followers', hint: 'Only people who follow you' },
  { value: 'private', label: 'Private', hint: 'Only you' },
];

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function LogNewScreen() {
  const router = useRouter();
  const { vehicleId, wishlistId, planItemId } = useLocalSearchParams<{
    vehicleId?: string;
    wishlistId?: string;
    planItemId?: string;
  }>();
  const { session } = useAuth();
  const [prefilling, setPrefilling] = useState(!!wishlistId);
  const [promotedFromWishlist, setPromotedFromWishlist] = useState(false);

  // Photo state (Spec §4.1 step 1 — open camera/library, up to 8, or skip)
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [receipt, setReceipt] = useState<PendingReceipt | null>(null);
  const [receiptCostHint, setReceiptCostHint] = useState<string | null>(null);
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Part picker state
  const [partQuery, setPartQuery] = useState('');
  const [partResults, setPartResults] = useState<Part[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [urlResolvedPart, setUrlResolvedPart] = useState<ResolvedPartDescriptor | null>(null);
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null);
  const [showCatalogueSearch, setShowCatalogueSearch] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [customBrand, setCustomBrand] = useState('');
  const [customName, setCustomName] = useState('');

  // Mod fields
  const [category, setCategory] = useState<ModCategory>('suspension');
  const [cost, setCost] = useState('');
  const [costIsApproximate, setCostIsApproximate] = useState(false);
  const [installerType, setInstallerType] = useState<InstallerType>('self');
  const [installerWorkshopId, setInstallerWorkshopId] = useState<string | null>(null);
  const [workshopQuery, setWorkshopQuery] = useState('');
  const [workshopHits, setWorkshopHits] = useState<WorkshopUser[]>([]);
  const [installDate, setInstallDate] = useState(todayISO());
  const [dateIsApproximate, setDateIsApproximate] = useState(false);
  const [notes, setNotes] = useState('');
  const [privacy, setPrivacy] = useState<ModPrivacy>('public');
  const [productLinks, setProductLinks] = useState<ModProductLinks>(emptyProductLinks());
  const [tools, setTools] = useState<ModToolDraft[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [ownerCheck, setOwnerCheck] = useState<'pending' | 'ok' | 'denied'>('pending');

  useEffect(() => {
    if (!session || !vehicleId) {
      setOwnerCheck('denied');
      return;
    }
    let cancelled = false;
    supabase
      .from('vehicles')
      .select('current_owner_id')
      .eq('id', vehicleId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data || data.current_owner_id !== session.user.id) {
          setOwnerCheck('denied');
          Alert.alert(
            'Not your vehicle',
            'You can only log mods on builds in your own garage.',
            [{ text: 'OK', onPress: () => router.back() }]
          );
          return;
        }
        setOwnerCheck('ok');
      });
    return () => {
      cancelled = true;
    };
  }, [session, vehicleId, router]);

  // Pre-fill the form when promoting a wishlist item.
  // deleted in handleSubmit *after* the mod insert succeeds, so a save failure
  // leaves the wishlist intact.
  useEffect(() => {
    if (!wishlistId) return;
    let cancelled = false;
    (async () => {
      try {
        const item = await getWishlistItem(wishlistId);
        if (cancelled || !item) {
          setPrefilling(false);
          return;
        }
        if (item.part_id) {
          const part = await getPartById(item.part_id);
          if (!cancelled && part) {
            setSelectedPart(part);
            setCategory(part.category);
          }
        } else if (item.custom_part_name) {
          setCustomMode(true);
          setCustomName(item.custom_part_name);
        }
        if (item.category) setCategory(item.category);
        if (item.target_cost != null) {
          setCost(String(item.target_cost));
          // Target cost is a plan, not a paid invoice — flag as approximate.
          setCostIsApproximate(true);
        }
        if (item.notes) setNotes(item.notes);
        setPromotedFromWishlist(true);
      } catch {
        // Pre-fill failure is non-fatal; user can fill manually.
      } finally {
        if (!cancelled) setPrefilling(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wishlistId]);

  const addPhotosFromResult = useCallback((result: ImagePicker.ImagePickerResult) => {
    if (result.canceled) return;
    setPhotos((current) => {
      const room = MAX_PHOTOS - current.length;
      if (room <= 0) return current;
      const next = result.assets.slice(0, room).map((a) => ({
        uri: a.uri,
        width: a.width ?? null,
        height: a.height ?? null,
        mimeType: a.mimeType ?? null,
        kind: (a.type === 'video' ? 'video' : 'photo') as 'photo' | 'video',
      }));
      return [...current, ...next];
    });
  }, []);

  async function handlePickFromLibrary() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to attach photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
      videoMaxDuration: 60,
      quality: 0.85,
    });
    addPhotosFromResult(result);
  }

  async function handleTakePhoto() {
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

  function removePhotoAt(index: number) {
    setPhotos((current) => current.filter((_, i) => i !== index));
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
    setReceipt({
      uri: asset.uri,
      width: asset.width ?? null,
      height: asset.height ?? null,
    });
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
        // OCR unavailable or failed — manual entry still works.
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

  // Debounced parts search
  const searchToken = useRef(0);
  useEffect(() => {
    const term = partQuery.trim();
    if (selectedPart || customMode) {
      setPartResults([]);
      return;
    }
    if (!term) {
      setPartResults([]);
      setSearching(false);
      return;
    }
    const token = ++searchToken.current;
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const results = await searchParts(term);
        if (searchToken.current === token) {
          setPartResults(results);
        }
      } catch {
        if (searchToken.current === token) setPartResults([]);
      } finally {
        if (searchToken.current === token) setSearching(false);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [partQuery, selectedPart, customMode]);

  const partDescriptor = useMemo(() => {
    if (selectedPart) {
      return { brand: selectedPart.brand, name: selectedPart.name, category: selectedPart.category };
    }
    if (urlResolvedPart) {
      return {
        brand: urlResolvedPart.brand,
        name: urlResolvedPart.name,
        category,
      };
    }
    if (customMode && customBrand && customName) {
      return { brand: customBrand, name: customName, category };
    }
    return null;
  }, [selectedPart, urlResolvedPart, customMode, customBrand, customName, category]);

  // When a catalogue part is picked, mirror its category onto the form.
  useEffect(() => {
    if (selectedPart) setCategory(selectedPart.category);
  }, [selectedPart]);

  const clearPart = useCallback(() => {
    setSelectedPart(null);
    setUrlResolvedPart(null);
    setResolvedImageUrl(null);
    setCustomMode(false);
    setCustomBrand('');
    setCustomName('');
    setPartQuery('');
    setProductLinks(emptyProductLinks());
  }, []);

  async function handleSubmit() {
    if (!session) {
      Alert.alert('Not signed in', 'Sign in before logging a mod.');
      return;
    }
    if (!vehicleId) {
      Alert.alert('Missing vehicle', 'This log flow needs a vehicle id in the URL.');
      return;
    }

    const { data: ownedVehicle, error: ownerErr } = await supabase
      .from('vehicles')
      .select('current_owner_id')
      .eq('id', vehicleId)
      .maybeSingle();
    if (
      ownerErr ||
      !ownedVehicle ||
      ownedVehicle.current_owner_id !== session.user.id
    ) {
      Alert.alert(
        'Not your vehicle',
        'You can only log mods on builds in your own garage.'
      );
      return;
    }

    if (!partDescriptor) {
      Alert.alert('Add a product', 'Paste a product link or pick from the catalogue.');
      return;
    }

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
      let partId = selectedPart?.id ?? null;
      let customPartName: string | null = null;

      // URL-resolved or custom-part fallback: create moderation-queue row or use custom name.
      if (!selectedPart && urlResolvedPart) {
        try {
          const created = await submitCustomPart({
            brand: urlResolvedPart.brand,
            name: urlResolvedPart.name,
            category,
          });
          partId = created.id;
        } catch {
          customPartName = `${urlResolvedPart.brand} ${urlResolvedPart.name}`.trim();
        }
      } else if (!selectedPart && customMode) {
        try {
          const created = await submitCustomPart({
            brand: customBrand.trim(),
            name: customName.trim(),
            category,
          });
          partId = created.id;
        } catch {
          customPartName = `${customBrand.trim()} ${customName.trim()}`.trim();
        }
      }

      const { data: mod, error: modErr } = await supabase
        .from('mods')
        .insert({
          vehicle_id: vehicleId,
          part_id: partId,
          custom_part_name: customPartName,
          category,
          cost: costValue,
          cost_is_approximate: costIsApproximate,
          installer_type: installerType,
          installer_workshop_id:
            installerType === 'workshop' ? installerWorkshopId : null,
          from_plan_item_id: planItemId ?? null,
          install_date: installDate,
          date_is_approximate: dateIsApproximate,
          notes: notes.trim() || null,
          privacy,
          product_links: serializeProductLinks(productLinks),
        })
        .select('id')
        .single();

      if (modErr) throw modErr;

      if (tools.length > 0) {
        await saveModTools(mod.id, tools);
      }

      // Upload photos (if any) and create media rows linked to the mod.
      // We do this *after* the mod is saved so that if photo upload fails the
      // mod itself is still recorded — better to have the data than to lose
      // everything to a flaky network mid-upload.
      if (photos.length > 0 && mod) {
        const uploaded: (UploadedPhoto & { kind: 'photo' | 'video' })[] = [];
        for (const p of photos) {
          try {
            const result =
              p.kind === 'video'
                ? await uploadModVideo({
                    uri: p.uri,
                    ownerId: session.user.id,
                    mimeType: p.mimeType,
                    width: p.width,
                    height: p.height,
                  })
                : await uploadModPhoto({
                    uri: p.uri,
                    ownerId: session.user.id,
                    mimeType: p.mimeType,
                    width: p.width,
                    height: p.height,
                  });
            uploaded.push({ ...result, kind: p.kind });
          } catch (err) {
            console.warn('Media upload failed', err);
            if (p.kind === 'photo') {
              await enqueueModPhotoUpload({
                modId: mod.id,
                ownerId: session.user.id,
                uri: p.uri,
                mimeType: p.mimeType ?? undefined,
                width: p.width ?? undefined,
                height: p.height ?? undefined,
              });
            }
          }
        }

        if (uploaded.length > 0) {
          const { error: mediaErr } = await supabase.from('media').insert(
            uploaded.map((u) => ({
              owner_id: session.user.id,
              mod_id: mod.id,
              url: u.url,
              storage_key: u.storage_key,
              kind: u.kind,
              width: u.width,
              height: u.height,
              is_sensitive: false,
            }))
          );
          if (mediaErr) {
            console.warn('media insert failed', mediaErr);
          }
        }
      }

      // Promoting a wishlist row -> mod: now that the mod is safely inserted
      // (and photos uploaded), delete the source wishlist row. Failure here is
      // non-fatal; the mod is already recorded.
      if (wishlistId) {
        try {
          await removeWishlistItem(wishlistId);
        } catch (err) {
          console.warn('Could not delete wishlist source row', err);
        }
      }

      if (planItemId) {
        try {
          await markPlanItemComplete(planItemId);
        } catch (err) {
          console.warn('Could not mark plan item complete', err);
        }
      }

      if (receipt && mod) {
        try {
          await attachReceiptToMod({
            modId: mod.id,
            ownerId: session.user.id,
            uri: receipt.uri,
            width: receipt.width,
            height: receipt.height,
          });
        } catch (err) {
          console.warn('Receipt upload failed', err);
        }
      }

      if (privacy === 'public' && mod) {
        const postId = await getPostIdForMod(mod.id);
        if (postId) {
          router.replace('/(tabs)');
          return;
        }
      }

      router.replace(vehicleId ? `/vehicle/${vehicleId}` : '/(tabs)/garage');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not log mod';
      Alert.alert('Save failed', message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{ title: promotedFromWishlist ? 'Log from wishlist' : 'Log a mod' }}
      />
      {ownerCheck !== 'ok' ? (
        <View className="flex-1 items-center justify-center bg-apple-bg2">
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
      <KeyboardSafeScrollView className="flex-1 bg-apple-bg2" contentContainerClassName="px-6 pt-4">
        <Text className="text-apple-secondary">
          {promotedFromWishlist
            ? 'Confirm the install details. We pre-filled what we could from your wishlist; this entry will replace the wishlist row.'
            : 'Target: under 90 seconds. Photo → part → cost → confirm.'}
        </Text>
        {prefilling ? (
          <View className="mt-4 flex-row items-center gap-2">
            <ActivityIndicator color="#FF6A2B" />
            <Text className="text-sm text-apple-secondary">Loading wishlist details…</Text>
          </View>
        ) : null}

        {/* ---- Photos ---- */}
        <SectionHeading>Photos (optional, up to {MAX_PHOTOS})</SectionHeading>
        <View className="flex-row flex-wrap gap-2">
          {photos.map((p, idx) => (
            <View key={p.uri} className="relative">
              <Image
                source={{ uri: p.uri }}
                className="h-20 w-20 rounded-xl bg-apple-bg2"
                resizeMode="cover"
              />
              <Pressable
                onPress={() => removePhotoAt(idx)}
                className="absolute -right-1 -top-1 h-6 w-6 items-center justify-center rounded-full bg-apple-bg2 border border-apple-border"
              >
                <Text className="text-xs font-bold text-apple-ink">×</Text>
              </Pressable>
            </View>
          ))}
          {photos.length < MAX_PHOTOS ? (
            <>
              <Pressable
                onPress={handleTakePhoto}
                className="h-20 w-20 items-center justify-center rounded-xl border border-dashed border-apple-border bg-white"
              >
                <Text className="text-xl text-apple-secondary">+</Text>
                <Text className="text-[10px] text-apple-secondary">Camera</Text>
              </Pressable>
              <Pressable
                onPress={handlePickFromLibrary}
                className="h-20 w-20 items-center justify-center rounded-xl border border-dashed border-apple-border bg-white"
              >
                <Text className="text-xl text-apple-secondary">+</Text>
                <Text className="text-[10px] text-apple-secondary">Library</Text>
              </Pressable>
            </>
          ) : null}
        </View>

        {/* ---- Product / part ---- */}
        <SectionHeading>Product</SectionHeading>
        {!selectedPart && !customMode ? (
          <ProductUrlResolver
            productLinks={productLinks}
            onProductLinksChange={setProductLinks}
            resolvedPart={urlResolvedPart}
            resolvedImageUrl={resolvedImageUrl}
            onPartResolved={(part) => {
              setUrlResolvedPart(part);
              setSelectedPart(null);
              setCustomMode(false);
            }}
            onClearPart={clearPart}
            onLookupComplete={(result) => {
              setResolvedImageUrl(result.image_url);
              if (result.price && !cost.trim()) {
                const n = Number(result.price.replace(/[^0-9.]/g, ''));
                if (!Number.isNaN(n) && n > 0) setCost(String(n));
              }
            }}
          />
        ) : null}

        {partDescriptor && (selectedPart || customMode) ? (
          <View className="rounded-2xl border border-apple-border bg-white p-4">
            <Text className="text-xs uppercase tracking-wider text-apple-secondary">
              {partDescriptor.category.replace('_', ' ')}
              {customMode ? ' · pending approval' : ' · catalogue'}
            </Text>
            <Text className="mt-1 text-lg font-semibold text-apple-ink">{partDescriptor.brand}</Text>
            <Text className="text-apple-secondary">{partDescriptor.name}</Text>
            <Pressable onPress={clearPart} className="mt-3 self-start">
              <Text className="text-sm font-semibold text-accent">Change</Text>
            </Pressable>
          </View>
        ) : null}

        {!partDescriptor ? (
          <Pressable
            onPress={() => setShowCatalogueSearch((v) => !v)}
            className="mt-2 flex-row items-center gap-2"
          >
            <Ionicons name={showCatalogueSearch ? 'chevron-up' : 'chevron-down'} size={16} color={colors.secondary} />
            <Text className="text-sm font-semibold text-apple-secondary">
              Or search our parts catalogue
            </Text>
          </Pressable>
        ) : null}

        {showCatalogueSearch && !partDescriptor ? (
          <View className="mt-2">
            <TextInput
              value={partQuery}
              onChangeText={setPartQuery}
              placeholder="Search brand or part name…"
              placeholderTextColor="#A1A1A6"
              autoCapitalize="none"
              autoCorrect={false}
              className="rounded-xl border border-apple-border bg-white px-4 py-3 text-apple-ink"
            />
            {searching ? (
              <Text className="mt-2 text-xs text-apple-secondary">Searching…</Text>
            ) : null}
            {partResults.length > 0 ? (
              <View className="mt-2 overflow-hidden rounded-xl border border-apple-border">
                {partResults.map((p, idx) => (
                  <Pressable
                    key={p.id}
                    onPress={() => {
                      setSelectedPart(p);
                      setUrlResolvedPart(null);
                      setShowCatalogueSearch(false);
                    }}
                    className={`bg-white px-4 py-3 active:bg-apple-bg2 ${
                      idx > 0 ? 'border-t border-apple-border' : ''
                    }`}
                  >
                    <Text className="text-xs uppercase tracking-wider text-apple-secondary">
                      {p.category.replace('_', ' ')}
                    </Text>
                    <Text className="mt-0.5 font-semibold text-apple-ink">{p.brand}</Text>
                    <Text className="text-apple-secondary">{p.name}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {urlResolvedPart && productLinks.primary?.url ? (
          <View className="mt-4 gap-3">
            <Text className="text-xs font-semibold uppercase tracking-wider text-apple-secondary">
              Other products used
            </Text>
            {productLinks.extras.map((extra, i) => (
              <ExtraProductUrlField
                key={i}
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
                onRemove={() => {
                  setProductLinks({
                    ...productLinks,
                    extras: productLinks.extras.filter((_, idx) => idx !== i),
                  });
                }}
              />
            ))}
            <Pressable
              onPress={() =>
                setProductLinks({
                  ...productLinks,
                  extras: [...productLinks.extras, { name: '', url: '', purpose: '' }],
                })
              }
              className="flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-apple-border py-3"
            >
              <Text className="font-semibold text-accent">+ Add another product link</Text>
            </Pressable>
          </View>
        ) : null}

        {/* ---- Category ---- */}
        <SectionHeading>Category</SectionHeading>
        <Chips
          options={CATEGORIES}
          value={category}
          onChange={(v) => setCategory(v as ModCategory)}
        />

        {/* ---- Cost ---- */}
        <SectionHeading>Cost (AUD)</SectionHeading>
        <View className="flex-row items-center gap-3">
          <View className="flex-1 flex-row items-center rounded-xl bg-apple-bg2 px-4">
            <Text className="text-apple-secondary">$</Text>
            <TextInput
              value={cost}
              onChangeText={setCost}
              placeholder="0.00"
              placeholderTextColor="#A1A1A6"
              keyboardType="decimal-pad"
              className="ml-2 flex-1 py-3 text-apple-ink"
            />
          </View>
          <Toggle
            value={costIsApproximate}
            onChange={setCostIsApproximate}
            label="Approx"
          />
        </View>
        <Text className="mt-2 text-xs text-apple-secondary">
          Leave empty if it was a gift or undisclosed.
        </Text>

        {/* ---- Receipt (private) ---- */}
        <SectionHeading>Receipt (optional, private)</SectionHeading>
        {receipt ? (
          <View className="relative self-start">
            <Image
              source={{ uri: receipt.uri }}
              className="h-28 w-40 rounded-xl bg-apple-bg2"
              resizeMode="cover"
            />
            <Pressable
              onPress={() => {
                setReceipt(null);
                setReceiptCostHint(null);
              }}
              className="absolute -right-1 -top-1 h-6 w-6 items-center justify-center rounded-full bg-apple-bg2 border border-apple-border"
            >
              <Text className="text-xs font-bold text-apple-ink">×</Text>
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
            Stored privately — never on the public feed. We try to read the
            total when cost is empty (device OCR; may need a dev build, not Expo
            Go web).
          </Text>
        )}

        {/* ---- Installer ---- */}
        <SectionHeading>Who installed it</SectionHeading>
        <Chips
          options={INSTALLERS}
          value={installerType}
          onChange={(v) => {
            const next = v as InstallerType;
            setInstallerType(next);
            if (next !== 'workshop') setInstallerWorkshopId(null);
          }}
        />
        {installerType === 'workshop' ? (
          <View className="mt-3">
            <TextInput
              value={workshopQuery}
              onChangeText={async (text) => {
                setWorkshopQuery(text);
                try {
                  const hits = await searchWorkshops(text);
                  setWorkshopHits(hits);
                } catch {
                  setWorkshopHits([]);
                }
              }}
              placeholder="Search workshop by name or handle"
              placeholderTextColor="#A1A1A6"
              className="rounded-xl border border-apple-border bg-white px-4 py-3 text-apple-ink"
            />
            <View className="mt-2 gap-2">
              {workshopHits.map((w) => (
                <Pressable
                  key={w.id}
                  onPress={() => setInstallerWorkshopId(w.id)}
                  className={`rounded-xl border px-4 py-3 ${
                    installerWorkshopId === w.id
                      ? 'border-accent bg-accent/10'
                      : 'border-apple-border bg-white'
                  }`}
                >
                  <Text
                    className={`font-semibold ${
                      installerWorkshopId === w.id ? 'text-accent' : 'text-apple-ink'
                    }`}
                  >
                    {w.workshop_name ?? w.display_name}
                  </Text>
                  <Text className="text-sm text-apple-secondary">@{w.handle}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* ---- Install date ---- */}
        <SectionHeading>Install date</SectionHeading>
        <View className="flex-row items-center gap-3">
          <View className="flex-1">
            <InstallDateField
              value={installDate}
              onChange={setInstallDate}
              showPicker={showDatePicker}
              onTogglePicker={() => setShowDatePicker((v) => !v)}
            />
          </View>
          <Toggle
            value={dateIsApproximate}
            onChange={setDateIsApproximate}
            label="Approx"
          />
        </View>

        {/* ---- Tools ---- */}
        <SectionHeading>Tools used (optional)</SectionHeading>
        <ModToolsForm tools={tools} onChange={setTools} />

        {/* ---- Notes ---- */}
        <SectionHeading>Notes (optional)</SectionHeading>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Anything worth remembering…"
          placeholderTextColor="#A1A1A6"
          multiline
          numberOfLines={3}
          className="min-h-[80px] rounded-xl border border-apple-border bg-white px-4 py-3 text-apple-ink"
        />

        {/* ---- Privacy ---- */}
        <SectionHeading>Privacy</SectionHeading>
        <View className="gap-2">
          {PRIVACIES.map((p) => {
            const active = privacy === p.value;
            return (
              <Pressable
                key={p.value}
                onPress={() => setPrivacy(p.value)}
                className={`flex-row items-center justify-between rounded-xl border px-4 py-3 ${
                  active ? 'border-accent bg-white' : 'border-apple-border bg-white'
                }`}
              >
                <View className="flex-1">
                  <Text
                    className={`font-semibold ${active ? 'text-accent' : 'text-apple-ink'}`}
                  >
                    {p.label}
                  </Text>
                  <Text className="text-xs text-apple-secondary">{p.hint}</Text>
                </View>
                <View
                  className={`h-5 w-5 rounded-full border-2 ${
                    active ? 'border-accent bg-accent' : 'border-apple-border bg-transparent'
                  }`}
                />
              </Pressable>
            );
          })}
        </View>

        {/* ---- Submit ---- */}
        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          className="mt-8 rounded-xl bg-accent py-3.5 active:bg-accent-dark disabled:opacity-60"
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-center text-base font-semibold text-white">
              Log mod
            </Text>
          )}
        </Pressable>
      </KeyboardSafeScrollView>
      )}
    </>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <Text className="mb-2 mt-6 text-xs font-semibold uppercase tracking-[2px] text-apple-secondary">
      {children}
    </Text>
  );
}

function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            className={`rounded-full border px-3.5 py-2 ${
              active
                ? 'border-accent bg-accent'
                : 'border-apple-border bg-white'
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                active ? 'text-apple-ink' : 'text-apple-secondary'
              }`}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      className={`rounded-full border px-3 py-2 ${
        value ? 'border-accent bg-accent' : 'border-apple-border bg-white'
      }`}
    >
      <Text
        className={`text-xs font-semibold ${
          value ? 'text-apple-ink' : 'text-apple-secondary'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
