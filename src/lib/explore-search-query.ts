export type ExploreSearchMode = 'user' | 'product';

/** `@handle` → user search only; otherwise product/catalogue search only. */
export function parseExploreSearchQuery(raw: string): {
  mode: ExploreSearchMode;
  term: string;
} {
  const trimmed = raw.trim();
  if (trimmed.startsWith('@')) {
    return { mode: 'user', term: trimmed.slice(1).trim() };
  }
  return { mode: 'product', term: trimmed };
}
