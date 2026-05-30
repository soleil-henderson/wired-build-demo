import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import {
  MaintenanceRecordForm,
  type MaintenanceFormValues,
  type PendingMaintenanceDocument,
} from '@/components/vehicle/MaintenanceRecordForm';
import { useAuth } from '@/lib/auth-context';
import {
  deleteMaintenanceRecord,
  formatServiceDate,
  getDueStatus,
  getMaintenanceRecord,
  linkDocumentToMaintenanceRecord,
  maintenanceTypeLabel,
  unlinkDocumentFromMaintenanceRecord,
  updateMaintenanceRecord,
  type MaintenanceRecordWithDocuments,
} from '@/lib/maintenance-records';
import { colors } from '@/lib/theme';
import {
  deleteVehicleDocument,
  openVehicleDocument,
  uploadVehicleDocument,
} from '@/lib/vehicle-documents';

function parseOptionalInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(/[^0-9]/g, ''));
  return Number.isNaN(n) ? null : n;
}

function parseOptionalCost(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(/[^0-9.]/g, ''));
  return Number.isNaN(n) ? null : n;
}

export default function MaintenanceRecordDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string; vehicleId?: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [record, setRecord] = useState<MaintenanceRecordWithDocuments | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const row = await getMaintenanceRecord(id);
      setRecord(row);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load record';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpdate(values: MaintenanceFormValues, pendingDocs: PendingMaintenanceDocument[]) {
    if (!session || !record) return;
    try {
      await updateMaintenanceRecord(record.id, {
        recordType: values.recordType,
        title: values.title,
        serviceDate: values.serviceDate,
        dateIsApproximate: values.dateIsApproximate,
        odometerKm: parseOptionalInt(values.odometerKm),
        cost: parseOptionalCost(values.cost),
        costIsApproximate: values.costIsApproximate,
        provider: values.provider,
        notes: values.notes,
        nextDueDate: values.nextDueDate.trim() || null,
        nextDueOdometerKm: parseOptionalInt(values.nextDueOdometerKm),
      });

      for (const doc of pendingDocs) {
        const uploaded = await uploadVehicleDocument({
          vehicleId: record.vehicle_id,
          ownerId: session.user.id,
          uri: doc.uri,
          fileName: doc.fileName,
          mimeType: doc.mimeType,
          fileSize: doc.fileSize,
        });
        await linkDocumentToMaintenanceRecord(record.id, uploaded.id);
      }

      setEditing(false);
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not update record';
      Alert.alert('Update failed', message);
    }
  }

  function confirmDelete() {
    if (!record) return;
    Alert.alert('Delete record?', `Remove "${record.title}" from service history.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMaintenanceRecord(record.id);
            router.back();
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Could not delete record';
            Alert.alert('Delete failed', message);
          }
        },
      },
    ]);
  }

  function confirmDeleteDocument(docId: string, title: string) {
    if (!record) return;
    Alert.alert('Remove document?', `Unlink "${title}" from this record.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await unlinkDocumentFromMaintenanceRecord(record.id, docId);
            await load();
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Could not remove document';
            Alert.alert('Error', message);
          }
        },
      },
    ]);
  }

  function confirmDeleteDocumentFile(docId: string, title: string) {
    if (!record) return;
    Alert.alert('Delete file?', `Permanently delete "${title}" from your garage.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete file',
        style: 'destructive',
        onPress: async () => {
          try {
            const doc = record.documents.find((d) => d.id === docId);
            if (!doc) return;
            await unlinkDocumentFromMaintenanceRecord(record.id, docId);
            await deleteVehicleDocument(doc);
            await load();
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Could not delete document';
            Alert.alert('Error', message);
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-apple-bg2">
        <Stack.Screen options={{ title: 'Service record' }} />
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!record) {
    return (
      <View className="flex-1 items-center justify-center bg-apple-bg2 px-6">
        <Stack.Screen options={{ title: 'Not found' }} />
        <Text className="text-center text-apple-secondary">This record is not available.</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="font-semibold text-accent">Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (editing) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Edit record',
            headerRight: () => (
              <Pressable onPress={() => setEditing(false)} hitSlop={8}>
                <Text className="font-semibold text-accent">Cancel</Text>
              </Pressable>
            ),
          }}
        />
        <MaintenanceRecordForm
          initial={record}
          existingDocuments={record.documents}
          onSubmit={handleUpdate}
          submitLabel="Save changes"
        />
      </>
    );
  }

  const dueStatus = getDueStatus(record.next_due_date);

  return (
    <ScrollView className="flex-1 bg-apple-bg2" contentContainerClassName="px-4 pb-12">
      <Stack.Screen
        options={{
          title: record.title,
          headerRight: () => (
            <Pressable onPress={() => setEditing(true)} hitSlop={8}>
              <Text className="font-semibold text-accent">Edit</Text>
            </Pressable>
          ),
        }}
      />

      <View className="mt-2 rounded-2xl border border-apple-border bg-white p-4">
        <Text className="text-xs font-semibold uppercase tracking-wider text-accent">
          {maintenanceTypeLabel(record.record_type)}
        </Text>
        <Text className="mt-1 text-2xl font-bold text-apple-ink">{record.title}</Text>
        <Text className="mt-1 text-sm text-apple-secondary">
          {formatServiceDate(record.service_date, record.date_is_approximate)}
          {record.odometer_km != null ? ` · ${record.odometer_km.toLocaleString()} km` : ''}
        </Text>
        {record.provider ? (
          <Text className="mt-1 text-sm text-apple-secondary">{record.provider}</Text>
        ) : null}

        {dueStatus === 'overdue' || dueStatus === 'due_soon' ? (
          <View
            className="mt-3 flex-row items-center gap-2 rounded-xl px-3 py-2"
            style={{
              backgroundColor: dueStatus === 'overdue' ? '#FFF1F0' : colors.amberSoft,
            }}
          >
            <Ionicons
              name="alert-circle-outline"
              size={16}
              color={dueStatus === 'overdue' ? colors.red : colors.amber}
            />
            <Text
              className="text-sm font-semibold"
              style={{ color: dueStatus === 'overdue' ? colors.red : colors.amber }}
            >
              {dueStatus === 'overdue' ? 'Overdue' : 'Due within 30 days'}
              {record.next_due_date
                ? ` · ${formatServiceDate(record.next_due_date)}`
                : ''}
            </Text>
          </View>
        ) : null}

        <View className="mt-4 flex-row flex-wrap gap-4 border-t border-apple-border pt-4">
          {record.cost != null ? (
            <Meta label="Cost" value={`$${Number(record.cost).toLocaleString()}`} />
          ) : null}
          {record.next_due_date ? (
            <Meta label="Next due" value={formatServiceDate(record.next_due_date)} />
          ) : null}
          {record.next_due_odometer_km != null ? (
            <Meta label="Due at" value={`${record.next_due_odometer_km.toLocaleString()} km`} />
          ) : null}
        </View>

        {record.notes ? (
          <View className="mt-4 border-t border-apple-border pt-4">
            <Text className="text-xs font-semibold uppercase tracking-wider text-apple-secondary">
              Notes
            </Text>
            <Text className="mt-1 text-sm leading-5 text-apple-ink">{record.notes}</Text>
          </View>
        ) : null}
      </View>

      {record.documents.length > 0 ? (
        <View className="mt-4">
          <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-apple-secondary">
            Documents
          </Text>
          <View className="overflow-hidden rounded-2xl border border-apple-border bg-white">
            {record.documents.map((doc, idx) => (
              <View
                key={doc.id}
                className={`flex-row items-center gap-3 px-4 py-3.5 ${
                  idx < record.documents.length - 1 ? 'border-b border-apple-border' : ''
                }`}
              >
                <Ionicons
                  name={doc.mime_type === 'application/pdf' ? 'document-outline' : 'image-outline'}
                  size={22}
                  color={colors.blue}
                />
                <Pressable
                  onPress={() =>
                    void openVehicleDocument(doc).catch((err) =>
                      Alert.alert('Could not open', err instanceof Error ? err.message : 'Try again.')
                    )
                  }
                  className="min-w-0 flex-1 active:opacity-70"
                >
                  <Text className="font-semibold text-apple-ink" numberOfLines={1}>
                    {doc.title}
                  </Text>
                  <Text className="text-xs text-apple-secondary">{doc.file_name}</Text>
                </Pressable>
                <Pressable
                  onPress={() => confirmDeleteDocument(doc.id, doc.title)}
                  hitSlop={8}
                  className="p-1"
                >
                  <Ionicons name="link-outline" size={18} color={colors.tertiary} />
                </Pressable>
                <Pressable
                  onPress={() => confirmDeleteDocumentFile(doc.id, doc.title)}
                  hitSlop={8}
                  className="p-1"
                >
                  <Ionicons name="trash-outline" size={18} color={colors.tertiary} />
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <Pressable
        onPress={confirmDelete}
        className="mt-8 items-center rounded-xl border border-apple-border bg-white py-3 active:bg-apple-bg2"
      >
        <Text className="font-semibold text-signal-red">Delete record</Text>
      </Pressable>
    </ScrollView>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text className="text-xs text-apple-secondary">{label}</Text>
      <Text className="text-sm font-semibold text-apple-ink">{value}</Text>
    </View>
  );
}
