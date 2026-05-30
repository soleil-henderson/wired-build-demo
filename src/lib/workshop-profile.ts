import { supabase } from './supabase';
import type { AccountType, ModCategory } from '@/types/database';
import { normalizeHandle, validateHandle } from './profile';

export type WorkshopProfileInput = {
  handle: string;
  display_name: string;
  workshop_name: string;
  workshop_contact_name: string;
  workshop_business_email: string;
  workshop_phone: string;
  workshop_website: string | null;
  workshop_abn: string | null;
  workshop_business_type: string | null;
  workshop_address: string | null;
  workshop_service_area: string | null;
  workshop_hours: string | null;
  workshop_tagline: string | null;
  workshop_description: string | null;
  workshop_instagram: string | null;
  workshop_facebook: string | null;
  workshop_booking_url: string | null;
  bio: string | null;
};

export type WorkshopPublicProfile = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  is_workshop: boolean;
  account_type?: string;
  is_identity_verified: boolean;
  subscription_tier: import('@/types/database').SubscriptionTier;
  workshop_name: string | null;
  workshop_phone: string | null;
  workshop_website: string | null;
  workshop_tagline: string | null;
  workshop_description: string | null;
  workshop_address: string | null;
  workshop_service_area: string | null;
  workshop_hours: string | null;
  workshop_instagram: string | null;
  workshop_facebook: string | null;
  workshop_logo_url: string | null;
  workshop_cover_url: string | null;
  workshop_booking_url: string | null;
  workshop_business_type: string | null;
};

const WORKSHOP_PUBLIC_SELECT = `
  id, handle, display_name, avatar_url, bio, is_workshop, account_type, is_identity_verified,
  subscription_tier, workshop_name, workshop_phone, workshop_website, workshop_tagline,
  workshop_description, workshop_address, workshop_service_area, workshop_hours,
  workshop_instagram, workshop_facebook, workshop_logo_url, workshop_cover_url,
  workshop_booking_url, workshop_business_type
`;

export async function getWorkshopPublicProfile(
  handle: string
): Promise<WorkshopPublicProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select(WORKSHOP_PUBLIC_SELECT)
    .eq('handle', handle)
    .or('account_type.eq.workshop,is_workshop.eq.true')
    .maybeSingle();
  if (error) throw error;
  return data as WorkshopPublicProfile | null;
}

/** After the normal handle / display-name step for a business sign-up. */
export async function seedWorkshopAccountFromOnboarding(
  userId: string,
  input: { displayName: string; email: string }
): Promise<void> {
  const businessName = input.displayName.trim();
  const { data, error } = await supabase
    .from('users')
    .update({
      account_type: 'workshop' as AccountType,
      is_workshop: true,
      workshop_onboarding_complete: true,
      workshop_name: businessName,
      workshop_business_email: input.email.trim() || null,
      display_name: businessName,
    })
    .eq('id', userId)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error('Could not save business profile. Sign in again and retry.');
  }
}

export async function completeWorkshopOnboarding(
  userId: string,
  input: WorkshopProfileInput
): Promise<void> {
  const handle = normalizeHandle(input.handle);
  const handleErr = validateHandle(handle);
  if (handleErr) throw new Error(handleErr);

  const businessName = input.workshop_name.trim();
  if (!businessName) throw new Error('Business name is required.');

  const { data, error } = await supabase
    .from('users')
    .update({
      account_type: 'workshop' as AccountType,
      handle,
      display_name: input.display_name.trim() || businessName,
      bio: input.bio?.trim() || input.workshop_tagline?.trim() || null,
      is_workshop: true,
      workshop_onboarding_complete: true,
      workshop_name: businessName,
      workshop_contact_name: input.workshop_contact_name.trim() || null,
      workshop_business_email: input.workshop_business_email.trim() || null,
      workshop_phone: input.workshop_phone.trim() || null,
      workshop_website: input.workshop_website?.trim() || null,
      workshop_abn: input.workshop_abn?.trim() || null,
      workshop_business_type: input.workshop_business_type?.trim() || null,
      workshop_address: input.workshop_address?.trim() || null,
      workshop_service_area: input.workshop_service_area?.trim() || null,
      workshop_hours: input.workshop_hours?.trim() || null,
      workshop_tagline: input.workshop_tagline?.trim() || null,
      workshop_description: input.workshop_description?.trim() || null,
      workshop_instagram: input.workshop_instagram?.trim() || null,
      workshop_facebook: input.workshop_facebook?.trim() || null,
      workshop_booking_url: input.workshop_booking_url?.trim() || null,
    })
    .eq('id', userId)
    .select('id')
    .maybeSingle();

  if (error) {
    if (error.code === '23505') throw new Error('That handle is already taken.');
    if (error.code === 'PGRST204' || error.message?.includes('column')) {
      throw new Error(
        'Workshop profile could not be saved. Run npm run db:push on the project, then try again.'
      );
    }
    throw error;
  }
  if (!data) {
    throw new Error(
      'Your profile record is missing. Sign out, sign in again, then retry setup.'
    );
  }
}

export async function updateWorkshopProfile(
  userId: string,
  input: Partial<WorkshopProfileInput> & {
    workshop_logo_url?: string | null;
    workshop_cover_url?: string | null;
  }
): Promise<void> {
  const patch: import('@/types/database').Database['public']['Tables']['users']['Update'] = {};
  if (input.handle !== undefined) {
    const handle = normalizeHandle(input.handle);
    const err = validateHandle(handle);
    if (err) throw new Error(err);
    patch.handle = handle;
  }
  if (input.display_name !== undefined) patch.display_name = input.display_name.trim();
  if (input.workshop_name !== undefined) patch.workshop_name = input.workshop_name.trim();
  if (input.workshop_contact_name !== undefined) {
    patch.workshop_contact_name = input.workshop_contact_name.trim() || null;
  }
  if (input.workshop_business_email !== undefined) {
    patch.workshop_business_email = input.workshop_business_email.trim() || null;
  }
  if (input.workshop_phone !== undefined) patch.workshop_phone = input.workshop_phone.trim() || null;
  if (input.workshop_website !== undefined) {
    patch.workshop_website = input.workshop_website?.trim() || null;
  }
  if (input.workshop_abn !== undefined) patch.workshop_abn = input.workshop_abn?.trim() || null;
  if (input.workshop_business_type !== undefined) {
    patch.workshop_business_type = input.workshop_business_type?.trim() || null;
  }
  if (input.workshop_address !== undefined) {
    patch.workshop_address = input.workshop_address?.trim() || null;
  }
  if (input.workshop_service_area !== undefined) {
    patch.workshop_service_area = input.workshop_service_area?.trim() || null;
  }
  if (input.workshop_hours !== undefined) patch.workshop_hours = input.workshop_hours?.trim() || null;
  if (input.workshop_tagline !== undefined) {
    patch.workshop_tagline = input.workshop_tagline?.trim() || null;
  }
  if (input.workshop_description !== undefined) {
    patch.workshop_description = input.workshop_description?.trim() || null;
  }
  if (input.workshop_instagram !== undefined) {
    patch.workshop_instagram = input.workshop_instagram?.trim() || null;
  }
  if (input.workshop_facebook !== undefined) {
    patch.workshop_facebook = input.workshop_facebook?.trim() || null;
  }
  if (input.workshop_booking_url !== undefined) {
    patch.workshop_booking_url = input.workshop_booking_url?.trim() || null;
  }
  if (input.bio !== undefined) patch.bio = input.bio?.trim() || null;
  if (input.workshop_logo_url !== undefined) patch.workshop_logo_url = input.workshop_logo_url;
  if (input.workshop_cover_url !== undefined) patch.workshop_cover_url = input.workshop_cover_url;

  const { error } = await supabase.from('users').update(patch).eq('id', userId);
  if (error) throw error;
}

export const WORKSHOP_BUSINESS_TYPES = [
  '4WD installer',
  'Mechanical workshop',
  'Auto electrician',
  'Panel & paint',
  'Tyre & wheel shop',
  'Accessories retailer',
  'Mobile installer',
  'Other',
] as const;

export type PortfolioItemInput = {
  title: string;
  description?: string | null;
  category?: ModCategory | null;
  vehicle_label?: string | null;
  image_url?: string | null;
  mod_id?: string | null;
  is_published?: boolean;
};
