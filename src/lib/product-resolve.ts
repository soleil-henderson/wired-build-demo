import type { ShoppingOffer } from './mod-products';
import {
  buildGoogleShoppingSearchUrl,
  buildShoppingQueries,
  productNameFromUrl,
} from './product-url-query';
import { supabase } from './supabase';

export type { ShoppingOffer };

export type ScrapeQuality = 'high' | 'low' | 'url_only';

export type ResolvedProduct = {
  url: string;
  title: string;
  brand: string;
  name: string;
  image_url: string | null;
  price: string | null;
  merchant: string | null;
  shopping: ShoppingOffer[];
  shopping_search_url: string | null;
  shopping_error?: string | null;
  scrape_quality?: ScrapeQuality;
  scrape_warning?: string | null;
};

export type ProductShoppingResult = {
  shopping: ShoppingOffer[];
  shopping_search_url: string | null;
  error?: string | null;
};

type ResolveBody = {
  url?: string;
  query?: string;
  include_shopping?: boolean;
};

function mergeOffers(...groups: (ShoppingOffer[] | undefined)[]): ShoppingOffer[] {
  const seen = new Set<string>();
  const out: ShoppingOffer[] = [];
  for (const group of groups) {
    for (const offer of group ?? []) {
      const key = offer.url.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(offer);
    }
  }
  return out;
}

async function callResolveProduct(body: ResolveBody): Promise<ResolvedProduct> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error('Sign in to look up product prices.');

  const base = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const apikey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
  const res = await fetch(`${base}/functions/v1/resolve-product`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey,
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  type ErrorPayload = { error?: string; message?: string; code?: string };
  let payload: (ResolvedProduct & ErrorPayload) | ErrorPayload | null = null;
  try {
    payload = raw ? (JSON.parse(raw) as ResolvedProduct & ErrorPayload) : null;
  } catch {
    /* plain-text gateway response */
  }

  if (!res.ok) {
    const errPayload = payload as ErrorPayload | null;
    if (errPayload?.code === 'NOT_FOUND') {
      throw new Error(
        'Price lookup is not available yet. Deploy the resolve-product function on Supabase.'
      );
    }
    throw new Error(
      errPayload?.error ??
        errPayload?.message ??
        (raw.trim() || 'Could not resolve product URL')
    );
  }

  if (!payload || (payload as ErrorPayload).error) {
    throw new Error((payload as ErrorPayload)?.error ?? 'Could not resolve product URL');
  }

  return payload as ResolvedProduct;
}

/** Resolve a product URL server-side (metadata scrape + Google Shopping via SerpAPI). */
export async function resolveProductUrl(
  url: string,
  includeShopping = true
): Promise<ResolvedProduct> {
  return callResolveProduct({ url, include_shopping: includeShopping });
}

/** Fetch Google Shopping offers for a search query (brand + product name). */
export async function fetchShoppingForQuery(query: string): Promise<ResolvedProduct> {
  const q = query.trim();
  if (!q) throw new Error('Product name is required for price lookup.');
  return callResolveProduct({ query: q, include_shopping: true });
}

/**
 * Fetch Google Shopping offers for a product.
 * Tries URL scrape first, then multiple query variants, and merges cached offers.
 */
export async function fetchProductShopping(opts: {
  query: string;
  url?: string | null;
  cached?: ShoppingOffer[];
}): Promise<ProductShoppingResult> {
  const url = opts.url?.trim() || null;
  const queries = buildShoppingQueries(opts.query, url);
  let lastSearchUrl: string | null = queries[0]
    ? buildGoogleShoppingSearchUrl(queries[0])
    : null;
  let lastError: string | null = null;

  if (url) {
    try {
      const resolved = await resolveProductUrl(url, true);
      lastSearchUrl = resolved.shopping_search_url ?? lastSearchUrl;
      const titleQuery = `${resolved.brand} ${resolved.name}`.trim() || resolved.title.trim();
      if (titleQuery && !queries.some((q) => q.toLowerCase() === titleQuery.toLowerCase())) {
        queries.unshift(titleQuery);
      }
      if (resolved.shopping.length > 0) {
        return {
          shopping: mergeOffers(resolved.shopping, opts.cached),
          shopping_search_url: lastSearchUrl,
          error: resolved.shopping_error ?? null,
        };
      }
      if (resolved.shopping_error) {
        lastError = resolved.shopping_error;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Could not read product link';
      const slug = productNameFromUrl(url);
      if (slug && !queries.some((q) => q.toLowerCase() === slug.toLowerCase())) {
        queries.unshift(slug);
      }
    }
  }

  for (const q of queries) {
    try {
      const resolved = await fetchShoppingForQuery(q);
      lastSearchUrl = resolved.shopping_search_url ?? buildGoogleShoppingSearchUrl(q);
      if (resolved.shopping.length > 0) {
        return {
          shopping: mergeOffers(resolved.shopping, opts.cached),
          shopping_search_url: lastSearchUrl,
          error: resolved.shopping_error ?? null,
        };
      }
      if (resolved.shopping_error) {
        lastError = resolved.shopping_error;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Price lookup failed';
    }
  }

  const cached = mergeOffers(opts.cached);
  if (cached.length > 0) {
    return { shopping: cached, shopping_search_url: lastSearchUrl, error: lastError };
  }

  return {
    shopping: [],
    shopping_search_url: lastSearchUrl,
    error: lastError ?? (queries.length ? 'No prices found for this product yet.' : null),
  };
}

export function isValidHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
