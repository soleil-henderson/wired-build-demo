import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from './supabase';

/**
 * Apple / Google sign-in via Supabase OAuth (web-based flow).
 *
 * Notes for the demo:
 * - Web-based OAuth works inside Expo Go because the redirect URL goes to
 *   the Expo dev-client scheme, which `makeRedirectUri` generates for us.
 *   For App Store builds you'll want native Apple sign-in (Apple requires
 *   it whenever third-party social sign-in is offered) via
 *   `expo-apple-authentication` + `signInWithIdToken`. Plumbing for that
 *   can sit on top of this helper later.
 * - The redirect URL must be added to **Authentication → URL
 *   Configuration → Additional Redirect URLs** in the Supabase dashboard,
 *   including the Expo Go variant during development (something like
 *   `exp://*` is the easiest catch-all).
 * - Provider credentials (Apple Service ID + Key, Google Client
 *   ID / Secret) live in **Authentication → Providers** in the dashboard.
 */

// Make sure any in-progress auth sessions are dismissed when the JS
// reloads — required by expo-web-browser for `openAuthSessionAsync`.
WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = 'apple' | 'google';

/**
 * Sign in with Apple — native `ASAuthorization` on iOS when available
 * (App Store requirement when Google sign-in is offered), otherwise the
 * web OAuth flow used in Expo Go.
 */
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

/**
 * Open the provider's consent page in a sandboxed browser, then exchange
 * the redirected tokens for a Supabase session.
 *
 * Returns true on success. Throws on Supabase errors so the caller can
 * surface a friendly message. User-dismissed flows resolve as `false`.
 */
export async function signInWithOAuthProvider(
  provider: OAuthProvider
): Promise<boolean> {
  const redirectTo = makeRedirectUri({
    // The app's scheme from app.json. In Expo Go the helper rewrites this
    // to the dev-client URL automatically.
    scheme: 'wiredbuilddemo',
    path: 'auth/callback',
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      // We need to drive the browser ourselves so we can pull tokens out
      // of the redirect URL — Supabase would otherwise call window.open
      // which doesn't exist on RN.
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('Provider did not return an auth URL.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success' || !result.url) return false;

  // Tokens come back in the URL fragment (implicit flow) e.g.
  //   wiredbuilddemo://auth/callback#access_token=…&refresh_token=…
  const tokens = parseAuthTokensFromUrl(result.url);
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('OAuth callback URL was missing session tokens.');
  }

  const { error: setErr } = await supabase.auth.setSession({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  });
  if (setErr) throw setErr;

  return true;
}

function isAppleAuthCanceled(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'ERR_REQUEST_CANCELED'
  );
}

function parseAuthTokensFromUrl(url: string): {
  access_token: string | null;
  refresh_token: string | null;
} {
  // Hash params (`#a=b&c=d`) — implicit flow
  const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
  const fromHash = new URLSearchParams(hash);
  // Query params (`?a=b&c=d`) — PKCE / explicit fallback
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
