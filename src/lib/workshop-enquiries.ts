import { supabase } from './supabase';
import type { WorkshopEnquiryStatus } from '@/types/database';

export type WorkshopEnquiry = {
  id: string;
  workshop_user_id: string;
  sender_name: string;
  sender_email: string;
  sender_phone: string | null;
  message: string;
  status: WorkshopEnquiryStatus;
  created_at: string;
};

export async function submitWorkshopEnquiry(input: {
  workshopUserId: string;
  senderUserId?: string | null;
  senderName: string;
  senderEmail: string;
  senderPhone?: string | null;
  message: string;
}): Promise<void> {
  const { error } = await supabase.from('workshop_enquiries').insert({
    workshop_user_id: input.workshopUserId,
    sender_user_id: input.senderUserId ?? null,
    sender_name: input.senderName.trim(),
    sender_email: input.senderEmail.trim(),
    sender_phone: input.senderPhone?.trim() || null,
    message: input.message.trim(),
  });
  if (error) throw error;
}

export async function listWorkshopEnquiries(
  workshopUserId: string
): Promise<WorkshopEnquiry[]> {
  const { data, error } = await supabase
    .from('workshop_enquiries')
    .select('id, workshop_user_id, sender_name, sender_email, sender_phone, message, status, created_at')
    .eq('workshop_user_id', workshopUserId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as WorkshopEnquiry[];
}

export async function updateEnquiryStatus(
  enquiryId: string,
  workshopUserId: string,
  status: WorkshopEnquiryStatus
): Promise<void> {
  const { error } = await supabase
    .from('workshop_enquiries')
    .update({ status })
    .eq('id', enquiryId)
    .eq('workshop_user_id', workshopUserId);
  if (error) throw error;
}

export async function countNewEnquiries(workshopUserId: string): Promise<number> {
  const { count, error } = await supabase
    .from('workshop_enquiries')
    .select('id', { count: 'exact', head: true })
    .eq('workshop_user_id', workshopUserId)
    .eq('status', 'new');
  if (error) return 0;
  return count ?? 0;
}
