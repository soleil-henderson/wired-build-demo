import { fetchGoogleSearch } from './serp-search.ts';
import {
  fetchGoogleShopping,
  googleShoppingSearchUrl,
  rankShoppingOffers,
  type ShoppingOffer,
} from './serp-shopping.ts';

export type ProductLinksPayload = {
  primary: { name: string; url: string } | null;
  extras: { name: string; url: string }[];
  shopping?: { title: string; url: string; price: string | null; source: string }[];
  shopping_search_url?: string | null;
};

/** Fast product_links for bulk import — no SerpAPI (avoids edge timeouts). */
export function productLinksWithoutLookup(
  partLabel: string,
  explicitUrl?: string | null
): ProductLinksPayload {
  const name = partLabel.trim();
  const searchUrl = googleShoppingSearchUrl(name || 'part');
  if (!name) return { primary: null, extras: [], shopping_search_url: searchUrl };

  if (explicitUrl?.trim() && /^https?:\/\//i.test(explicitUrl.trim())) {
    return {
      primary: { name, url: explicitUrl.trim() },
      extras: [],
      shopping_search_url: searchUrl,
    };
  }

  return { primary: null, extras: [], shopping_search_url: searchUrl };
}

/** Build mod product_links JSON from Google Shopping / web search. */
export async function buildProductLinksForPart(
  partLabel: string,
  serpKey: string | undefined,
  explicitUrl?: string | null
): Promise<ProductLinksPayload> {
  const name = partLabel.trim();
  if (!name) return { primary: null, extras: [] };

  const searchUrl = googleShoppingSearchUrl(name);

  if (explicitUrl?.trim() && /^https?:\/\//i.test(explicitUrl.trim())) {
    return {
      primary: { name, url: explicitUrl.trim() },
      extras: [],
      shopping_search_url: searchUrl,
    };
  }

  if (!serpKey) {
    return { primary: null, extras: [], shopping_search_url: searchUrl };
  }

  const offers = rankShoppingOffers(
    await fetchGoogleShopping(name, serpKey, { limit: 10 }),
    'balanced'
  );

  if (offers.length > 0) {
    return {
      primary: { name: offers[0].title, url: offers[0].url },
      extras: [],
      shopping: offers.slice(0, 6).map(shoppingToJson),
      shopping_search_url: searchUrl,
    };
  }

  const web = await fetchGoogleSearch(`${name} buy Australia`, serpKey, { limit: 5 });
  const productPage = web.find((r) => looksLikeProductUrl(r.url));
  if (productPage) {
    return {
      primary: { name: productPage.title || name, url: productPage.url },
      extras: [],
      shopping_search_url: searchUrl,
    };
  }

  return { primary: null, extras: [], shopping_search_url: searchUrl };
}

function shoppingToJson(o: ShoppingOffer) {
  return {
    title: o.title,
    url: o.url,
    price: o.price,
    source: o.source,
  };
}

function looksLikeProductUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, '') || '/';
    if (path === '/') return false;
    const shallow = new Set([
      '/shop',
      '/products',
      '/collections',
      '/search',
      '/tents',
      '/camping',
    ]);
    if (shallow.has(path.toLowerCase())) return false;
    return path.length > 1 && (path.includes('-') || path.split('/').filter(Boolean).length >= 2);
  } catch {
    return false;
  }
}
