import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  corsPreflight,
  getSupabaseAnonKey,
  jsonResponse,
  textResponse,
} from '../_shared/cors.ts';

type AutocompletePrediction = {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
};

function parseAddressComponents(components: { long_name: string; types: string[] }[]) {
  let city = '';
  let country = '';
  for (const c of components) {
    if (c.types.includes('locality')) city = c.long_name;
    if (!city && c.types.includes('administrative_area_level_2')) city = c.long_name;
    if (c.types.includes('country')) country = c.long_name;
  }
  return { city, country };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflight();
  if (req.method !== 'POST') return textResponse('Method not allowed', 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return textResponse('Unauthorized', 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    getSupabaseAnonKey(),
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth.user) return textResponse('Unauthorized', 401);

  const mapsKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
  if (!mapsKey) {
    return jsonResponse({ error: 'GOOGLE_MAPS_API_KEY is not configured on Supabase.' }, 503);
  }

  let body: { input?: string; place_id?: string };
  try {
    body = await req.json();
  } catch {
    return textResponse('Invalid JSON', 400);
  }

  if (body.place_id?.trim()) {
    const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    detailsUrl.searchParams.set('place_id', body.place_id.trim());
    detailsUrl.searchParams.set(
      'fields',
      'place_id,name,formatted_address,geometry,address_components,url'
    );
    detailsUrl.searchParams.set('key', mapsKey);

    const res = await fetch(detailsUrl);
    const data = await res.json();
    const r = data.result;
    if (!r?.geometry?.location) {
      return jsonResponse({ error: 'Place not found' }, 404);
    }
    const { city, country } = parseAddressComponents(r.address_components ?? []);
    const lat = r.geometry.location.lat;
    const lng = r.geometry.location.lng;
    const name = r.name ?? r.formatted_address ?? 'Location';
    return jsonResponse({
      place: {
        place_id: r.place_id ?? body.place_id,
        name,
        formatted_address: r.formatted_address ?? name,
        city,
        country,
        lat,
        lng,
        maps_url:
          r.url ??
          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}@${lat},${lng}`)}`,
      },
    });
  }

  const input = body.input?.trim();
  if (!input || input.length < 2) {
    return jsonResponse({ predictions: [] });
  }

  const autoUrl = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
  autoUrl.searchParams.set('input', input);
  autoUrl.searchParams.set('key', mapsKey);
  autoUrl.searchParams.set('types', 'geocode|establishment');
  autoUrl.searchParams.set('components', 'country:au');

  const res = await fetch(autoUrl);
  const data = await res.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    return jsonResponse(
      { error: data.error_message ?? `Places API: ${data.status}` },
      502
    );
  }

  const predictions = ((data.predictions ?? []) as AutocompletePrediction[]).map((p) => ({
    place_id: p.place_id,
    description: p.description,
    main_text: p.structured_formatting?.main_text ?? p.description,
    secondary_text: p.structured_formatting?.secondary_text ?? '',
  }));

  return jsonResponse({ predictions });
});
