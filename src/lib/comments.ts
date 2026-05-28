import { supabase } from './supabase';
import type { SubscriptionTier } from '@/types/database';

export type CommentWithAuthor = {
  id: string;
  post_id: string;
  parent_comment_id: string | null;
  body: string;
  created_at: string;
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

export async function listComments(postId: string): Promise<CommentWithAuthor[]> {
  const { data, error } = await supabase
    .from('comments')
    .select(
      `
      id, post_id, parent_comment_id, body, created_at,
      author:users!comments_user_id_fkey (
        id, handle, display_name, avatar_url,
        subscription_tier, is_identity_verified, is_workshop
      )
    `
    )
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  type Row = Omit<CommentWithAuthor, 'author'> & {
    author: CommentWithAuthor['author'] | null;
  };

  return ((data ?? []) as Row[])
    .filter((r): r is CommentWithAuthor => r.author !== null);
}

export async function addComment(input: {
  postId: string;
  userId: string;
  body: string;
  parentCommentId?: string | null;
}): Promise<void> {
  const body = input.body.trim();
  if (!body) throw new Error('Empty comment');
  const { error } = await supabase.from('comments').insert({
    post_id: input.postId,
    user_id: input.userId,
    parent_comment_id: input.parentCommentId ?? null,
    body,
  });
  if (error) throw error;
}
