import type { Router } from 'expo-router';

type ModProductTarget = {
  id: string;
  part?: { id: string } | null;
};

/** Navigate to a tool product page from a mod_tools row. */
export function navigateToModTool(router: Router, toolId: string) {
  if (!toolId) return;
  router.push(`/product/tool/${toolId}`);
}

/** Navigate to the canonical product page for a mod (catalogue part or custom link). */
export function navigateToModProduct(router: Router, mod: ModProductTarget | null | undefined) {
  if (!mod) return;
  if (mod.part?.id) {
    router.push(`/part/${mod.part.id}`);
    return;
  }
  router.push(`/product/mod/${mod.id}`);
}

/** Navigate to a standalone product link (extras on a mod, pasted URLs). */
export function navigateToProductLink(
  router: Router,
  link: { url: string; name?: string | null }
) {
  const url = link.url.trim();
  if (!url) return;
  router.push({
    pathname: '/product/link',
    params: {
      url,
      name: link.name?.trim() || url,
    },
  });
}
