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
  type ShoppingOffer,
} from '../_shared/serp-shopping.ts';

export type { ShoppingOffer };

export type ScrapeQuality = 'high' | 'low' | 'url_only';

export type ResolvedProduct = {
  /** Always the URL the user pasted — never replaced by scrape/redirects. */
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
  scrape_quality: ScrapeQuality;
  scrape_warning: string | null;
};

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

  let body: { url?: string; query?: string; include_shopping?: boolean };
  try {
    body = await req.json();
  } catch {
    return textResponse('Invalid JSON', 400);
  }

  const rawUrl = body.url?.trim();
  const queryOnly = body.query?.trim();
  if (!rawUrl && !queryOnly) return textResponse('url or query required', 400);

  if (!rawUrl && queryOnly) {
    try {
      const includeShopping = body.include_shopping !== false;
      const serpKey = Deno.env.get('SERPAPI_KEY');
      const shopping =
        includeShopping && serpKey ? await fetchGoogleShopping(queryOnly, serpKey) : [];
      const searchUrl = googleShoppingSearchUrl(queryOnly);
      return jsonResponse({
        url: '',
        title: queryOnly,
        brand: '',
        name: queryOnly,
        image_url: null,
        price: shopping[0]?.price ?? null,
        merchant: shopping[0]?.source ?? null,
        shopping,
        shopping_search_url: searchUrl,
        shopping_error: includeShopping && !serpKey
          ? 'Google Shopping is not configured (SERPAPI_KEY missing on Supabase).'
          : null,
        scrape_quality: 'url_only' as ScrapeQuality,
        scrape_warning: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not search shopping';
      return jsonResponse({ error: message }, 422);
    }
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl!);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return textResponse('Invalid URL scheme', 400);
    }
  } catch {
    return textResponse('Invalid URL', 400);
  }

  try {
    const resolved = await resolveProductUrl(parsed.toString(), body.include_shopping !== false);
    return jsonResponse(resolved);
  } catch (err) {
    const slugTitle = productNameFromUrl(parsed.toString());
    const query = slugTitle || parsed.hostname.replace(/^www\./, '');
    const includeShopping = body.include_shopping !== false;
    const serpKey = Deno.env.get('SERPAPI_KEY');
    const shopping =
      includeShopping && serpKey && query ? await fetchGoogleShopping(query, serpKey) : [];
    const message = err instanceof Error ? err.message : 'Could not resolve product';

    return jsonResponse({
      url: parsed.toString(),
      title: slugTitle ?? query,
      brand: '',
      name: slugTitle ?? query,
      image_url: null,
      price: shopping[0]?.price ?? null,
      merchant: shopping[0]?.source ?? hostnameLabel(parsed.hostname),
      shopping,
      shopping_search_url: query ? googleShoppingSearchUrl(query) : null,
      shopping_error: includeShopping && !serpKey
        ? 'Google Shopping is not configured (SERPAPI_KEY missing on Supabase).'
        : shopping.length === 0
          ? message
          : null,
      scrape_quality: 'url_only' as ScrapeQuality,
      scrape_warning: message,
    });
  }
});

async function resolveProductUrl(
  requestedUrl: string,
  includeShopping: boolean
): Promise<ResolvedProduct> {
  const { html, finalUrl } = await fetchHtml(requestedUrl);
  const slugTitle = productNameFromUrl(requestedUrl);
  const meta = parsePageMeta(html, finalUrl);
  const scrapeQuality = assessScrapeQuality(meta, html, requestedUrl, finalUrl);
  const useSlugFallback = scrapeQuality !== 'high' && !!slugTitle;

  const effectiveTitle = useSlugFallback ? slugTitle : meta.title;
  const { brand, name } = splitBrandAndName(
    effectiveTitle,
    useSlugFallback ? null : meta.brand,
    meta.merchant
  );
  const query = useSlugFallback
    ? slugTitle
    : `${brand} ${name}`.trim() || meta.title;

  let shopping: ShoppingOffer[] = [];
  let shoppingSearchUrl: string | null = null;
  let shoppingError: string | null = null;

  if (includeShopping && query) {
    const serpKey = Deno.env.get('SERPAPI_KEY');
    if (serpKey) {
      shopping = await fetchGoogleShopping(query, serpKey);
      if (shopping.length === 0 && slugTitle && slugTitle !== query) {
        shopping = await fetchGoogleShopping(slugTitle, serpKey);
      }
    } else {
      shoppingError = 'Google Shopping is not configured (SERPAPI_KEY missing on Supabase).';
    }
    shoppingSearchUrl = googleShoppingSearchUrl(query);
  }

  shopping = shopping.filter((offer) => !isStoreHomepageUrl(offer.url));

  const scrapeWarning = buildScrapeWarning(scrapeQuality, requestedUrl, finalUrl, slugTitle);

  return {
    url: requestedUrl,
    title: effectiveTitle,
    brand,
    name,
    image_url: scrapeQuality === 'high' ? meta.image : null,
    price: scrapeQuality === 'high' ? meta.price : null,
    merchant: meta.merchant,
    shopping,
    shopping_search_url: shoppingSearchUrl,
    shopping_error: shoppingError,
    scrape_quality: scrapeQuality,
    scrape_warning: scrapeWarning,
  };
}

type FetchHtmlResult = { html: string; finalUrl: string };

async function fetchHtml(url: string): Promise<FetchHtmlResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`Store returned ${res.status}`);
    const ct = (res.headers.get('content-type') ?? '').toLowerCase();
    const body = await res.text();
    if (
      !ct.includes('text/html') &&
      !ct.includes('application/xhtml') &&
      !body.includes('<html')
    ) {
      throw new Error('URL does not look like a product page');
    }
    return { html: body, finalUrl: res.url || url };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Store took too long to respond — try again');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

type PageMeta = {
  title: string;
  brand: string | null;
  image: string | null;
  price: string | null;
  merchant: string | null;
};

function parsePageMeta(html: string, pageUrl: string): PageMeta {
  const jsonLd = extractJsonLdProduct(html);
  const ogTitle = metaContent(html, 'og:title') ?? metaContent(html, 'twitter:title');
  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
  const title = decodeEntities(jsonLd?.name ?? ogTitle ?? titleTag ?? 'Product');

  const brand =
    jsonLd?.brand?.name ??
    jsonLd?.brand ??
    metaContent(html, 'product:brand') ??
    metaContent(html, 'og:site_name') ??
    null;

  const image =
    jsonLd?.image?.[0] ??
    jsonLd?.image ??
    metaContent(html, 'og:image') ??
    metaContent(html, 'twitter:image');

  const price =
    jsonLd?.offers?.price ??
    jsonLd?.offers?.[0]?.price ??
    metaContent(html, 'product:price:amount') ??
    metaContent(html, 'og:price:amount') ??
    extractPriceFromHtml(html);

  const merchant =
    metaContent(html, 'og:site_name') ??
    hostnameLabel(new URL(pageUrl).hostname);

  return {
    title,
    brand: brand ? decodeEntities(String(brand)) : null,
    image: image ? absolutizeUrl(String(image), pageUrl) : null,
    price: price ? String(price) : null,
    merchant: merchant ? decodeEntities(String(merchant)) : null,
  };
}

function extractJsonLdProduct(html: string): Record<string, unknown> | null {
  const blocks = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  if (!blocks) return null;

  for (const block of blocks) {
    const inner = block.replace(/<\/?script[^>]*>/gi, '').trim();
    try {
      const data = JSON.parse(inner) as unknown;
      const product = findProductNode(data);
      if (product) return product;
    } catch {
      /* try next block */
    }
  }
  return null;
}

function findProductNode(data: unknown): Record<string, unknown> | null {
  if (!data) return null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findProductNode(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const type = String(obj['@type'] ?? '');
    if (type === 'Product' || type.includes('Product')) return obj;
    if (obj['@graph']) return findProductNode(obj['@graph']);
  }
  return null;
}

function metaContent(html: string, key: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escapeReg(key)}["'][^>]+content=["']([^"']+)["']`,
      'i'
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escapeReg(key)}["']`,
      'i'
    ),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function absolutizeUrl(raw: string, base: string): string {
  try {
    return new URL(raw, base).toString();
  } catch {
    return raw;
  }
}

function hostnameLabel(host: string): string {
  const h = host.replace(/^www\./, '');
  const part = h.split('.')[0] ?? h;
  return part.charAt(0).toUpperCase() + part.slice(1);
}

function splitBrandAndName(
  title: string,
  brandHint: string | null,
  merchant: string | null
): { brand: string; name: string } {
  const clean = title.trim();
  if (!clean) {
    return { brand: brandHint ?? merchant ?? 'Unknown', name: 'Product' };
  }

  if (brandHint && clean.toLowerCase().startsWith(brandHint.toLowerCase())) {
    const name = clean.slice(brandHint.length).replace(/^[\s|\-–—:]+/, '').trim();
    if (name) return { brand: brandHint, name };
  }

  const dash = clean.match(/^(.+?)\s[\-|–|—|:]\s(.+)$/);
  if (dash) {
    return { brand: dash[1].trim(), name: dash[2].trim() };
  }

  const words = clean.split(/\s+/);
  if (words.length >= 3) {
    return { brand: words[0], name: words.slice(1).join(' ') };
  }

  return { brand: brandHint ?? merchant ?? words[0] ?? 'Unknown', name: clean };
}

function extractPriceFromHtml(html: string): string | null {
  const m = html.match(/\$\s?[\d,]+(?:\.\d{2})?/);
  return m?.[0]?.replace(/\s/g, '') ?? null;
}

/** Derive a readable product name from the last meaningful URL path segment. */
function productNameFromUrl(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    const segments = u.pathname.split('/').filter(Boolean);
    if (segments.length === 0) return null;

    const skip = new Set([
      'buy',
      'buy-sale',
      'product',
      'products',
      'shop',
      'item',
      'p',
      'tents',
      'camping',
      'en',
      'au',
    ]);
    let slug = '';
    for (let i = segments.length - 1; i >= 0; i--) {
      const seg = segments[i];
      if (/^\d+$/.test(seg)) continue;
      if (skip.has(seg.toLowerCase())) continue;
      slug = seg;
      break;
    }
    if (!slug || slug.length < 3) return null;

    const words = slug
      .replace(/[_+]/g, '-')
      .split('-')
      .filter(Boolean)
      .map((w) => w.replace(/\.(html?|php|aspx)$/i, ''))
      .filter((w) => w.length > 0);

    if (words.length === 0) return null;

    return words
      .map((w) => {
        if (/^\d+$/.test(w)) return w;
        if (w.length <= 3 && w === w.toUpperCase()) return w;
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      })
      .join(' ');
  } catch {
    return null;
  }
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

function isLikelyProductUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    const segments = u.pathname.split('/').filter(Boolean);
    if (segments.length === 0) return false;
    const last = segments[segments.length - 1] ?? '';
    if (/^\d+$/.test(last) && segments.length >= 2) return true;
    if (last.includes('-') && last.length >= 8) return true;
    const productPrefixes = ['buy', 'buy-sale', 'product', 'products', 'p', 'item', 'shop'];
    return segments.some((s) => productPrefixes.includes(s.toLowerCase())) && segments.length >= 2;
  } catch {
    return false;
  }
}

function isGenericPageTitle(title: string, merchant: string | null): boolean {
  const t = title.trim().toLowerCase();
  if (!t || t === 'product') return true;
  if (/^home\s*page\b/.test(t)) return true;
  if (/^welcome\b/.test(t)) return true;
  if (merchant && t === merchant.trim().toLowerCase()) return true;
  if (merchant && t === `${merchant.trim().toLowerCase()} - home`) return true;
  const dashParts = title.split(/\s[-–—|]\s/);
  if (dashParts.length === 2) {
    const [left, right] = dashParts.map((p) => p.trim().toLowerCase());
    if (left === 'home page' && !!right) return true;
    if (merchant && right === merchant.trim().toLowerCase() && /home|shop|store|welcome/.test(left)) {
      return true;
    }
  }
  return false;
}

function assessScrapeQuality(
  meta: PageMeta,
  html: string,
  requestedUrl: string,
  finalUrl: string
): ScrapeQuality {
  if (isStoreHomepageUrl(requestedUrl) || !isLikelyProductUrl(requestedUrl)) {
    return 'url_only';
  }

  const requestedPath = new URL(requestedUrl).pathname;
  const finalPath = new URL(finalUrl).pathname;
  if (
    isStoreHomepageUrl(finalUrl) &&
    requestedPath !== finalPath &&
    !isStoreHomepageUrl(requestedUrl)
  ) {
    return 'url_only';
  }

  const hasJsonLd = !!extractJsonLdProduct(html);
  const genericTitle = isGenericPageTitle(meta.title, meta.merchant);

  if (hasJsonLd && !genericTitle) return 'high';
  if (!genericTitle && meta.title.length > 12 && !meta.title.toLowerCase().includes('home page')) {
    return 'high';
  }
  if (productNameFromUrl(requestedUrl)) return 'low';
  return 'url_only';
}

function buildScrapeWarning(
  quality: ScrapeQuality,
  requestedUrl: string,
  finalUrl: string,
  slugTitle: string | null
): string | null {
  if (quality === 'high') return null;

  if (isStoreHomepageUrl(requestedUrl) || !isLikelyProductUrl(requestedUrl)) {
    return 'This looks like a store homepage or category page — paste the direct product page URL from your browser.';
  }

  const requestedPath = new URL(requestedUrl).pathname;
  const finalPath = new URL(finalUrl).pathname;
  if (
    isStoreHomepageUrl(finalUrl) &&
    requestedPath !== finalPath &&
    !isStoreHomepageUrl(requestedUrl)
  ) {
    return 'The store redirected to its homepage — double-check the product link in your browser.';
  }

  if (quality === 'low' && slugTitle) {
    return `Store page uses dynamic loading — we read the product name from the link (${slugTitle}). Your exact URL is saved.`;
  }

  return 'Could not read product details from this page — your link is saved as-is.';
}
