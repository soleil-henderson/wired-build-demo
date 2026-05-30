export type VinDecodeSummary = {
  make: string | null;
  model: string | null;
  model_year: string | null;
  trim: string | null;
  body_class: string | null;
  engine: string | null;
  fuel_type: string | null;
  drive_type: string | null;
  plant_country: string | null;
};

/** Free NHTSA vPIC VIN decode — no API key. */
export async function decodeVinSummary(vin: string): Promise<VinDecodeSummary | null> {
  const normalized = vin.trim().toUpperCase();
  if (normalized.length !== 17) return null;

  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(normalized)}?format=json`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const data = (await res.json()) as {
    Results?: Record<string, string>[];
  };
  const row = data.Results?.[0];
  if (!row) return null;

  const engine = [row.EngineModel, row.EngineCylinders ? `${row.EngineCylinders}-cyl` : null]
    .filter(Boolean)
    .join(' ');

  return {
    make: row.Make || null,
    model: row.Model || null,
    model_year: row.ModelYear || null,
    trim: row.Trim || row.Trim2 || null,
    body_class: row.BodyClass || null,
    engine: engine || row.EngineConfiguration || null,
    fuel_type: row.FuelTypePrimary || null,
    drive_type: row.DriveType || null,
    plant_country: row.PlantCountry || null,
  };
}
