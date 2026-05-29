import { describe, expect, it } from 'vitest';

import { parseReceiptTotal } from '../receipt-parse';

describe('parseReceiptTotal', () => {
  it('prefers TOTAL line', () => {
    const result = parseReceiptTotal([
      'Subtotal  1200.00',
      'GST  120.00',
      'TOTAL AUD  1320.00',
    ]);
    expect(result).toEqual({ amount: 1320, confidence: 'high' });
  });

  it('parses amount due', () => {
    const result = parseReceiptTotal(['Amount due', '$89.50']);
    expect(result?.amount).toBe(89.5);
  });
});
