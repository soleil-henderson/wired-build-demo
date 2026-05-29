/**
 * Prefer thumbnail for lists; fall back to full URL.
 * Thumbnails are set by generate-image-variants or Supabase image transform.
 */
export function displayImageUrl(
  fullUrl: string | null | undefined,
  thumbnailUrl?: string | null
): string | null {
  if (thumbnailUrl) return thumbnailUrl;
  if (!fullUrl) return null;
  return thumbnailUrlForPublicUrl(fullUrl, 800) ?? fullUrl;
}

/** Client-side thumbnail URL for mod-photos bucket (matches Edge Function). */
export function thumbnailUrlForPublicUrl(
  fullUrl: string,
  width = 400
): string | null {
  if (!fullUrl.includes('/storage/v1/object/public/mod-photos/')) {
    return null;
  }
  return `${fullUrl}?width=${width}&quality=75`;
}
