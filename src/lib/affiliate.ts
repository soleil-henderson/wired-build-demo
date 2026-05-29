export type AffiliateLink = {
  url: string;
  label?: string;
};

export type ExtractAffiliateOptions = {
  /** Prefer `member_url` when present (Member tier perk). */
  memberRates?: boolean;
  /** ISO region code, e.g. `au` or `us`. Defaults to `au`. */
  region?: string;
};

/**
 * Parse `parts.affiliate_links` JSON.
 *
 * Supported shapes:
 * - `{ url, label?, member_url? }`
 * - `{ regions: { au: { url, member_url?, label? }, us: … }, default_region?: "au" }`
 */
export function extractAffiliate(
  raw: unknown,
  opts?: ExtractAffiliateOptions
): AffiliateLink | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const root = raw as Record<string, unknown>;

  const regions = root.regions;
  if (regions && typeof regions === 'object' && !Array.isArray(regions)) {
    const regionKey = (opts?.region ?? root.default_region ?? 'au')
      .toString()
      .toLowerCase();
    const entry = (regions as Record<string, unknown>)[regionKey];
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      return pickLink(entry as Record<string, unknown>, opts?.memberRates);
    }
  }

  return pickLink(root, opts?.memberRates);
}

function pickLink(obj: Record<string, unknown>, memberRates?: boolean): AffiliateLink | null {
  const memberUrl = typeof obj.member_url === 'string' ? obj.member_url : null;
  const standardUrl = typeof obj.url === 'string' ? obj.url : null;
  const url =
    memberRates && memberUrl && /^https?:\/\//i.test(memberUrl)
      ? memberUrl
      : standardUrl;
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const label = typeof obj.label === 'string' ? obj.label : undefined;
  return { url, label };
}
