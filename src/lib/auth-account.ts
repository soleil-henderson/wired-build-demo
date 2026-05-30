import type { AuthError } from '@supabase/supabase-js';

import { webAppAbsoluteUrl } from './site-url';
import { supabase } from './supabase';
import { collectVehicleStorageKeys, purgeVehicleStorage } from './vehicle-storage';

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Supabase often returns "Invalid login credentials" for wrong password OR unconfirmed email. */
export function formatSignInError(error: unknown): Error {
  if (!error || typeof error !== 'object') {
    return new Error('Could not sign in. Try again.');
  }

  const authErr = error as AuthError;
  const msg = (authErr.message ?? '').toLowerCase();
  const code = (authErr as AuthError & { code?: string }).code ?? '';

  if (
    msg.includes('email not confirmed') ||
    msg.includes('not confirmed') ||
    code === 'email_not_confirmed'
  ) {
    return new Error(
      'Confirm your email first — open the link we sent when you signed up (check spam), then sign in again.'
    );
  }

  if (
    msg.includes('invalid login credentials') ||
    msg.includes('invalid credentials') ||
    code === 'invalid_credentials'
  ) {
    return new Error(
      "That email and password didn't match. If you just signed up, use Enter verification code below, or Forgot password."
    );
  }

  if (authErr.message) return new Error(authErr.message);
  return new Error('Could not sign in. Try again.');
}

export async function resendSignupConfirmation(email: string): Promise<void> {
  const normalized = normalizeAuthEmail(email);
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: normalized,
    options: {
      emailRedirectTo: webAppAbsoluteUrl('/auth/callback'),
    },
  });
  if (error) throw error;
}

/** Confirm sign-up with the 6-digit code from email (Supabase Email OTP). */
export async function verifySignupEmailOtp(email: string, token: string): Promise<void> {
  const normalized = normalizeAuthEmail(email);
  const code = token.replace(/\D/g, '').trim();
  if (code.length < 6) {
    throw new Error('Enter the full 6-digit code from your email.');
  }

  const { error } = await supabase.auth.verifyOtp({
    email: normalized,
    token: code,
    type: 'signup',
  });
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('expired') || msg.includes('invalid')) {
      throw new Error('That code is invalid or expired. Tap Resend code and try again.');
    }
    throw error;
  }
}

/**
 * Email confirmation links sometimes land on the marketing root when redirect URLs
 * are misconfigured — also handled by marketing/index.html → /app/auth/callback.
 */
export async function completeEmailConfirmationFromUrl(url: string): Promise<boolean> {
  const base =
    typeof window !== 'undefined' ? window.location.origin : 'https://wiredbuild.com';
  const parsed = new URL(url, base);

  const token_hash = parsed.searchParams.get('token_hash');
  const typeParam = parsed.searchParams.get('type');
  if (token_hash) {
    const otpType =
      typeParam === 'signup' || typeParam === 'email' || typeParam === 'recovery'
        ? typeParam
        : 'signup';
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: otpType,
    });
    if (error) throw error;
    return true;
  }

  const code = parsed.searchParams.get('code');
  if (code && typeParam === 'signup') {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return true;
  }

  return false;
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(normalizeAuthEmail(email), {
    redirectTo: webAppAbsoluteUrl('/auth/reset-password'),
  });
  if (error) throw error;
}

export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/**
 * Delete the signed-in account: purge storage for all owned vehicles,
 * delete auth user (cascades public.users via FK).
 */
export async function deleteMyAccount(userId: string): Promise<void> {
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id')
    .eq('current_owner_id', userId);

  for (const v of vehicles ?? []) {
    const keys = await collectVehicleStorageKeys(v.id);
    await supabase.from('vehicles').delete().eq('id', v.id);
    await purgeVehicleStorage(keys);
  }

  const { error } = await supabase.rpc('delete_own_account');
  if (error) {
    // Fallback if RPC not deployed: sign out only
    const { error: signOutErr } = await supabase.auth.signOut();
    if (signOutErr) throw signOutErr;
    throw new Error(
      'Account data removed from garage. Contact support to fully delete your auth record.'
    );
  }
}
