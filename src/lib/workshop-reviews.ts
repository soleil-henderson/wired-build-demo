import { supabase } from './supabase';
import type { SubscriptionTier } from '@/types/database';

export type WorkshopReview = {
  id: string;
  workshop_user_id: string;
  rating: number;
  body: string | null;
  reply_body: string | null;
  reply_at: string | null;
  created_at: string;
  reviewer: {
    id: string;
    handle: string;
    display_name: string;
    avatar_url: string | null;
    subscription_tier: SubscriptionTier;
    is_identity_verified: boolean;
    is_workshop: boolean;
  };
};

export type WorkshopReviewStats = {
  avg_rating: number | null;
  review_count: number;
};

export async function getWorkshopReviewStats(
  workshopUserId: string
): Promise<WorkshopReviewStats> {
  const { data: rows } = await supabase
    .from('workshop_reviews')
    .select('rating')
    .eq('workshop_user_id', workshopUserId);
  const ratings = (rows ?? []).map((r) => r.rating);
  if (ratings.length === 0) return { avg_rating: null, review_count: 0 };
  const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  return { avg_rating: Math.round(avg * 10) / 10, review_count: ratings.length };
}

export async function listWorkshopReviews(
  workshopUserId: string,
  limit = 40
): Promise<WorkshopReview[]> {
  const { data: rows, error } = await supabase
    .from('workshop_reviews')
    .select('id, workshop_user_id, reviewer_user_id, rating, body, reply_body, reply_at, created_at')
    .eq('workshop_user_id', workshopUserId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  if (!rows?.length) return [];

  const reviewerIds = [...new Set(rows.map((r) => r.reviewer_user_id))];
  const { data: users } = await supabase
    .from('users')
    .select(
      'id, handle, display_name, avatar_url, subscription_tier, is_identity_verified, is_workshop'
    )
    .in('id', reviewerIds);
  const byId = new Map((users ?? []).map((u) => [u.id, u]));

  return rows.map((r) => {
    const reviewer = byId.get(r.reviewer_user_id);
    if (!reviewer) throw new Error('Review missing reviewer');
    return {
      id: r.id,
      workshop_user_id: r.workshop_user_id,
      rating: r.rating,
      body: r.body,
      reply_body: r.reply_body,
      reply_at: r.reply_at,
      created_at: r.created_at,
      reviewer,
    };
  });
}

export async function getMyWorkshopReview(
  workshopUserId: string,
  reviewerUserId: string
): Promise<{ id: string; rating: number; body: string | null } | null> {
  const { data } = await supabase
    .from('workshop_reviews')
    .select('id, rating, body')
    .eq('workshop_user_id', workshopUserId)
    .eq('reviewer_user_id', reviewerUserId)
    .maybeSingle();
  return data;
}

/** True if reviewer owns a vehicle that tagged this workshop on a mod. */
export async function canReviewWorkshop(
  workshopUserId: string,
  reviewerUserId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('mods')
    .select('vehicle:vehicles!inner(current_owner_id)')
    .eq('installer_workshop_id', workshopUserId)
    .eq('installer_type', 'workshop')
    .limit(50);
  if (error || !data?.length) return false;
  return data.some((row) => {
    const v = row.vehicle as
      | { current_owner_id: string }
      | { current_owner_id: string }[];
    const vehicle = Array.isArray(v) ? v[0] : v;
    return vehicle?.current_owner_id === reviewerUserId;
  });
}

export async function upsertWorkshopReview(input: {
  workshopUserId: string;
  reviewerUserId: string;
  rating: number;
  body?: string | null;
  modId?: string | null;
}): Promise<void> {
  const { error } = await supabase.from('workshop_reviews').upsert(
    {
      workshop_user_id: input.workshopUserId,
      reviewer_user_id: input.reviewerUserId,
      rating: input.rating,
      body: input.body?.trim() || null,
      mod_id: input.modId ?? null,
    },
    { onConflict: 'workshop_user_id,reviewer_user_id' }
  );
  if (error) throw error;
}

export async function replyToWorkshopReview(
  reviewId: string,
  workshopUserId: string,
  replyBody: string
): Promise<void> {
  const { error } = await supabase
    .from('workshop_reviews')
    .update({
      reply_body: replyBody.trim(),
      reply_at: new Date().toISOString(),
    })
    .eq('id', reviewId)
    .eq('workshop_user_id', workshopUserId);
  if (error) throw error;
}
