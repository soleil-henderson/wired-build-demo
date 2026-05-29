import { describe, expect, it } from 'vitest';

import { buildValueFootnote, buildValueLabel } from '../valuation';

describe('valuation', () => {
  it('labels heuristic source', () => {
    expect(buildValueLabel('heuristic')).toBe('Est. value');
    expect(buildValueFootnote('heuristic')).toContain('logged mods');
  });

  it('labels redbook source', () => {
    expect(buildValueLabel('redbook')).toBe('RedBook est.');
  });
});
