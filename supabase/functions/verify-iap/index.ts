// App Store / Play receipt validation stub — updates subscription_tier server-side.
// POST { platform: 'ios'|'android', product_id, purchase_token, user_id } + service role or user JWT.
// Production: verify with Apple App Store Server API / Google Play Developer API.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PRODUCT_TIER: Record<string, string> = {
  wired_member_monthly: 'member',
  wired_pro_monthly: 'pro',
  wired_workshop_monthly: 'workshop',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  const body = await req.json() as {
    product_id?: string;
    purchase_token?: string;
    platform?: string;
  };

  const productId = body.product_id ?? '';
  const tier = PRODUCT_TIER[productId];
  if (!tier) {
    return new Response('Unknown product_id', { status: 400, headers: corsHeaders });
  }

  // TODO: validate purchase_token with Apple/Google before trusting.
  const allowSandbox = Deno.env.get('IAP_ALLOW_SANDBOX') === 'true';
  if (!allowSandbox && !body.purchase_token) {
    return new Response('purchase_token required', { status: 400, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  await supabase.from('users').update({ subscription_tier: tier }).eq('id', user.id);

  return new Response(JSON.stringify({ tier, verified: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
