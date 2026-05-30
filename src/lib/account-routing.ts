import type { AccountType } from '@/types/database';
import type { UserProfileRow } from '@/lib/profile';

export type PostAuthRoute = '/(auth)/onboarding' | '/(tabs)';

export function isWorkshopAccount(
  profile: Pick<UserProfileRow, 'account_type'> | null | undefined
): boolean {
  return profile?.account_type === 'workshop';
}

/** Business profiles use the same shell as builders; extra fields live on the user profile. */
export function isBusinessProfile(
  profile: Pick<UserProfileRow, 'account_type' | 'is_workshop'> | null | undefined
): boolean {
  return isWorkshopAccount(profile) || !!profile?.is_workshop;
}

export function resolvePostAuthRoute(profile: UserProfileRow | null): PostAuthRoute {
  if (!profile?.handle || !profile.display_name?.trim()) {
    return '/(auth)/onboarding';
  }
  return '/(tabs)';
}

export function accountTypeFromParam(
  value: string | string[] | undefined
): AccountType {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'workshop' ? 'workshop' : 'builder';
}

/** OAuth sign-up may only set metadata on auth.users — mirror to public.users. */
export async function syncAccountTypeFromAuthMetadata(
  userId: string,
  metadata: Record<string, unknown> | undefined
): Promise<void> {
  const raw = metadata?.account_type;
  if (raw !== 'builder' && raw !== 'workshop') return;
  const { supabase } = await import('./supabase');
  await supabase.from('users').update({ account_type: raw }).eq('id', userId);
}
