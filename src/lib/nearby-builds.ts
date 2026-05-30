import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { supabase } from './supabase';
import {
  formatDistanceKm,
  haversineKm,
  mergeLocationCoords,
  parseUserLocation,
  type UserLocation,
} from './user-location';
import { formatCompactMoney } from './garage-cards';

export type NearbyBuild = {
  id: string;
  title: string;
  year: number;
  make: string;
  model: string;
  cover_photo_url: string | null;
  build_value: number | null;
  asking_price: number | null;
  owner_handle: string;
  distance_km: number | null;
  price_label: string;
};

export type ViewerCoordinates = {
  lat: number;
  lng: number;
};

const geocodeCache = new Map<string, { lat: number; lng: number } | null>();

async function resolveCoords(loc: UserLocation): Promise<{ lat: number; lng: number } | null> {
  if (loc.lat != null && loc.lng != null) {
    return { lat: loc.lat, lng: loc.lng };
  }
  const query = [loc.city, loc.country].filter(Boolean).join(', ');
  if (!query) return null;

  const cached = geocodeCache.get(query);
  if (cached !== undefined) return cached;

  try {
    const hits = await Location.geocodeAsync(query);
    const hit = hits[0];
    const coords =
      hit != null
        ? { lat: hit.latitude, lng: hit.longitude }
        : null;
    geocodeCache.set(query, coords);
    return coords;
  } catch {
    geocodeCache.set(query, null);
    return null;
  }
}

function displayPrice(buildValue: number | null, askingPrice: number | null): string {
  if (askingPrice != null && askingPrice > 0) {
    return formatCompactMoney(askingPrice, 0);
  }
  if (buildValue != null && buildValue > 0) {
    return formatCompactMoney(buildValue, 0);
  }
  return '—';
}

/**
 * Device location for Explore "Near you". Returns null on web, denied permission,
 * or unsupported environments.
 */
export async function getViewerCoordinates(): Promise<ViewerCoordinates | null> {
  if (Platform.OS === 'web') return null;

  const services = await Location.hasServicesEnabledAsync();
  if (!services) return null;

  const { status: existing } = await Location.getForegroundPermissionsAsync();
  let status = existing;
  if (status !== 'granted') {
    const req = await Location.requestForegroundPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return null;

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
  };
}

/** Persist viewer coordinates on their profile (keeps city/country). */
export async function syncViewerLocationCoords(
  userId: string,
  coords: ViewerCoordinates
): Promise<void> {
  const { data: row } = await supabase
    .from('users')
    .select('location')
    .eq('id', userId)
    .maybeSingle();

  const base = parseUserLocation(row?.location);
  const next = mergeLocationCoords(base, coords);
  await supabase.from('users').update({ location: next }).eq('id', userId);
}

export async function listNearbyBuilds(
  viewer: ViewerCoordinates | null,
  options?: { excludeUserId?: string | null; limit?: number }
): Promise<NearbyBuild[]> {
  const limit = options?.limit ?? 12;

  const { data, error } = await supabase
    .from('vehicles')
    .select(
      `
      id, year, make, model, nickname, cover_photo_url, build_value, asking_price, is_for_sale,
      owner:users!vehicles_current_owner_id_fkey (
        id, handle, location, is_private
      )
    `
    )
    .eq('is_public', true)
    .order('updated_at', { ascending: false })
    .limit(60);

  if (error || !data) return [];

  type Row = {
    id: string;
    year: number;
    make: string;
    model: string;
    nickname: string | null;
    cover_photo_url: string | null;
    build_value: number | null;
    asking_price: number | null;
    is_for_sale: boolean;
    owner: {
      id: string;
      handle: string;
      location: unknown;
      is_private: boolean;
    } | null;
  };

  const rows = (data as Row[]).filter(
    (r) =>
      r.owner &&
      !r.owner.is_private &&
      r.owner.id !== options?.excludeUserId
  );

  const withDistance: Array<NearbyBuild & { sortKey: number }> = await Promise.all(
    rows.map(async (r) => {
      const owner = r.owner!;
      const loc = parseUserLocation(owner.location);
      let distance_km: number | null = null;
      let sortKey = Number.POSITIVE_INFINITY;

      if (viewer && loc) {
        const ownerCoords = await resolveCoords(loc);
        if (ownerCoords) {
          distance_km = haversineKm(viewer, ownerCoords);
          sortKey = distance_km;
        }
      }

      return {
        id: r.id,
        title: r.nickname ?? `${r.make} ${r.model}`,
        year: r.year,
        make: r.make,
        model: r.model,
        cover_photo_url: r.cover_photo_url,
        build_value: r.build_value != null ? Number(r.build_value) : null,
        asking_price:
          r.is_for_sale && r.asking_price != null ? Number(r.asking_price) : null,
        owner_handle: owner.handle,
        distance_km,
        price_label: displayPrice(
          r.build_value != null ? Number(r.build_value) : null,
          r.is_for_sale && r.asking_price != null ? Number(r.asking_price) : null
        ),
        sortKey,
      };
    })
  );

  withDistance.sort((a, b) => a.sortKey - b.sortKey);

  const ranked = withDistance.filter((b) => b.distance_km != null);
  const pool = ranked.length >= 3 ? ranked : withDistance;

  return pool.slice(0, limit).map(({ sortKey: _s, ...rest }) => rest);
}

export function nearbyDistanceLabel(km: number | null): string | null {
  if (km == null) return null;
  return formatDistanceKm(km);
}
