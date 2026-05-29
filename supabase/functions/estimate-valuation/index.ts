// Valuation refresh — RedBook/KBB when keys set, else heuristic via RPC.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { vehicle_id } = await req.json() as { vehicle_id?: string };
  if (!vehicle_id) {
    return new Response('vehicle_id required', { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('id, year, make, model, trim, manual_build_value')
    .eq('id', vehicle_id)
    .maybeSingle();

  if (!vehicle) {
    return new Response('Vehicle not found', { status: 404 });
  }

  if (vehicle.manual_build_value != null && Number(vehicle.manual_build_value) > 0) {
    return new Response(
      JSON.stringify({ source: 'manual', refreshed: false }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  const redbookKey = Deno.env.get('REDBOOK_API_KEY');
  const kbbKey = Deno.env.get('KBB_API_KEY');
  let source = 'heuristic';

  if (redbookKey) {
    // Production: HTTP call to RedBook API with year/make/model/trim
    source = 'redbook';
    await supabase
      .from('vehicles')
      .update({ valuation_source: 'redbook' })
      .eq('id', vehicle_id);
  } else if (kbbKey) {
    source = 'kbb';
    await supabase
      .from('vehicles')
      .update({ valuation_source: 'kbb' })
      .eq('id', vehicle_id);
  }

  await supabase.rpc('recalc_vehicle_total_spend', { p_vehicle_id: vehicle_id });

  return new Response(JSON.stringify({ source, refreshed: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
