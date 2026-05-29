// Create Stripe Checkout session for subscription upgrade.
// POST { tier: 'member'|'pro'|'workshop', return_origin?: string } + Authorization + apikey

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

import {
  corsHeaders,
  corsPreflight,
  getSupabaseAnonKey,
  jsonResponse,
  textResponse,
} from '../_shared/cors.ts';

const PRICE_ENV: Record<string, string> = {
  member: 'STRIPE_PRICE_MEMBER',
  pro: 'STRIPE_PRICE_PRO',
  workshop: 'STRIPE_PRICE_WORKSHOP',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsPreflight();
  }
  if (req.method !== 'POST') {
    return textResponse('Method not allowed', 405);
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      return textResponse('STRIPE_SECRET_KEY not configured', 500);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return textResponse('Unauthorized', 401);
    }

    const anonKey = getSupabaseAnonKey();
    if (!anonKey) {
      return textResponse(
        'SUPABASE_ANON_KEY not available in function environment',
        500
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      anonKey,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return textResponse(userError?.message ?? 'Unauthorized', 401);
    }

    const body = (await req.json()) as { tier?: string; return_origin?: string };
    const tier = body.tier ?? 'member';
    const priceEnv = PRICE_ENV[tier];
    if (!priceEnv) {
      return textResponse('Invalid tier', 400);
    }

    const priceId = Deno.env.get(priceEnv);
    if (!priceId || !priceId.startsWith('price_')) {
      return textResponse(
        `${priceEnv} must be a Stripe Price ID (price_...), got: ${priceId ? 'invalid format' : 'missing'}`,
        500
      );
    }

    const siteUrl =
      body.return_origin?.replace(/\/$/, '') ??
      Deno.env.get('SITE_URL')?.replace(/\/$/, '') ??
      'https://wiredbuild.app';

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      client_reference_id: user.id,
      customer_email: user.email ?? undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { user_id: user.id, tier },
      subscription_data: {
        metadata: { user_id: user.id, tier },
      },
      success_url: `${siteUrl}/profile/subscription?checkout=success`,
      cancel_url: `${siteUrl}/profile/subscription?checkout=cancel`,
    });

    return jsonResponse({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[create-checkout-session]', message);
    return jsonResponse({ error: message }, 500);
  }
});
