import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppleCard } from '@/components/apple/AppleCard';
import { useAuth } from '@/lib/auth-context';
import {
  MAINTENANCE_TYPES,
  maintenanceTypeLabel,
} from '@/lib/maintenance-records';
import { pickVehicleDocumentsNative, type PickedVehicleDocument } from '@/lib/vehicle-documents';
import {
  addDocumentImportItem,
  applyDocumentBatch,
  cancelDocumentBatch,
  classifyDocumentBatch,
  createDocumentImportBatch,
  MAX_IMPORT_FILES,
  type ApplyBatchItem,
  type DocumentImportItem,
} from '@/lib/wired-ai';
import { colors } from '@/lib/theme';
import type { MaintenanceRecordType, VehicleDocumentType } from '@/types/database';

type Step = 'pick' | 'uploading' | 'analyzing' | 'review' | 'applying' | 'done';

const DOCUMENT_TYPE_OPTIONS: { value: VehicleDocumentType; label: string }[] = [
  { value: 'registration', label: 'Registration' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'service_receipt', label: 'Service receipt' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'other', label: 'Other' },
];

type ReviewRow = DocumentImportItem & {
  accepted: boolean;
  editTitle: string;
  editRecordType: MaintenanceRecordType | '';
  editDocumentType: VehicleDocumentType;
  editServiceDate: string;
  editCost: string;
  editProvider: string;
};

export default function ImportDocumentsScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<Step>('pick');
  const [progress, setProgress] = useState('');
  const [batchId, setBatchId] = useState<string | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [appliedCount, setAppliedCount] = useState(0);

  async function startImport(files: PickedVehicleDocument[]) {
    if (!session || !vehicleId) return;
    if (files.length === 0) return;
    if (files.length > MAX_IMPORT_FILES) {
      Alert.alert('Too many files', `Select up to ${MAX_IMPORT_FILES} files at once.`);
      return;
    }

    setStep('uploading');
    let batch;
    try {
      batch = await createDocumentImportBatch({
        vehicleId,
        userId: session.user.id,
      });
      setBatchId(batch.id);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress(`Uploading ${i + 1} of ${files.length}…`);
        const { uploadImportTempFile } = await import('@/lib/wired-ai');
        const key = await uploadImportTempFile({
          uri: file.uri,
          ownerId: session.user.id,
          batchId: batch.id,
          fileName: file.fileName,
          mimeType: file.mimeType,
        });
        await addDocumentImportItem({
          batchId: batch.id,
          tempStorageKey: key,
          fileName: file.fileName,
          mimeType: file.mimeType,
          fileSize: file.fileSize,
        });
      }

      setStep('analyzing');
      setProgress('Analyzing documents with Wired AI…');
      const result = await classifyDocumentBatch(batch.id);
      setRows(result.items.map(itemToReviewRow));
      setStep('review');
    } catch (err) {
      if (batch?.id) {
        await cancelDocumentBatch(batch.id).catch(() => undefined);
      }
      setStep('pick');
      Alert.alert('Import failed', err instanceof Error ? err.message : 'Try again.');
    }
  }

  async function handlePickNative() {
    try {
      const picked = await pickVehicleDocumentsNative(true);
      await startImport(picked);
    } catch (err) {
      Alert.alert('Pick failed', err instanceof Error ? err.message : 'Could not pick files');
    }
  }

  async function applyWebFiles(fileList: FileList | null | undefined) {
    if (!fileList?.length) return;
    const files: PickedVehicleDocument[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const mimeType = file.type || 'application/octet-stream';
      if (!mimeType.startsWith('image/') && mimeType !== 'application/pdf') continue;
      files.push({
        uri: URL.createObjectURL(file),
        fileName: file.name,
        mimeType,
        fileSize: file.size,
      });
    }
    if (files.length === 0) {
      Alert.alert('Invalid files', 'Choose PDF or image files.');
      return;
    }
    await startImport(files);
  }

  async function handleConfirm() {
    if (!batchId) return;
    setStep('applying');
    try {
      const items: ApplyBatchItem[] = rows.map((row) => ({
        id: row.id,
        status: row.accepted ? 'accepted' : 'skipped',
        proposed_title: row.editTitle.trim() || row.proposed_title,
        proposed_record_type: row.editRecordType || null,
        proposed_document_type: row.editDocumentType,
        proposed_service_date: row.editServiceDate.trim() || null,
        proposed_cost: row.editCost.trim() ? Number(row.editCost) : null,
        proposed_provider: row.editProvider.trim() || null,
      }));
      const result = await applyDocumentBatch(batchId, items);
      const count = result.results.filter((r) => !r.skipped).length;
      setAppliedCount(count);
      setStep('done');
    } catch (err) {
      setStep('review');
      Alert.alert('Apply failed', err instanceof Error ? err.message : 'Try again.');
    }
  }

  async function handleCancel() {
    if (batchId && step !== 'done') {
      await cancelDocumentBatch(batchId).catch(() => undefined);
    }
    router.back();
  }

  function updateRow(id: string, patch: Partial<ReviewRow>) {
    setRows((current) => current.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  return (
    <View className="flex-1 bg-apple-bg2">
      <Stack.Screen
        options={{
          title: 'Import paperwork',
          headerLeft: () => (
            <Pressable onPress={() => void handleCancel()} hitSlop={8} className="px-1">
              <Text className="text-[17px] text-signal-blue">Cancel</Text>
            </Pressable>
          ),
        }}
      />

      {step === 'pick' ? (
        <View className="flex-1 items-center justify-center px-6">
          {Platform.OS === 'web' ? (
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/*"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                void applyWebFiles(e.target.files);
                e.target.value = '';
              }}
            />
          ) : null}

          <View className="mb-4 h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-white">
            <Ionicons name="documents-outline" size={34} color={colors.blue} />
          </View>
          <Text className="text-xl font-bold text-apple-ink">Bulk import</Text>
          <Text className="mt-2 max-w-[300px] text-center text-[15px] leading-[22px] text-apple-secondary">
            Upload registration, insurance, and service paperwork. Wired AI will suggest where each file belongs — you confirm before anything is filed.
          </Text>
          <Pressable
            onPress={() => {
              if (Platform.OS === 'web') fileInputRef.current?.click();
              else void handlePickNative();
            }}
            className="mt-6 rounded-xl px-6 py-3 active:opacity-90"
            style={{ backgroundColor: colors.blue }}
          >
            <Text className="text-[15px] font-semibold text-white">Choose files</Text>
          </Pressable>
          <Text className="mt-2 text-xs text-apple-tertiary">
            PDF or image · up to 10 MB each · max {MAX_IMPORT_FILES} files
          </Text>
        </View>
      ) : null}

      {step === 'uploading' || step === 'analyzing' || step === 'applying' ? (
        <View className="flex-1 items-center justify-center px-6">
          <ActivityIndicator color={colors.accent} size="large" />
          <Text className="mt-4 text-center text-[15px] text-apple-secondary">{progress}</Text>
        </View>
      ) : null}

      {step === 'review' ? (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          <Text className="mb-3 text-[13px] text-apple-secondary">
            Review Wired AI suggestions. Toggle off any file you do not want to import.
          </Text>
          {rows.map((row) => (
            <ReviewCard key={row.id} row={row} onChange={(patch) => updateRow(row.id, patch)} />
          ))}
          <Pressable
            onPress={() => void handleConfirm()}
            className="mt-4 rounded-xl py-3.5 active:opacity-90"
            style={{ backgroundColor: colors.blue }}
          >
            <Text className="text-center text-[15px] font-semibold text-white">
              Confirm import ({rows.filter((r) => r.accepted).length} files)
            </Text>
          </Pressable>
        </ScrollView>
      ) : null}

      {step === 'done' ? (
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="checkmark-circle" size={64} color={colors.accent} />
          <Text className="mt-4 text-xl font-bold text-apple-ink">Import complete</Text>
          <Text className="mt-2 text-center text-[15px] text-apple-secondary">
            {appliedCount} file{appliedCount === 1 ? '' : 's'} filed to your garage.
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-6 rounded-xl px-6 py-3 active:opacity-90"
            style={{ backgroundColor: colors.blue }}
          >
            <Text className="text-[15px] font-semibold text-white">Done</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function itemToReviewRow(item: DocumentImportItem): ReviewRow {
  return {
    ...item,
    accepted: true,
    editTitle: item.proposed_title ?? item.file_name.replace(/\.[^.]+$/, ''),
    editRecordType: item.proposed_record_type ?? '',
    editDocumentType: item.proposed_document_type ?? 'other',
    editServiceDate: item.proposed_service_date ?? '',
    editCost: item.proposed_cost != null ? String(item.proposed_cost) : '',
    editProvider: item.proposed_provider ?? '',
  };
}

function ReviewCard({
  row,
  onChange,
}: {
  row: ReviewRow;
  onChange: (patch: Partial<ReviewRow>) => void;
}) {
  const confidenceColor =
    row.confidence === 'high'
      ? colors.accent
      : row.confidence === 'medium'
        ? colors.amber
        : colors.tertiary;

  return (
    <AppleCard padded className="mb-3">
      <View className="mb-3 flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="font-semibold text-apple-ink" numberOfLines={2}>
            {row.file_name}
          </Text>
          {row.reasoning ? (
            <Text className="mt-1 text-xs text-apple-secondary">{row.reasoning}</Text>
          ) : null}
        </View>
        <Switch
          value={row.accepted}
          onValueChange={(accepted) => onChange({ accepted })}
          trackColor={{ true: colors.accent, false: colors.border }}
        />
      </View>

      {row.accepted ? (
        <View className="gap-3">
          <Field label="Title">
            <TextInput
              value={row.editTitle}
              onChangeText={(editTitle) => onChange({ editTitle })}
              className="rounded-lg bg-apple-bg2 px-3 py-2 text-[15px] text-apple-ink"
            />
          </Field>

          <Field label="Document type">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    onPress={() => onChange({ editDocumentType: opt.value })}
                    className={`rounded-full px-3 py-1.5 ${
                      row.editDocumentType === opt.value ? 'bg-accent' : 'bg-apple-bg2'
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        row.editDocumentType === opt.value ? 'text-white' : 'text-apple-secondary'
                      }`}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </Field>

          <Field label="Service history type (optional)">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => onChange({ editRecordType: '' })}
                  className={`rounded-full px-3 py-1.5 ${
                    !row.editRecordType ? 'bg-accent' : 'bg-apple-bg2'
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      !row.editRecordType ? 'text-white' : 'text-apple-secondary'
                    }`}
                  >
                    Docs only
                  </Text>
                </Pressable>
                {MAINTENANCE_TYPES.map((opt) => (
                  <Pressable
                    key={opt.value}
                    onPress={() => onChange({ editRecordType: opt.value })}
                    className={`rounded-full px-3 py-1.5 ${
                      row.editRecordType === opt.value ? 'bg-accent' : 'bg-apple-bg2'
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        row.editRecordType === opt.value ? 'text-white' : 'text-apple-secondary'
                      }`}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </Field>

          {row.editRecordType ? (
            <>
              <Field label="Service date">
                <TextInput
                  value={row.editServiceDate}
                  onChangeText={(editServiceDate) => onChange({ editServiceDate })}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.tertiary}
                  className="rounded-lg bg-apple-bg2 px-3 py-2 text-[15px] text-apple-ink"
                />
              </Field>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Field label="Cost (AUD)">
                    <TextInput
                      value={row.editCost}
                      onChangeText={(editCost) => onChange({ editCost })}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={colors.tertiary}
                      className="rounded-lg bg-apple-bg2 px-3 py-2 text-[15px] text-apple-ink"
                    />
                  </Field>
                </View>
                <View className="flex-1">
                  <Field label="Provider">
                    <TextInput
                      value={row.editProvider}
                      onChangeText={(editProvider) => onChange({ editProvider })}
                      placeholder="Workshop name"
                      placeholderTextColor={colors.tertiary}
                      className="rounded-lg bg-apple-bg2 px-3 py-2 text-[15px] text-apple-ink"
                    />
                  </Field>
                </View>
              </View>
            </>
          ) : null}

          {row.confidence ? (
            <Text className="text-[11px] font-medium" style={{ color: confidenceColor }}>
              Confidence: {row.confidence}
              {row.editRecordType ? ` · ${maintenanceTypeLabel(row.editRecordType)}` : ' · Docs only'}
            </Text>
          ) : null}
        </View>
      ) : (
        <Text className="text-sm text-apple-tertiary">Skipped — will not be imported</Text>
      )}
    </AppleCard>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View>
      <Text className="mb-1 text-xs font-semibold text-apple-secondary">{label}</Text>
      {children}
    </View>
  );
}
