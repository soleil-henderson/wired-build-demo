import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  corsPreflight,
  getSupabaseAnonKey,
  jsonResponse,
  textResponse,
} from '../_shared/cors.ts';
import {
  fetchGoogleShopping,
  googleShoppingSearchUrl,
  rankShoppingOffers,
  type ShoppingOffer,
} from '../_shared/serp-shopping.ts';

export type DiscoverPartResult = {
  id: string;
  brand: string;
  name: string;
  title: string;
  product_url: string;
  image_url: string | null;
  price: string | null;
  source: string;
  rating: number | null;
  reviews: number | null;
};

function discoverId(url: string): string {
  let h = 0;
  for (let i = 0; i < url.length; i++) {
    h = (h * 31 + url.charCodeAt(i)) | 0;
  }
  return `discover:${Math.abs(h).toString(36)}`;
}

function splitTitle(title: string, merchant: string): { brand: string; name: string } {
  const clean = title.trim();
  const m = merchant.trim() || 'Store';
  if (!clean) return { brand: m, name: 'Product' };
  const dash = clean.match(/^(.+?)\s[\-|–|—|:]\s(.+)$/);
  if (dash) return { brand: dash[1].trim(), name: dash[2].trim() };
  if (clean.toLowerCase().startsWith(m.toLowerCase())) {
    const name = clean.slice(m.length).replace(/^[\s|\-–—:]+/, '').trim();
    if (name) return { brand: m, name };
  }
  return { brand: m, name: clean };
}

function mapOffer(offer: ShoppingOffer): DiscoverPartResult {
  const { brand, name } = splitTitle(offer.title, offer.source);
  return {
    id: discoverId(offer.url),
    brand,
    name,
    title: offer.title,
    product_url: offer.url,
    image_url: offer.thumbnail ?? null,
    price: offer.price,
    source: offer.source,
    rating: offer.rating,
    reviews: offer.reviews,
  };
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

  let body: { query?: string; limit?: number };
  try {
    body = await req.json();
  } catch {
    return textResponse('Invalid JSON', 400);
  }

  const query = body.query?.trim() ?? '';
  if (query.length < 2) return textResponse('query required (min 2 chars)', 400);

  const serpKey = Deno.env.get('SERPAPI_KEY');
  if (!serpKey) {
    return jsonResponse({
      results: [],
      shopping_search_url: googleShoppingSearchUrl(query),
      error: 'Google Shopping is not configured (SERPAPI_KEY missing on Supabase).',
    });
  }

  const limit = Math.min(Math.max(body.limit ?? 10, 1), 16);

  try {
    const offers = rankShoppingOffers(
      await fetchGoogleShopping(query, serpKey, { limit: limit + 4 }),
      'balanced'
    ).slice(0, limit);

    return jsonResponse({
      results: offers.map(mapOffer),
      shopping_search_url: googleShoppingSearchUrl(query),
      error: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Search failed';
    return jsonResponse(
      {
        results: [],
        shopping_search_url: googleShoppingSearchUrl(query),
        error: message,
      },
      422
    );
  }
});
