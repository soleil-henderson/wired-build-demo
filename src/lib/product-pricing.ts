import type { ShoppingOffer } from './mod-products';

export type PricedOffer = ShoppingOffer & { amount: number };

export type PriceAnalysis = {
  min: number;
  max: number;
  best: PricedOffer;
  offers: PricedOffer[];
};

/** Parse currency strings like "$2,090", "A$2,090.00", "2090" into a number. */
export function parsePrice(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.]/g, '');
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function analyzeShoppingOffers(offers: ShoppingOffer[]): PriceAnalysis | null {
  const priced: PricedOffer[] = offers
    .map((o) => {
      const amount = parsePrice(o.price);
      return amount != null ? { ...o, amount } : null;
    })
    .filter((o): o is PricedOffer => o !== null);

  if (priced.length === 0) return null;

  const amounts = priced.map((p) => p.amount);
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  const best = priced.reduce((a, b) => (a.amount <= b.amount ? a : b));

  return { min, max, best, offers: priced };
}

export function formatMoney(amount: number): string {
  return `$${Math.round(amount).toLocaleString()}`;
}

/** Compact range label, e.g. $340–$420 (catalogue or Google Shopping min/max). */
export function formatPriceRangeLabel(
  min: number | null | undefined,
  max: number | null | undefined
): string | null {
  const lo = min != null && Number.isFinite(min) ? min : null;
  const hi = max != null && Number.isFinite(max) ? max : null;
  if (lo == null && hi == null) return null;
  if (lo != null && hi != null) {
    const a = Math.round(Math.min(lo, hi));
    const b = Math.round(Math.max(lo, hi));
    return a === b ? `$${a.toLocaleString()}` : `$${a.toLocaleString()}–$${b.toLocaleString()}`;
  }
  const single = Math.round((lo ?? hi)!);
  return `$${single.toLocaleString()}`;
}

/** Position on 0–1 scale for the price range marker. */
export function pricePosition(amount: number, min: number, max: number): number {
  if (max <= min) return 0.5;
  return Math.min(1, Math.max(0, (amount - min) / (max - min)));
}
