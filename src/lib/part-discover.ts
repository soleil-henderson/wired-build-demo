import { supabase } from './supabase';

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

type SearchPartsResponse = {
  results: DiscoverPartResult[];
  shopping_search_url: string | null;
  error: string | null;
};

/** Google Shopping results — ephemeral, not stored in the parts catalogue. */
export async function searchDiscoverParts(
  query: string,
  limit = 10
): Promise<DiscoverPartResult[]> {
  const term = query.trim();
  if (term.length < 2 || term.startsWith('@')) return [];

  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) return [];

  const base = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const apikey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
  const res = await fetch(`${base}/functions/v1/search-parts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey,
    },
    body: JSON.stringify({ query: term, limit }),
  });

  const raw = await res.text();
  let payload: SearchPartsResponse | null = null;
  try {
    payload = raw ? (JSON.parse(raw) as SearchPartsResponse) : null;
  } catch {
    return [];
  }

  if (!res.ok || !payload?.results?.length) return [];
  return payload.results;
}
