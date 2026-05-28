import { supabase } from './supabase';
import type { Database, SubscriptionTier } from '@/types/database';

export type ReviewWithAuthor = {
  id: string;
  part_id: string;
  rating: number;
  body: string | null;
  created_at: string;
  updated_at: string;
  author: {
    id: string;
    handle: string;
    display_name: string;
    avatar_url: string | null;
    subscription_tier: SubscriptionTier;
    is_identity_verified: boolean;
    is_workshop: boolean;
  };
};

export type MyReview = Pick<
  Database['public']['Tables']['part_reviews']['Row'],
  'id' | 'rating' | 'body'
> | null;

/**
 * Public read — anyone (anon or auth) can list reviews for a part.
 * Author fields are denormalised so a single round-trip renders the
 * full review card with avatar + badges.
 */
export async function listReviews(
  partId: string,
  limit = 50
): Promise<ReviewWithAuthor[]> {
  const { data, error } = await supabase
    .from('part_reviews')
    .select(
      `
      id, part_id, rating, body, created_at, updated_at,
      author:users!part_reviews_user_id_fkey (
        id, handle, display_name, avatar_url,
        subscription_tier, is_identity_verified, is_workshop
      )
    `
    )
    .eq('part_id', partId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  type RawRow = Omit<ReviewWithAuthor, 'author'> & {
    author:
      | ReviewWithAuthor['author']
      | ReviewWithAuthor['author'][]
      | null;
  };

  return (data ?? []).map((r) => {
    const raw = r as unknown as RawRow;
    const author = Array.isArray(raw.author) ? raw.author[0] : raw.author;
    // RLS guarantees the author row exists (cascade on delete clears
    // reviews when the user is gone), but TS doesn't know that — guard
    // anyway to avoid `any` casts in the consumer.
    if (!author) throw new Error('Review missing author');
    return { ...raw, author } as ReviewWithAuthor;
  });
}

/**
 * Returns the signed-in user's review for a part, if any. Used to pre-fill
 * the composer with an existing rating/body so the same row can be updated
 * in-place (the table has a UNIQUE on part_id + user_id).
 */
export async function getMyReview(
  partId: string,
  userId: string
): Promise<MyReview> {
  const { data, error } = await supabase
    .from('part_reviews')
    .select('id, rating, body')
    .eq('part_id', partId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Insert-or-update the caller's review for a part. RLS keys off user_id =
 * auth.uid() on both insert and update so a user can never write someone
 * else's review.
 */
export async function upsertReview(input: {
  partId: string;
  userId: string;
  rating: number;
  body: string | null;
}): Promise<void> {
  if (input.rating < 1 || input.rating > 5) {
    throw new Error('Rating must be between 1 and 5.');
  }
  const { error } = await supabase
    .from('part_reviews')
    .upsert(
      {
        part_id: input.partId,
        user_id: input.userId,
        rating: input.rating,
        body: input.body?.trim() || null,
      },
      { onConflict: 'part_id,user_id' }
    );
  if (error) throw error;
}

/** Remove the caller's review for a part. */
export async function deleteReview(partId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('part_reviews')
    .delete()
    .eq('part_id', partId)
    .eq('user_id', userId);
  if (error) throw error;
}

/**
 * Fire-and-forget: log a click on a part's affiliate URL. user_id is
 * nullable so anon viewers on the public share page get counted too.
 * Errors are swallowed — never let analytics break the user flow.
 */
export async function recordPartClick(
  partId: string,
  userId: string | null
): Promise<void> {
  try {
    await supabase.from('part_clicks').insert({
      part_id: partId,
      user_id: userId,
    });
  } catch (err) {
    console.warn('[reviews] failed to record affiliate click', err);
  }
}
