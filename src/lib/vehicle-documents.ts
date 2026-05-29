import * as DocumentPicker from 'expo-document-picker';
import { Linking, Platform } from 'react-native';

import { deleteStorageObjects, uploadPrivateFile } from './storage';
import { supabase } from './supabase';
import type { Database } from '@/types/database';

export type VehicleDocument = Database['public']['Tables']['vehicle_documents']['Row'];

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
]);

const MAX_BYTES = 10 * 1024 * 1024;

export async function listVehicleDocuments(vehicleId: string): Promise<VehicleDocument[]> {
  const { data, error } = await supabase
    .from('vehicle_documents')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function uploadVehicleDocument(input: {
  vehicleId: string;
  ownerId: string;
  uri: string;
  fileName: string;
  mimeType: string;
  fileSize?: number | null;
}): Promise<VehicleDocument> {
  const mimeType = normalizeMimeType(input.mimeType, input.fileName);
  if (!ALLOWED_MIME.has(mimeType)) {
    throw new Error('Use a PDF or image file (JPEG, PNG, WebP).');
  }
  if (input.fileSize != null && input.fileSize > MAX_BYTES) {
    throw new Error('File must be 10 MB or smaller.');
  }

  const storageKey = await uploadPrivateFile({
    uri: input.uri,
    ownerId: input.ownerId,
    fileName: input.fileName,
    mimeType,
    prefix: 'doc',
  });

  const title = titleFromFileName(input.fileName);

  const { data, error } = await supabase
    .from('vehicle_documents')
    .insert({
      vehicle_id: input.vehicleId,
      owner_id: input.ownerId,
      title,
      file_name: input.fileName,
      storage_key: storageKey,
      mime_type: mimeType,
      file_size: input.fileSize ?? null,
    })
    .select()
    .single();

  if (error) {
    await deleteStorageObjects('receipts', [storageKey]);
    throw error;
  }

  return data;
}

export async function deleteVehicleDocument(doc: VehicleDocument): Promise<void> {
  const { error } = await supabase.from('vehicle_documents').delete().eq('id', doc.id);
  if (error) throw error;
  await deleteStorageObjects('receipts', [doc.storage_key]);
}

export async function getDocumentSignedUrl(storageKey: string, expiresSec = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from('receipts')
    .createSignedUrl(storageKey, expiresSec);
  if (error) throw error;
  return data.signedUrl;
}

export async function openVehicleDocument(doc: VehicleDocument): Promise<void> {
  const url = await getDocumentSignedUrl(doc.storage_key);
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  await Linking.openURL(url);
}

/** Native — pick PDF or image from Files / gallery. */
export async function pickVehicleDocumentNative(): Promise<{
  uri: string;
  fileName: string;
  mimeType: string;
  fileSize: number | null;
} | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    fileName: asset.name ?? 'document',
    mimeType: asset.mimeType ?? guessMimeFromName(asset.name ?? ''),
    fileSize: asset.size ?? null,
  };
}

function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  if (!base) return 'Document';
  return base.replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeMimeType(mimeType: string, fileName: string): string {
  const normalized = mimeType.toLowerCase().split(';')[0].trim();
  if (ALLOWED_MIME.has(normalized)) return normalized;
  return guessMimeFromName(fileName);
}

function guessMimeFromName(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
      return 'image/heic';
    default:
      return 'application/octet-stream';
  }
}

export function formatDocumentDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
