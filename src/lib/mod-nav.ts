import type { Router } from 'expo-router';

/** Open the full mod detail screen (install info, photos, edit). */
export function navigateToModDetail(router: Router, modId: string | null | undefined) {
  if (!modId) return;
  router.push(`/mod/${modId}`);
}
