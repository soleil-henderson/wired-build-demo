import { supabase } from './supabase';
import type { Database, SubscriptionTier } from '@/types/database';

export type PublicBuildOwner = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  is_workshop: boolean;
  is_identity_verified: boolean;
  subscription_tier: SubscriptionTier;
};

export type PublicBuildVehicle = Pick<
  Database['public']['Tables']['vehicles']['Row'],
  | 'id'
  | 'vin'
  | 'year'
  | 'make'
  | 'model'
  | 'trim'
  | 'nickname'
  | 'cover_photo_url'
  | 'total_spend'
  | 'build_value'
  | 'valuation_source'
  | 'is_public'
  | 'is_for_sale'
  | 'asking_price'
  | 'created_at'
> & {
  owner: PublicBuildOwner | null;
};

export type PublicBuildMod = {
  id: string;
  category: Database['public']['Tables']['mods']['Row']['category'];
  cost: number | null;
  cost_is_approximate: boolean;
  install_date: string;
  date_is_approximate: boolean;
  installer_type: Database['public']['Tables']['mods']['Row']['installer_type'];
  notes: string | null;
  part: { id: string; brand: string; name: string } | null;
  custom_part_name: string | null;
  photo_url: string | null;
};

export type PublicBuildTransfer = {
  id: string;
  created_at: string;
  note: string | null;
  from_user: { handle: string; display_name: string } | null;
  to_user: { handle: string; display_name: string } | null;
};

export type PublicBuild = {
  vehicle: PublicBuildVehicle;
  mods: PublicBuildMod[];
  history: PublicBuildTransfer[];
};

/**
 * Fetch everything needed to render a public build page in three parallel
 * queries. Reachable by `anon` because every underlying table's RLS allows
 * reads of public-vehicle rows. Returns null when the vehicle doesn't exist
 * OR isn't public — we never want to leak the existence of a private build.
 */
export async function getPublicBuild(id: string): Promise<PublicBuild | null> {
  const [vehicleRes, modsRes, historyRes] = await Promise.all([
    supabase
      .from('vehicles')
      .select(
        `
        id, vin, year, make, model, trim, nickname, cover_photo_url,
        total_spend, build_value, valuation_source, is_public, is_for_sale, asking_price, created_at,
        owner:users!vehicles_current_owner_id_fkey (
          id, handle, display_name, avatar_url, bio,
          is_workshop, is_identity_verified, subscription_tier
        )
      `
      )
      .eq('id', id)
      .eq('is_public', true)
      .maybeSingle(),
    supabase
      .from('mods')
      .select(
        `
        id, category, cost, cost_is_approximate, install_date,
        date_is_approximate, installer_type, notes, custom_part_name,
        part:parts ( id, brand, name ),
        media!media_mod_id_fkey ( url, kind, is_sensitive )
      `
      )
      .eq('vehicle_id', id)
      .eq('privacy', 'public')
      .order('install_date', { ascending: false }),
    supabase
      .from('ownership_transfers')
      .select(
        `
        id, created_at, note,
        from_user:users!ownership_transfers_from_user_id_fkey ( handle, display_name ),
        to_user:users!ownership_transfers_to_user_id_fkey ( handle, display_name )
      `
      )
      .eq('vehicle_id', id)
      .order('created_at', { ascending: false }),
  ]);

  if (vehicleRes.error || !vehicleRes.data) return null;

  type RawVehicle = Omit<PublicBuildVehicle, 'owner'> & {
    owner: PublicBuildOwner | PublicBuildOwner[] | null;
  };
  const rv = vehicleRes.data as RawVehicle;
  const ownerNorm: PublicBuildOwner | null = !rv.owner
    ? null
    : Array.isArray(rv.owner)
      ? (rv.owner[0] ?? null)
      : rv.owner;

  type RawMod = {
    id: string;
    category: PublicBuildMod['category'];
    cost: number | null;
    cost_is_approximate: boolean;
    install_date: string;
    date_is_approximate: boolean;
    installer_type: PublicBuildMod['installer_type'];
    notes: string | null;
    custom_part_name: string | null;
    part: { id: string; brand: string; name: string } | null;
    media: { url: string; kind: string; is_sensitive: boolean }[] | null;
  };
  const mods = ((modsRes.data ?? []) as RawMod[]).map((m) => ({
    id: m.id,
    category: m.category,
    cost: m.cost,
    cost_is_approximate: m.cost_is_approximate,
    install_date: m.install_date,
    date_is_approximate: m.date_is_approximate,
    installer_type: m.installer_type,
    notes: m.notes,
    custom_part_name: m.custom_part_name,
    part: m.part,
    photo_url:
      m.media?.find((x) => x.kind === 'photo' && !x.is_sensitive)?.url ?? null,
  })) as PublicBuildMod[];

  type RawTransfer = {
    id: string;
    created_at: string;
    note: string | null;
    from_user:
      | { handle: string; display_name: string }
      | { handle: string; display_name: string }[]
      | null;
    to_user:
      | { handle: string; display_name: string }
      | { handle: string; display_name: string }[]
      | null;
  };
  const normaliseUser = (
    u: RawTransfer['from_user']
  ): PublicBuildTransfer['from_user'] =>
    !u ? null : Array.isArray(u) ? (u[0] ?? null) : u;

  const history: PublicBuildTransfer[] = ((historyRes.data ?? []) as RawTransfer[]).map(
    (t) => ({
      id: t.id,
      created_at: t.created_at,
      note: t.note,
      from_user: normaliseUser(t.from_user),
      to_user: normaliseUser(t.to_user),
    })
  );

  return {
    vehicle: {
      ...(rv as PublicBuildVehicle),
      owner: ownerNorm,
    },
    mods,
    history,
  };
}

export { publicBuildUrl } from './site-url';
