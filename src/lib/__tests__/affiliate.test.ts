import { describe, expect, it } from 'vitest';

import { extractAffiliate } from '../affiliate';

describe('extractAffiliate', () => {
  it('reads flat url + label', () => {
    expect(
      extractAffiliate({ url: 'https://example.com/buy', label: 'Shop' })
    ).toEqual({ url: 'https://example.com/buy', label: 'Shop' });
  });

  it('prefers member_url when memberRates is true', () => {
    expect(
      extractAffiliate(
        { url: 'https://example.com/std', member_url: 'https://example.com/member' },
        { memberRates: true }
      )
    ).toEqual({ url: 'https://example.com/member' });
  });

  it('reads region-specific links', () => {
    expect(
      extractAffiliate(
        {
          regions: {
            au: { url: 'https://au.example.com', label: 'AU' },
            us: { url: 'https://us.example.com' },
          },
        },
        { region: 'us' }
      )
    ).toEqual({ url: 'https://us.example.com' });
  });
});
