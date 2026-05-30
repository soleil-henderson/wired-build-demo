/** Stored on `events.location` (jsonb) when picked via Google Places. */
export type EventPlace = {
  place_id: string;
  name: string;
  formatted_address: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  maps_url: string;
};

export type PlacePrediction = {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
};

export function parseEventPlace(raw: unknown): EventPlace | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const lat = typeof o.lat === 'number' ? o.lat : null;
  const lng = typeof o.lng === 'number' ? o.lng : null;
  const name = typeof o.name === 'string' ? o.name.trim() : '';
  const formatted =
    typeof o.formatted_address === 'string' ? o.formatted_address.trim() : '';
  if (lat == null || lng == null || !name) return null;
  return {
    place_id: typeof o.place_id === 'string' ? o.place_id : '',
    name,
    formatted_address: formatted || name,
    city: typeof o.city === 'string' ? o.city : '',
    country: typeof o.country === 'string' ? o.country : '',
    lat,
    lng,
    maps_url:
      typeof o.maps_url === 'string' && o.maps_url
        ? o.maps_url
        : buildGoogleMapsUrl(lat, lng, name),
  };
}

export function buildGoogleMapsUrl(lat: number, lng: number, label: string): string {
  const q = encodeURIComponent(`${label}@${lat},${lng}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function buildGoogleMapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
