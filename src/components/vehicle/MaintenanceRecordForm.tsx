import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { InstallDateField } from '@/components/InstallDateField';
import { KeyboardSafeScrollView } from '@/components/ui/KeyboardSafeView';
import {
  MAINTENANCE_TYPES,
  type MaintenanceRecordWithDocuments,
} from '@/lib/maintenance-records';
import { colors, inputClassName } from '@/lib/theme';
import type { MaintenanceRecordType } from '@/types/database';
import {
  pickVehicleDocumentNative,
  type VehicleDocument,
} from '@/lib/vehicle-documents';

export type PendingMaintenanceDocument = {
  uri: string;
  fileName: string;
  mimeType: string;
  fileSize?: number | null;
};

export type MaintenanceFormValues = {
  recordType: MaintenanceRecordType;
  title: string;
  serviceDate: string;
  dateIsApproximate: boolean;
  odometerKm: string;
  cost: string;
  costIsApproximate: boolean;
  provider: string;
  notes: string;
  nextDueDate: string;
  nextDueOdometerKm: string;
};

type Props = {
  initial?: MaintenanceRecordWithDocuments | null;
  existingDocuments?: VehicleDocument[];
  onSubmit: (values: MaintenanceFormValues, pendingDocs: PendingMaintenanceDocument[]) => Promise<void>;
  submitLabel?: string;
};

function todayIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function MaintenanceRecordForm({
  initial,
  existingDocuments = [],
  onSubmit,
  submitLabel = 'Save record',
}: Props) {
  const defaultType = initial?.record_type ?? 'general_service';
  const defaultTypeMeta = MAINTENANCE_TYPES.find((t) => t.value === defaultType);

  const [recordType, setRecordType] = useState<MaintenanceRecordType>(defaultType);
  const [title, setTitle] = useState(initial?.title ?? defaultTypeMeta?.defaultTitle ?? '');
  const [titleTouched, setTitleTouched] = useState(!!initial?.title);
  const [serviceDate, setServiceDate] = useState(initial?.service_date ?? todayIso());
  const [showServiceDatePicker, setShowServiceDatePicker] = useState(false);
  const [dateIsApproximate, setDateIsApproximate] = useState(initial?.date_is_approximate ?? false);
  const [odometerKm, setOdometerKm] = useState(
    initial?.odometer_km != null ? String(initial.odometer_km) : ''
  );
  const [cost, setCost] = useState(initial?.cost != null ? String(initial.cost) : '');
  const [costIsApproximate, setCostIsApproximate] = useState(initial?.cost_is_approximate ?? false);
  const [provider, setProvider] = useState(initial?.provider ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [nextDueDate, setNextDueDate] = useState(initial?.next_due_date ?? '');
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const [nextDueOdometerKm, setNextDueOdometerKm] = useState(
    initial?.next_due_odometer_km != null ? String(initial.next_due_odometer_km) : ''
  );
  const [pendingDocs, setPendingDocs] = useState<PendingMaintenanceDocument[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showDueFields = useMemo(
    () =>
      recordType === 'registration' ||
      recordType === 'insurance' ||
      recordType === 'oil_change' ||
      recordType === 'general_service' ||
      recordType === 'major_service',
    [recordType]
  );

  function selectType(type: MaintenanceRecordType) {
    setRecordType(type);
    if (!titleTouched) {
      const meta = MAINTENANCE_TYPES.find((t) => t.value === type);
      if (meta) setTitle(meta.defaultTitle);
    }
  }

  async function handlePickNative() {
    const picked = await pickVehicleDocumentNative();
    if (!picked) return;
    setPendingDocs((current) => [...current, picked]);
  }

  async function applyWebFile(file: globalThis.File | undefined) {
    if (!file) return;
    const mimeType = file.type || 'application/octet-stream';
    if (!mimeType.startsWith('image/') && mimeType !== 'application/pdf') return;
    setPendingDocs((current) => [
      ...current,
      {
        uri: URL.createObjectURL(file),
        fileName: file.name,
        mimeType,
        fileSize: file.size,
      },
    ]);
  }

  async function handleSubmit() {
    if (!title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) return;
    setSaving(true);
    try {
      await onSubmit(
        {
          recordType,
          title,
          serviceDate,
          dateIsApproximate,
          odometerKm,
          cost,
          costIsApproximate,
          provider,
          notes,
          nextDueDate,
          nextDueOdometerKm,
        },
        pendingDocs
      );
    } finally {
      setSaving(false);
    }
  }

  const linkedDocs = initial ? existingDocuments : [];
  const totalDocs = linkedDocs.length + pendingDocs.length;

  return (
    <KeyboardSafeScrollView className="flex-1 bg-apple-bg2" contentContainerClassName="px-4 pt-2">
      {Platform.OS === 'web' ? (
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            const files = e.target.files;
            if (files) {
              for (const file of Array.from(files)) {
                void applyWebFile(file);
              }
            }
            e.target.value = '';
          }}
        />
      ) : null}

      <SectionHeading>Type</SectionHeading>
      <View className="mb-4 flex-row flex-wrap gap-2">
        {MAINTENANCE_TYPES.map((type) => {
          const active = recordType === type.value;
          return (
            <Pressable
              key={type.value}
              onPress={() => selectType(type.value)}
              className={`flex-row items-center gap-1.5 rounded-full border px-3 py-2 ${
                active ? 'border-accent bg-accent-soft' : 'border-apple-border bg-white'
              }`}
            >
              <Ionicons
                name={type.icon as keyof typeof Ionicons.glyphMap}
                size={14}
                color={active ? colors.accent : colors.secondary}
              />
              <Text
                className={`text-sm font-semibold ${active ? 'text-accent' : 'text-apple-secondary'}`}
              >
                {type.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <SectionHeading>Details</SectionHeading>
      <View className="gap-3">
        <Field label="Title">
          <TextInput
            value={title}
            onChangeText={(v) => {
              setTitleTouched(true);
              setTitle(v);
            }}
            placeholder="e.g. 100,000 km service"
            placeholderTextColor={colors.tertiary}
            className={inputClassName}
          />
        </Field>

        <Field label="Date">
          <InstallDateField
            value={serviceDate}
            onChange={setServiceDate}
            showPicker={showServiceDatePicker}
            onTogglePicker={() => setShowServiceDatePicker((v) => !v)}
          />
        </Field>

        <ToggleRow
          label="Approximate date"
          value={dateIsApproximate}
          onChange={setDateIsApproximate}
        />

        <Field label="Odometer (km)" hint="Optional">
          <TextInput
            value={odometerKm}
            onChangeText={setOdometerKm}
            placeholder="e.g. 85000"
            placeholderTextColor={colors.tertiary}
            keyboardType="number-pad"
            className={inputClassName}
          />
        </Field>

        <Field label="Cost (AUD)" hint="Optional">
          <View className="flex-row items-center rounded-xl border border-apple-border bg-white px-4">
            <Text className="text-apple-secondary">$</Text>
            <TextInput
              value={cost}
              onChangeText={setCost}
              placeholder="0.00"
              placeholderTextColor={colors.tertiary}
              keyboardType="decimal-pad"
              className="ml-2 flex-1 py-3 text-apple-ink"
            />
          </View>
        </Field>

        <ToggleRow
          label="Approximate cost"
          value={costIsApproximate}
          onChange={setCostIsApproximate}
        />

        <Field
          label={recordType === 'insurance' ? 'Insurer' : recordType === 'registration' ? 'Authority' : 'Workshop / provider'}
          hint="Optional"
        >
          <TextInput
            value={provider}
            onChangeText={setProvider}
            placeholder={
              recordType === 'insurance'
                ? 'e.g. NRMA'
                : recordType === 'registration'
                  ? 'e.g. Service NSW'
                  : 'e.g. Local mechanic'
            }
            placeholderTextColor={colors.tertiary}
            className={inputClassName}
          />
        </Field>

        <Field label="Notes" hint="Optional">
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Parts replaced, policy number, etc."
            placeholderTextColor={colors.tertiary}
            multiline
            className={`min-h-[88px] ${inputClassName}`}
            textAlignVertical="top"
          />
        </Field>
      </View>

      {showDueFields ? (
        <>
          <SectionHeading>Next due</SectionHeading>
          <Text className="mb-3 text-sm text-apple-secondary">
            Set a reminder for registration, insurance, or your next service interval.
          </Text>
          <View className="gap-3">
            <Field label="Due date" hint="Optional">
              <InstallDateField
                value={nextDueDate}
                onChange={setNextDueDate}
                showPicker={showDueDatePicker}
                onTogglePicker={() => setShowDueDatePicker((v) => !v)}
              />
            </Field>
            <Field label="Due at odometer (km)" hint="Optional">
              <TextInput
                value={nextDueOdometerKm}
                onChangeText={setNextDueOdometerKm}
                placeholder="e.g. 95000"
                placeholderTextColor={colors.tertiary}
                keyboardType="number-pad"
                className={inputClassName}
              />
            </Field>
          </View>
        </>
      ) : null}

      <SectionHeading>Documents</SectionHeading>
      <Text className="mb-3 text-sm text-apple-secondary">
        Attach invoices, rego papers, insurance certificates, or service reports.
      </Text>

      <Pressable
        onPress={() => {
          if (Platform.OS === 'web') fileInputRef.current?.click();
          else void handlePickNative();
        }}
        className="mb-3 flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-apple-border bg-white py-3 active:bg-apple-bg2"
      >
        <Ionicons name="cloud-upload-outline" size={18} color={colors.blue} />
        <Text className="font-semibold text-signal-blue">Add document</Text>
      </Pressable>

      {totalDocs === 0 ? (
        <Text className="text-sm text-apple-tertiary">PDF or image · up to 10 MB each</Text>
      ) : (
        <View className="gap-2">
          {linkedDocs.map((doc) => (
            <DocChip key={doc.id} name={doc.title} existing />
          ))}
          {pendingDocs.map((doc, i) => (
            <DocChip
              key={`${doc.fileName}-${i}`}
              name={doc.fileName}
              onRemove={() => setPendingDocs((current) => current.filter((_, idx) => idx !== i))}
            />
          ))}
        </View>
      )}

      <Pressable
        onPress={() => void handleSubmit()}
        disabled={saving || !title.trim()}
        className="mt-8 rounded-xl bg-accent py-3.5 disabled:opacity-50"
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-center text-base font-semibold text-white">{submitLabel}</Text>
        )}
      </Pressable>
    </KeyboardSafeScrollView>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <Text className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-apple-secondary">
      {children}
    </Text>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View>
      <Text className="mb-1.5 text-sm font-semibold text-apple-ink">{label}</Text>
      {hint ? <Text className="mb-1.5 text-xs text-apple-tertiary">{hint}</Text> : null}
      {children}
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View className="flex-row items-center justify-between rounded-xl border border-apple-border bg-white px-4 py-3">
      <Text className="text-sm font-medium text-apple-ink">{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.accent }} />
    </View>
  );
}

function DocChip({
  name,
  existing,
  onRemove,
}: {
  name: string;
  existing?: boolean;
  onRemove?: () => void;
}) {
  return (
    <View className="flex-row items-center gap-2 rounded-xl border border-apple-border bg-white px-3 py-2.5">
      <Ionicons
        name={existing ? 'document-text-outline' : 'document-outline'}
        size={18}
        color={colors.blue}
      />
      <Text className="min-w-0 flex-1 text-sm font-medium text-apple-ink" numberOfLines={1}>
        {name}
      </Text>
      {onRemove ? (
        <Pressable onPress={onRemove} hitSlop={8}>
          <Ionicons name="close-circle" size={20} color={colors.tertiary} />
        </Pressable>
      ) : null}
    </View>
  );
}
