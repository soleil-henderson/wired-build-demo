import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { webAppAbsoluteUrl, WEB_APP_BASE_PATH } from './site-url';
import { supabase } from './supabase';

/**
 * Apple / Google sign-in via Supabase OAuth.
 *
 * - **Native (Expo Go / dev build):** in-app browser → `wiredbuilddemo://auth/callback`
 * - **Web (wiredbuild.com/app):** full-page redirect → `https://<site>/app/auth/callback`
 *
 * Add every redirect URL to Supabase → Authentication → URL Configuration.
 */

WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = 'apple' | 'google';

/** OAuth return URL for the current platform (must match Supabase allow list). */
export function getOAuthRedirectUri(): string {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin.replace(/\/$/, '');
      return `${origin}${WEB_APP_BASE_PATH}/auth/callback`;
    }
    return webAppAbsoluteUrl('/auth/callback');
  }

  return makeRedirectUri({
    scheme: 'wiredbuilddemo',
    path: 'auth/callback',
  });
}

export async function signInWithApple(): Promise<boolean> {
  if (Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync())) {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('Apple Sign In did not return an identity token.');
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) throw error;
      return true;
    } catch (err) {
      if (isAppleAuthCanceled(err)) return false;
      throw err;
    }
  }

  return signInWithOAuthProvider('apple');
}

export async function signInWithOAuthProvider(
  provider: OAuthProvider,
  options?: { accountType?: 'builder' | 'workshop' }
): Promise<boolean> {
  const redirectTo = getOAuthRedirectUri();
  const oauthOptions = {
    redirectTo,
    ...(options?.accountType
      ? { data: { account_type: options.accountType } as Record<string, string> }
      : {}),
  };

  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') {
      throw new Error('Google sign-in requires a browser window.');
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: oauthOptions,
    });
    if (error) throw error;
    if (!data?.url) throw new Error('Provider did not return an auth URL.');

    window.location.assign(data.url);
    return false;
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      ...oauthOptions,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('Provider did not return an auth URL.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success' || !result.url) return false;

  await completeOAuthFromCallbackUrl(result.url);
  return true;
}

/** Finish OAuth after redirect (web callback page or native in-app browser). */
export async function completeOAuthFromCallbackUrl(url: string): Promise<void> {
  const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'https://wiredbuild.com');
  const code = parsed.searchParams.get('code');
  const errorParam = parsed.searchParams.get('error_description') ?? parsed.searchParams.get('error');

  if (errorParam) {
    throw new Error(decodeURIComponent(errorParam.replace(/\+/g, ' ')));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return;
  }

  const tokens = parseAuthTokensFromUrl(url);
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('OAuth callback was missing session tokens.');
  }

  const { error: setErr } = await supabase.auth.setSession({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  });
  if (setErr) throw setErr;
}

function isAppleAuthCanceled(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'ERR_REQUEST_CANCELED'
  );
}

export function parseAuthTokensFromUrl(url: string): {
  access_token: string | null;
  refresh_token: string | null;
} {
  const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
  const fromHash = new URLSearchParams(hash);
  const queryStart = url.indexOf('?');
  const queryEnd = url.indexOf('#');
  const queryStr =
    queryStart >= 0
      ? url.slice(queryStart + 1, queryEnd >= 0 ? queryEnd : undefined)
      : '';
  const fromQuery = new URLSearchParams(queryStr);

  return {
    access_token:
      fromHash.get('access_token') ?? fromQuery.get('access_token'),
    refresh_token:
      fromHash.get('refresh_token') ?? fromQuery.get('refresh_token'),
  };
}
