import { VIN_PATTERN } from './vin-handoff';

/**
 * VIN decoding via the NHTSA vPIC public API (no auth required).
 *
 * NHTSA is US-centric but the underlying VIN structure (WMI / VDS / VIS)
 * is an ISO standard. For AU 4WDs you'll usually get year + make
 * reliably; model and trim hit-rates are lower for AU-only variants.
 * Empty / "Not Applicable" fields are surfaced as undefined, so the
 * caller (Add-Vehicle) only ever fills blanks — never clobbers what the
 * user typed.
 */
export type VinDecodeResult = {
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
};

const VPIC_ENDPOINT = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/';

type VpicResponse = {
  Count?: number;
  Results?: Record<string, string | number>[];
};

export async function decodeVin(vin: string): Promise<VinDecodeResult | null> {
  if (!VIN_PATTERN.test(vin)) return null;

  try {
    const res = await fetch(`${VPIC_ENDPOINT}${vin}?format=json`);
    if (!res.ok) return null;
    const json = (await res.json()) as VpicResponse;
    const row = json.Results?.[0];
    if (!row) return null;

    // vPIC writes empty values as either '' or 'Not Applicable' — both
    // are noise for the form.
    const clean = (v: unknown): string | undefined => {
      if (v == null) return undefined;
      const s = String(v).trim();
      if (!s || s.toLowerCase() === 'not applicable') return undefined;
      return s;
    };

    const yearStr = clean(row.ModelYear);
    const yearNum = yearStr ? Number(yearStr) : NaN;

    const make = clean(row.Make);
    const model = clean(row.Model);
    const trim = clean(row.Trim ?? row.Trim2 ?? row.Series);

    return {
      year: Number.isFinite(yearNum) && yearNum > 1900 ? yearNum : undefined,
      // NHTSA returns Make in ALLCAPS ("TOYOTA"); title-case for display.
      make: make ? toTitleCase(make) : undefined,
      model: model || undefined,
      trim: trim || undefined,
    };
  } catch {
    // Network failure / parse error / offline — caller just keeps the
    // manual entry experience.
    return null;
  }
}

function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
