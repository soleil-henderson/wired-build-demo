import type { EventPlace, PlacePrediction } from './event-place';
import { supabase } from './supabase';

async function callPlacesApi<T>(body: Record<string, unknown>): Promise<T> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error('Sign in to search locations.');

  const base = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const apikey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
  const res = await fetch(`${base}/functions/v1/places-autocomplete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey,
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  let payload: unknown;
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    if (res.status === 404) {
      throw new Error(
        'Location search is not deployed yet. Run: supabase functions deploy places-autocomplete'
      );
    }
    throw new Error(raw.trim() || 'Location search failed');
  }
  const parsed = payload as T & { error?: string; message?: string };
  if (!res.ok) {
    throw new Error(
      parsed.error ??
        parsed.message ??
        (res.status === 503
          ? 'Google Maps is not configured. Add GOOGLE_MAPS_API_KEY in Supabase secrets.'
          : 'Location search failed')
    );
  }
  return parsed;
}

export async function searchPlaces(input: string): Promise<PlacePrediction[]> {
  const term = input.trim();
  if (term.length < 2) return [];
  const { predictions } = await callPlacesApi<{ predictions: PlacePrediction[] }>({
    input: term,
  });
  return predictions ?? [];
}

export async function resolvePlace(placeId: string): Promise<EventPlace> {
  const { place } = await callPlacesApi<{ place: EventPlace }>({ place_id: placeId });
  if (!place) throw new Error('Could not load place details');
  return place;
}
