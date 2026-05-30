export type ShoppingOffer = {
  title: string;
  price: string | null;
  price_value: number | null;
  url: string;
  source: string;
  thumbnail: string | null;
  rating: number | null;
  reviews: number | null;
};

export function googleShoppingSearchUrl(query: string): string {
  return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query)}`;
}

export async function fetchGoogleShopping(
  query: string,
  apiKey: string,
  opts?: { limit?: number; gl?: string }
): Promise<ShoppingOffer[]> {
  const params = new URLSearchParams({
    engine: 'google_shopping',
    q: query.trim(),
    api_key: apiKey,
    num: String(Math.min(opts?.limit ?? 12, 20)),
    gl: opts?.gl ?? 'au',
    hl: 'en',
    google_domain: 'google.com.au',
  });

  const res = await fetch(`https://serpapi.com/search.json?${params}`);
  const data = (await res.json()) as {
    error?: string;
    shopping_results?: SerpShoppingRow[];
    categorized_shopping_results?: { shopping_results?: SerpShoppingRow[] }[];
    featured_shopping_results?: SerpShoppingRow[];
  };

  if (!res.ok || data.error) {
    console.error('[serp-shopping]', res.status, data.error);
    return [];
  }

  const rows: SerpShoppingRow[] = [
    ...(data.shopping_results ?? []),
    ...(data.featured_shopping_results ?? []),
    ...(data.categorized_shopping_results ?? []).flatMap((c) => c.shopping_results ?? []),
  ];

  return dedupeOffers(
    rows
      .map(normalizeSerpOffer)
      .filter((o): o is ShoppingOffer => o !== null)
      .filter((offer) => !isStoreHomepageUrl(offer.url))
  ).slice(0, opts?.limit ?? 12);
}

type SerpShoppingRow = {
  title?: string;
  price?: string;
  extracted_price?: number;
  link?: string;
  product_link?: string;
  source?: string;
  thumbnail?: string;
  serpapi_thumbnails?: string[];
  rating?: number;
  reviews?: number;
  extensions?: string[];
};

function normalizeSerpOffer(row: SerpShoppingRow): ShoppingOffer | null {
  const title = row.title?.trim();
  const url = row.link?.trim() || row.product_link?.trim();
  if (!title || !url) return null;

  let price = row.price?.trim() || null;
  let priceValue: number | null =
    row.extracted_price != null && Number.isFinite(row.extracted_price)
      ? row.extracted_price
      : null;
  if (!price && priceValue != null) {
    price = `$${Math.round(priceValue).toLocaleString('en-AU')}`;
  }
  if (!priceValue && price) {
    const m = price.replace(/,/g, '').match(/[\d.]+/);
    if (m) priceValue = Number(m[0]);
  }

  let rating: number | null =
    row.rating != null && Number.isFinite(row.rating) ? row.rating : null;
  let reviews: number | null =
    row.reviews != null && Number.isFinite(row.reviews) ? row.reviews : null;

  if ((rating == null || reviews == null) && Array.isArray(row.extensions)) {
    for (const ext of row.extensions) {
      const r = ext.match(/([\d.]+)\s*(?:stars?|★)/i);
      if (r && rating == null) rating = Number(r[1]);
      const rev = ext.match(/([\d,]+)\s*reviews?/i);
      if (rev && reviews == null) reviews = Number(rev[1].replace(/,/g, ''));
    }
  }

  const thumbnail =
    row.thumbnail?.trim() ||
    row.serpapi_thumbnails?.[0]?.trim() ||
    null;

  return {
    title,
    url,
    price,
    price_value: priceValue,
    source: row.source?.trim() || 'Store',
    thumbnail,
    rating,
    reviews,
  };
}

function dedupeOffers(offers: ShoppingOffer[]): ShoppingOffer[] {
  const seen = new Set<string>();
  const out: ShoppingOffer[] = [];
  for (const offer of offers) {
    const key = offer.url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(offer);
  }
  return out;
}

function isStoreHomepageUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    const path = u.pathname.replace(/\/+$/, '') || '/';
    if (path === '/') return true;
    const shallow = new Set([
      '/tents',
      '/camping',
      '/buy',
      '/buy-sale',
      '/shop',
      '/products',
      '/collections',
      '/store',
    ]);
    return shallow.has(path.toLowerCase());
  } catch {
    return false;
  }
}

/** Rank for “best value + reviews” queries: prefer rated items, then price. */
export function rankShoppingOffers(
  offers: ShoppingOffer[],
  preference: 'balanced' | 'cheapest' | 'top_rated'
): ShoppingOffer[] {
  const copy = [...offers];
  copy.sort((a, b) => {
    if (preference === 'cheapest') {
      return (a.price_value ?? Infinity) - (b.price_value ?? Infinity);
    }
    if (preference === 'top_rated') {
      const scoreA = (a.rating ?? 0) * Math.log10((a.reviews ?? 0) + 1);
      const scoreB = (b.rating ?? 0) * Math.log10((b.reviews ?? 0) + 1);
      return scoreB - scoreA;
    }
    // balanced: rating weight + slight price preference
    const scoreA =
      (a.rating ?? 3) * Math.log10((a.reviews ?? 1) + 1) -
      (a.price_value ?? 0) / 5000;
    const scoreB =
      (b.rating ?? 3) * Math.log10((b.reviews ?? 1) + 1) -
      (b.price_value ?? 0) / 5000;
    return scoreB - scoreA;
  });
  return copy;
}
