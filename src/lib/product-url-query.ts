/** Derive a readable product name from the last meaningful URL path segment. */
export function productNameFromUrl(rawUrl: string): string | null {
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

export function buildGoogleShoppingSearchUrl(query: string): string {
  return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query.trim())}`;
}

/** Build search queries to try, most specific first. */
export function buildShoppingQueries(label: string, url?: string | null): string[] {
  const out: string[] = [];
  const add = (q: string | null | undefined) => {
    const trimmed = q?.trim();
    if (!trimmed || trimmed.length < 3) return;
    if (!out.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())) {
      out.push(trimmed);
    }
  };

  add(label);
  if (url) add(productNameFromUrl(url));
  return out;
}
