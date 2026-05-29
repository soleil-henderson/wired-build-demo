import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import * as Iap from './iap';
import { supabase } from './supabase';
import type { SubscriptionTier } from '@/types/database';

const FUNCTIONS_BASE = () => {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  return `${url}/functions/v1`;
};

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in to continue.');

  const apikey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
  return {
    Authorization: `Bearer ${token}`,
    apikey,
    'Content-Type': 'application/json',
  };
}

function checkoutReturnOrigin(): string | undefined {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return undefined;
}

/** Open Stripe Checkout for web / Android; use IAP on iOS App Store builds. */
export async function startSubscriptionCheckout(tier: SubscriptionTier): Promise<void> {
  if (tier === 'free') return;

  if (Platform.OS === 'ios') {
    await startIosPurchase(tier);
    return;
  }

  const headers = await authHeaders();
  const res = await fetch(`${FUNCTIONS_BASE()}/create-checkout-session`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      tier,
      return_origin: checkoutReturnOrigin(),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text || 'Could not start checkout';
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (parsed.error) message = parsed.error;
    } catch {
      /* plain text response */
    }
    throw new Error(message);
  }
  const { url } = (await res.json()) as { url?: string };
  if (!url) throw new Error('No checkout URL returned');
  await WebBrowser.openBrowserAsync(url);
}

async function startIosPurchase(tier: SubscriptionTier): Promise<void> {
  const productMap: Record<string, string> = {
    member: 'wired_member_monthly',
    pro: 'wired_pro_monthly',
    workshop: 'wired_workshop_monthly',
  };
  const productId = productMap[tier];
  if (!productId) throw new Error('Invalid tier');

  const token = await Iap.purchaseSubscription(productId);
  const headers = await authHeaders();
  const res = await fetch(`${FUNCTIONS_BASE()}/verify-iap`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      platform: 'ios',
      product_id: productId,
      purchase_token: token,
    }),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
}

export async function restoreIosPurchases(): Promise<void> {
  if (Platform.OS !== 'ios') {
    throw new Error('Restore is only available on iOS.');
  }
  const { productId, token } = await Iap.restorePurchases();
  const headers = await authHeaders();
  await fetch(`${FUNCTIONS_BASE()}/verify-iap`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      platform: 'ios',
      product_id: productId,
      purchase_token: token,
    }),
  });
}

export async function startIdentityVerification(): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${FUNCTIONS_BASE()}/create-identity-session`, {
    method: 'POST',
    headers,
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  const { url } = (await res.json()) as { url?: string };
  if (!url) throw new Error('No verification URL returned');
  await WebBrowser.openBrowserAsync(url);
}

export async function openBillingPortal(): Promise<void> {
  const site = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://wiredbuild.app';
  await WebBrowser.openBrowserAsync(`${site}/profile/subscription`);
}
