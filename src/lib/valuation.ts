/** How `vehicles.build_value` was produced (migration 16). */
export type ValuationSource = 'heuristic' | 'redbook' | 'kbb';

export function buildValueFootnote(
  source: ValuationSource | string | null | undefined
): string {
  switch (source) {
    case 'redbook':
      return 'Valuation from RedBook — indicative only, not a formal appraisal.';
    case 'kbb':
      return 'Valuation from Kelley Blue Book — indicative only, not a formal appraisal.';
    case 'heuristic':
    default:
      return 'Estimated from your logged mods — not a formal appraisal.';
  }
}

export function buildValueLabel(
  source: ValuationSource | string | null | undefined
): string {
  switch (source) {
    case 'redbook':
      return 'RedBook est.';
    case 'kbb':
      return 'KBB est.';
    default:
      return 'Est. value';
  }
}
