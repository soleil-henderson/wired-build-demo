import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from 'react-native';

import {
  MaintenanceRecordForm,
  type MaintenanceFormValues,
  type PendingMaintenanceDocument,
} from '@/components/vehicle/MaintenanceRecordForm';
import { useAuth } from '@/lib/auth-context';
import {
  createMaintenanceRecord,
  linkDocumentToMaintenanceRecord,
} from '@/lib/maintenance-records';
import { uploadVehicleDocument } from '@/lib/vehicle-documents';

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

async function uploadAndLinkDocuments(
  recordId: string,
  vehicleId: string,
  ownerId: string,
  pendingDocs: PendingMaintenanceDocument[]
): Promise<void> {
  for (const doc of pendingDocs) {
    const uploaded = await uploadVehicleDocument({
      vehicleId,
      ownerId,
      uri: doc.uri,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
    });
    await linkDocumentToMaintenanceRecord(recordId, uploaded.id);
  }
}

export default function NewMaintenanceRecordScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const router = useRouter();
  const { session } = useAuth();

  async function handleSubmit(values: MaintenanceFormValues, pendingDocs: PendingMaintenanceDocument[]) {
    if (!session || !vehicleId) {
      Alert.alert('Sign in required', 'Sign in to log maintenance.');
      return;
    }

    try {
      const record = await createMaintenanceRecord({
        vehicleId,
        ownerId: session.user.id,
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

      if (pendingDocs.length > 0) {
        await uploadAndLinkDocuments(record.id, vehicleId, session.user.id, pendingDocs);
      }

      router.back();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save record';
      Alert.alert('Save failed', message);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Log service' }} />
      <MaintenanceRecordForm onSubmit={handleSubmit} submitLabel="Save record" />
    </>
  );
}
