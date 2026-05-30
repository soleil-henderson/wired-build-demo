export type UserLocation = {
  city: string;
  country: string;
  lat?: number;
  lng?: number;
};

export function parseUserLocation(raw: unknown): UserLocation | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const city = typeof o.city === 'string' ? o.city.trim() : '';
  const country = typeof o.country === 'string' ? o.country.trim() : '';
  const lat = typeof o.lat === 'number' && Number.isFinite(o.lat) ? o.lat : undefined;
  const lng = typeof o.lng === 'number' && Number.isFinite(o.lng) ? o.lng : undefined;
  if (!city && !country && lat == null && lng == null) return null;
  return { city, country, lat, lng };
}

export function mergeLocationCoords(
  base: UserLocation | null,
  coords: { lat: number; lng: number }
): UserLocation {
  return {
    city: base?.city ?? '',
    country: base?.country ?? '',
    lat: coords.lat,
    lng: coords.lng,
  };
}

/** Great-circle distance in kilometres. */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.max(0.1, Math.round(km * 10) / 10)}km`;
  if (km < 10) return `${km.toFixed(1)}km`;
  return `${Math.round(km)}km`;
}

export function formatUserLocation(loc: UserLocation | null): string | null {
  if (!loc) return null;
  if (loc.city && loc.country) return `${loc.city}, ${loc.country}`;
  return loc.city || loc.country || null;
}

export function serializeUserLocation(
  city: string,
  country: string
): UserLocation | null {
  const c = city.trim();
  const co = country.trim();
  if (!c && !co) return null;
  return { city: c, country: co };
}
