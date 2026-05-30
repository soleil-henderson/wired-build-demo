import { describe, expect, it } from 'vitest';

import { parseExploreSearchQuery } from '../explore-search-query';

describe('parseExploreSearchQuery', () => {
  it('routes @prefix to user search', () => {
    expect(parseExploreSearchQuery('@jdm_garage')).toEqual({
      mode: 'user',
      term: 'jdm_garage',
    });
  });

  it('strips leading @ and whitespace for handles', () => {
    expect(parseExploreSearchQuery('  @  turbo_shop  ')).toEqual({
      mode: 'user',
      term: 'turbo_shop',
    });
  });

  it('treats plain text as product search', () => {
    expect(parseExploreSearchQuery('coilovers')).toEqual({
      mode: 'product',
      term: 'coilovers',
    });
  });

  it('does not treat @ in the middle as user search', () => {
    expect(parseExploreSearchQuery('brand@store')).toEqual({
      mode: 'product',
      term: 'brand@store',
    });
  });

  it('supports single-character handles after @', () => {
    expect(parseExploreSearchQuery('@x')).toEqual({
      mode: 'user',
      term: 'x',
    });
  });
});
