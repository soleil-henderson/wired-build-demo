// Stripe webhook — verified signatures; updates users.subscription_tier server-side only.
// Deploy: supabase functions deploy stripe-webhook --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=denonext';

const cryptoProvider = Stripe.createSubtleCryptoProvider();

const TIER_FROM_METADATA = ['member', 'pro', 'workshop'] as const;

function tierFromMetadata(meta: Record<string, string> | null | undefined): string {
  const t = meta?.tier;
  if (t && TIER_FROM_METADATA.includes(t as (typeof TIER_FROM_METADATA)[number])) {
    return t;
  }
  return 'member';
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!stripeKey || !webhookSecret) {
    return new Response('Stripe not configured', { status: 500 });
  }

  const body = await req.text();
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing stripe-signature', { status: 400 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider
    );
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed', err);
    return new Response('Invalid signature', { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.client_reference_id ?? session.metadata?.user_id;
    const tier = tierFromMetadata(session.metadata as Record<string, string>);
    if (userId) {
      await supabase.from('users').update({ subscription_tier: tier }).eq('id', userId);
    }
  }

  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object as Stripe.Subscription;
    const userId = sub.metadata?.user_id;
    if (userId && sub.status === 'active') {
      const tier = tierFromMetadata(sub.metadata as Record<string, string>);
      await supabase.from('users').update({ subscription_tier: tier }).eq('id', userId);
    }
  }

  if (
    event.type === 'customer.subscription.deleted' ||
    (event.type === 'customer.subscription.updated' &&
      (event.data.object as Stripe.Subscription).status === 'canceled')
  ) {
    const sub = event.data.object as Stripe.Subscription;
    const userId = sub.metadata?.user_id ?? sub.client_reference_id;
    if (userId) {
      await supabase.from('users').update({ subscription_tier: 'free' }).eq('id', userId);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
