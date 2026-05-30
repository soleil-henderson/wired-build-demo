import { supabase } from './supabase';
import type { Database, MaintenanceRecordType } from '@/types/database';
import type { VehicleDocument } from './vehicle-documents';

export type MaintenanceRecord = Database['public']['Tables']['maintenance_records']['Row'];

export type MaintenanceRecordWithDocuments = MaintenanceRecord & {
  documents: VehicleDocument[];
};

export const MAINTENANCE_TYPES: {
  value: MaintenanceRecordType;
  label: string;
  icon: string;
  defaultTitle: string;
}[] = [
  { value: 'oil_change', label: 'Oil change', icon: 'water-outline', defaultTitle: 'Oil change' },
  {
    value: 'general_service',
    label: 'General service',
    icon: 'build-outline',
    defaultTitle: 'General service',
  },
  {
    value: 'major_service',
    label: 'Major service',
    icon: 'construct-outline',
    defaultTitle: 'Major service',
  },
  { value: 'inspection', label: 'Inspection', icon: 'clipboard-outline', defaultTitle: 'Inspection' },
  { value: 'tyres', label: 'Tyres', icon: 'ellipse-outline', defaultTitle: 'Tyre service' },
  { value: 'brakes', label: 'Brakes', icon: 'stop-circle-outline', defaultTitle: 'Brake service' },
  {
    value: 'registration',
    label: 'Registration',
    icon: 'card-outline',
    defaultTitle: 'Registration renewal',
  },
  {
    value: 'insurance',
    label: 'Insurance',
    icon: 'shield-checkmark-outline',
    defaultTitle: 'Insurance renewal',
  },
  { value: 'other', label: 'Other', icon: 'ellipsis-horizontal', defaultTitle: 'Maintenance' },
];

export function maintenanceTypeLabel(type: MaintenanceRecordType): string {
  return MAINTENANCE_TYPES.find((t) => t.value === type)?.label ?? type.replace(/_/g, ' ');
}

export function maintenanceTypeIcon(type: MaintenanceRecordType): string {
  return MAINTENANCE_TYPES.find((t) => t.value === type)?.icon ?? 'construct-outline';
}

function mapRecordRows(
  rows: (MaintenanceRecord & {
    maintenance_record_documents?: { document: VehicleDocument | null }[] | null;
  })[]
): MaintenanceRecordWithDocuments[] {
  return rows.map((row) => {
    const { maintenance_record_documents, ...record } = row;
    const documents =
      maintenance_record_documents
        ?.map((link) => link.document)
        .filter((d): d is VehicleDocument => d != null) ?? [];
    return { ...record, documents };
  });
}

const recordSelect = `
  *,
  maintenance_record_documents (
    document:vehicle_documents (*)
  )
`;

export async function listMaintenanceRecords(
  vehicleId: string
): Promise<MaintenanceRecordWithDocuments[]> {
  const { data, error } = await supabase
    .from('maintenance_records')
    .select(recordSelect)
    .eq('vehicle_id', vehicleId)
    .order('service_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return mapRecordRows(data ?? []);
}

export async function getMaintenanceRecord(
  id: string
): Promise<MaintenanceRecordWithDocuments | null> {
  const { data, error } = await supabase
    .from('maintenance_records')
    .select(recordSelect)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapRecordRows([data])[0] ?? null;
}

export async function createMaintenanceRecord(input: {
  vehicleId: string;
  ownerId: string;
  recordType: MaintenanceRecordType;
  title: string;
  serviceDate: string;
  dateIsApproximate?: boolean;
  odometerKm?: number | null;
  cost?: number | null;
  costIsApproximate?: boolean;
  provider?: string | null;
  notes?: string | null;
  nextDueDate?: string | null;
  nextDueOdometerKm?: number | null;
}): Promise<MaintenanceRecord> {
  const { data, error } = await supabase
    .from('maintenance_records')
    .insert({
      vehicle_id: input.vehicleId,
      owner_id: input.ownerId,
      record_type: input.recordType,
      title: input.title.trim(),
      service_date: input.serviceDate,
      date_is_approximate: input.dateIsApproximate ?? false,
      odometer_km: input.odometerKm ?? null,
      cost: input.cost ?? null,
      cost_is_approximate: input.costIsApproximate ?? false,
      provider: input.provider?.trim() || null,
      notes: input.notes?.trim() || null,
      next_due_date: input.nextDueDate || null,
      next_due_odometer_km: input.nextDueOdometerKm ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMaintenanceRecord(
  id: string,
  input: {
    recordType?: MaintenanceRecordType;
    title?: string;
    serviceDate?: string;
    dateIsApproximate?: boolean;
    odometerKm?: number | null;
    cost?: number | null;
    costIsApproximate?: boolean;
    provider?: string | null;
    notes?: string | null;
    nextDueDate?: string | null;
    nextDueOdometerKm?: number | null;
  }
): Promise<void> {
  const patch: Database['public']['Tables']['maintenance_records']['Update'] = {};
  if (input.recordType != null) patch.record_type = input.recordType;
  if (input.title != null) patch.title = input.title.trim();
  if (input.serviceDate != null) patch.service_date = input.serviceDate;
  if (input.dateIsApproximate != null) patch.date_is_approximate = input.dateIsApproximate;
  if (input.odometerKm !== undefined) patch.odometer_km = input.odometerKm;
  if (input.cost !== undefined) patch.cost = input.cost;
  if (input.costIsApproximate != null) patch.cost_is_approximate = input.costIsApproximate;
  if (input.provider !== undefined) patch.provider = input.provider?.trim() || null;
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;
  if (input.nextDueDate !== undefined) patch.next_due_date = input.nextDueDate || null;
  if (input.nextDueOdometerKm !== undefined) patch.next_due_odometer_km = input.nextDueOdometerKm;

  const { error } = await supabase.from('maintenance_records').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteMaintenanceRecord(id: string): Promise<void> {
  const { error } = await supabase.from('maintenance_records').delete().eq('id', id);
  if (error) throw error;
}

export async function linkDocumentToMaintenanceRecord(
  maintenanceRecordId: string,
  documentId: string
): Promise<void> {
  const { error } = await supabase.from('maintenance_record_documents').insert({
    maintenance_record_id: maintenanceRecordId,
    document_id: documentId,
  });
  if (error) throw error;
}

export async function unlinkDocumentFromMaintenanceRecord(
  maintenanceRecordId: string,
  documentId: string
): Promise<void> {
  const { error } = await supabase
    .from('maintenance_record_documents')
    .delete()
    .eq('maintenance_record_id', maintenanceRecordId)
    .eq('document_id', documentId);
  if (error) throw error;
}

export type DueStatus = 'overdue' | 'due_soon' | 'ok' | null;

export function getDueStatus(nextDueDate: string | null): DueStatus {
  if (!nextDueDate) return null;
  const due = new Date(nextDueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 30) return 'due_soon';
  return 'ok';
}

export function formatServiceDate(iso: string, approximate?: boolean): string {
  const formatted = new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return approximate ? `~${formatted}` : formatted;
}

export function countDueRecords(records: MaintenanceRecord[]): {
  overdue: number;
  dueSoon: number;
} {
  let overdue = 0;
  let dueSoon = 0;
  for (const r of records) {
    const status = getDueStatus(r.next_due_date);
    if (status === 'overdue') overdue++;
    else if (status === 'due_soon') dueSoon++;
  }
  return { overdue, dueSoon };
}
