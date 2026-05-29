import { describe, expect, it } from 'vitest';

import { extractVinFromBarcode, extractVinFromOcrText, VIN_PATTERN } from '../vin-handoff';

describe('vin-handoff', () => {
  it('extracts VIN from barcode payload', () => {
    expect(extractVinFromBarcode('1HGCM82633A123456')).toBe('1HGCM82633A123456');
  });

  it('extracts VIN from OCR lines with VIN label', () => {
    const lines = ['TOYOTA', 'VIN: 1HGCM82633A123456', 'GXL'];
    expect(extractVinFromOcrText(lines)).toBe('1HGCM82633A123456');
  });

  it('validates VIN pattern', () => {
    expect(VIN_PATTERN.test('1HGCM82633A123456')).toBe(true);
    expect(VIN_PATTERN.test('1HGCM82633A12345I')).toBe(false);
  });
});
