import { extractAffiliate } from './affiliate';
import type { ModProductLinks } from './mod-products';

export type ModShopContext = {
  product_links: ModProductLinks | null;
  part: { affiliate_links?: unknown } | null;
  partLabel?: string | null;
};

export type ResolvedShopLink = {
  url: string;
  label: string;
  subtitle?: string;
};

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

/** Best buy link for a mod — product URL first, then catalogue affiliate, then shopping alt. */
export function resolveModShopLink(mod: ModShopContext | null): ResolvedShopLink | null {
  if (!mod) return null;

  const primary = mod.product_links?.primary;
  if (primary?.url?.trim()) {
    return {
      url: primary.url.trim(),
      label: 'Shop this product',
      subtitle: primary.name || mod.partLabel || undefined,
    };
  }

  if (mod.part?.affiliate_links) {
    const affiliate = extractAffiliate(mod.part.affiliate_links);
    if (affiliate) {
      return {
        url: affiliate.url,
        label: affiliate.label ?? 'Shop this product',
        subtitle: mod.partLabel ?? undefined,
      };
    }
  }

  const alt = mod.product_links?.shopping?.find((s) => s.url && !isStoreHomepageUrl(s.url));
  if (alt?.url) {
    return {
      url: alt.url,
      label: 'Shop this product',
      subtitle: alt.source ? `via ${alt.source}` : alt.title,
    };
  }

  if (mod.product_links?.shopping_search_url) {
    return {
      url: mod.product_links.shopping_search_url,
      label: 'Find online',
      subtitle: mod.partLabel ?? undefined,
    };
  }

  return null;
}

export function modHasShopLink(mod: ModShopContext | null): boolean {
  return resolveModShopLink(mod) !== null;
}
