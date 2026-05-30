import type {
  Database,
  MaintenanceRecordType,
  VehicleDocumentType,
} from '@/types/database';
import { supabase } from './supabase';

export type AiMessage = Database['public']['Tables']['ai_messages']['Row'];
export type AiConversation = Database['public']['Tables']['ai_conversations']['Row'];
export type DocumentImportBatch = Database['public']['Tables']['document_import_batches']['Row'];
export type DocumentImportItem = Database['public']['Tables']['document_import_items']['Row'];

export type WiredAiUsage = {
  unlimited: boolean;
  used: number;
  limit: number | null;
  remaining: number | null;
};

export type ChatResponse = {
  conversation_id: string;
  message: AiMessage;
  usage: WiredAiUsage;
};

export type ApplyBatchItem = {
  id: string;
  status: 'accepted' | 'skipped';
  proposed_title?: string | null;
  proposed_record_type?: MaintenanceRecordType | null;
  proposed_document_type?: VehicleDocumentType | null;
  proposed_service_date?: string | null;
  proposed_cost?: number | null;
  proposed_provider?: string | null;
};

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in to use Wired AI.');

  const apikey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
  return {
    Authorization: `Bearer ${token}`,
    apikey,
    'Content-Type': 'application/json',
  };
}

async function callWiredAi<T>(body: Record<string, unknown>): Promise<T> {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const res = await fetch(`${base}/functions/v1/wired-ai`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  type ErrorPayload = { error?: string; message?: string; code?: string };
  let payload: (T & ErrorPayload) | ErrorPayload | null = null;
  try {
    payload = raw ? (JSON.parse(raw) as T & ErrorPayload) : null;
  } catch {
    /* plain-text gateway response */
  }

  if (!res.ok) {
    const code = payload && 'code' in payload ? payload.code : undefined;
    const msg =
      (payload && 'error' in payload && payload.error) ||
      (payload && 'message' in payload && payload.message) ||
      raw ||
      `Wired AI failed (${res.status})`;
    const isGateway503 =
      res.status === 503 ||
      code === 'BOOT_ERROR' ||
      /boot|restarting|function_invocation/i.test(raw);
    const prefillError =
      /assistant message prefill|must end with a user message/i.test(msg);
    const friendly =
      res.status === 504 || res.status === 546
        ? 'Wired AI timed out — try a shorter message or import fewer items at once, then send again.'
        : isGateway503
          ? 'Wired AI is busy or restarting — wait a few seconds and try again. If it persists, redeploy wired-ai on Supabase.'
          : prefillError
            ? 'Wired AI could not continue this thread — send your message again. If it keeps failing, start a fresh chat from the vehicle menu.'
            : msg;
    const err = new Error(friendly) as Error & { code?: string; status?: number };
    if (payload && 'code' in payload && payload.code) err.code = payload.code;
    err.status = res.status;
    throw err;
  }

  return payload as T;
}

export async function getWiredAiUsage(): Promise<WiredAiUsage> {
  return callWiredAi({ action: 'get_usage' });
}

export async function sendWiredAiMessage(input: {
  vehicleId: string;
  message: string;
  conversationId?: string;
}): Promise<ChatResponse> {
  return callWiredAi({
    action: 'chat',
    vehicle_id: input.vehicleId,
    message: input.message,
    conversation_id: input.conversationId,
  });
}

export async function classifyDocumentBatch(batchId: string): Promise<{
  batch_id: string;
  status: string;
  items: DocumentImportItem[];
}> {
  return callWiredAi({
    action: 'classify_batch',
    batch_id: batchId,
  });
}

export async function applyDocumentBatch(
  batchId: string,
  items: ApplyBatchItem[]
): Promise<{
  batch_id: string;
  status: string;
  results: { id: string; document_id?: string; maintenance_record_id?: string; skipped?: boolean }[];
}> {
  return callWiredAi({
    action: 'apply_batch',
    batch_id: batchId,
    items,
  });
}

export async function cancelDocumentBatch(batchId: string): Promise<{ batch_id: string; status: string }> {
  return callWiredAi({
    action: 'cancel_batch',
    batch_id: batchId,
  });
}

export async function getOrCreateVehicleConversation(
  vehicleId: string,
  userId: string
): Promise<AiConversation> {
  const { data: existing } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .from('ai_conversations')
    .insert({
      user_id: userId,
      vehicle_id: vehicleId,
      title: 'Wired AI',
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function listAiMessages(conversationId: string): Promise<AiMessage[]> {
  const { data, error } = await supabase
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .in('role', ['user', 'assistant'])
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export function aiMessageText(message: AiMessage): string {
  const content = message.content as { text?: string };
  return content?.text ?? '';
}

export async function createDocumentImportBatch(input: {
  vehicleId: string;
  userId: string;
}): Promise<DocumentImportBatch> {
  const { data, error } = await supabase
    .from('document_import_batches')
    .insert({
      vehicle_id: input.vehicleId,
      user_id: input.userId,
      status: 'analyzing',
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function addDocumentImportItem(input: {
  batchId: string;
  tempStorageKey: string;
  fileName: string;
  mimeType: string;
  fileSize?: number | null;
}): Promise<DocumentImportItem> {
  const { data, error } = await supabase
    .from('document_import_items')
    .insert({
      batch_id: input.batchId,
      temp_storage_key: input.tempStorageKey,
      file_name: input.fileName,
      mime_type: input.mimeType,
      file_size: input.fileSize ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function listDocumentImportItems(batchId: string): Promise<DocumentImportItem[]> {
  const { data, error } = await supabase
    .from('document_import_items')
    .select('*')
    .eq('batch_id', batchId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function uploadImportTempFile(input: {
  uri: string;
  ownerId: string;
  batchId: string;
  fileName: string;
  mimeType: string;
}): Promise<string> {
  const { uploadPrivateFileWithKey } = await import('./storage');
  const ext = input.fileName.split('.').pop()?.toLowerCase() ?? 'bin';
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 48);
  const key = `${input.ownerId}/import-${input.batchId}/${cryptoRandomId()}-${safeName}.${ext}`;
  return uploadPrivateFileWithKey({
    uri: input.uri,
    key,
    mimeType: input.mimeType,
  });
}

function cryptoRandomId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  let out = '';
  for (let i = 0; i < 16; i++) {
    out += Math.floor(Math.random() * 16).toString(16);
  }
  return out;
}

export const MAX_IMPORT_FILES = 25;
