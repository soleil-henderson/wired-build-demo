export type ModProductLink = {
  name: string;
  url: string;
  purpose?: string;
};

export type ShoppingOffer = {
  title: string;
  price: string | null;
  url: string;
  source: string;
};

export type ModProductLinks = {
  primary: ModProductLink | null;
  extras: ModProductLink[];
  shopping?: ShoppingOffer[];
  shopping_search_url?: string | null;
};

export function emptyProductLinks(): ModProductLinks {
  return { primary: null, extras: [] };
}

export function parseProductLinks(raw: unknown): ModProductLinks {
  if (!raw || typeof raw !== 'object') return emptyProductLinks();
  const obj = raw as Record<string, unknown>;
  const primary = parseLink(obj.primary);
  const extras = Array.isArray(obj.extras)
    ? obj.extras.map(parseLink).filter((l): l is ModProductLink => l !== null)
    : [];
  const shopping = Array.isArray(obj.shopping)
    ? obj.shopping
        .map(parseShopping)
        .filter((s): s is ShoppingOffer => s !== null)
    : [];
  const shopping_search_url =
    typeof obj.shopping_search_url === 'string' ? obj.shopping_search_url : null;
  return { primary, extras, shopping, shopping_search_url };
}

function parseShopping(raw: unknown): ShoppingOffer | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const title = typeof o.title === 'string' ? o.title.trim() : '';
  const url = typeof o.url === 'string' ? o.url.trim() : '';
  if (!title || !url) return null;
  return {
    title,
    url,
    price: typeof o.price === 'string' ? o.price : null,
    source: typeof o.source === 'string' ? o.source : 'Store',
  };
}

function parseLink(raw: unknown): ModProductLink | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === 'string' ? o.name.trim() : '';
  const url = typeof o.url === 'string' ? o.url.trim() : '';
  if (!name && !url) return null;
  const purpose = typeof o.purpose === 'string' ? o.purpose.trim() : undefined;
  return { name: name || url, url, ...(purpose ? { purpose } : {}) };
}

export function serializeProductLinks(links: ModProductLinks): ModProductLinks {
  const primary =
    links.primary?.url.trim()
      ? {
          name: links.primary.name.trim() || links.primary.url.trim(),
          url: links.primary.url.trim(),
        }
      : null;
  const extras = links.extras
    .filter((e) => e.url.trim())
    .map((e) => ({
      name: e.name.trim() || e.url.trim(),
      url: e.url.trim(),
      ...(e.purpose?.trim() ? { purpose: e.purpose.trim() } : {}),
    }));
  const shopping = (links.shopping ?? [])
    .filter((s) => s.url.trim() && s.title.trim())
    .map((s) => ({
      title: s.title.trim(),
      url: s.url.trim(),
      price: s.price,
      source: s.source.trim() || 'Store',
    }));
  return {
    primary,
    extras,
    ...(shopping.length ? { shopping } : {}),
    ...(links.shopping_search_url ? { shopping_search_url: links.shopping_search_url } : {}),
  };
}
