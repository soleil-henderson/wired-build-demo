import { extractTextFromImage, isSupported } from 'expo-text-extractor';

import { parseReceiptTotal, type ParsedReceiptTotal } from './receipt-parse';

/**
 * On-device OCR for a receipt image, then heuristic total extraction.
 * Returns null when unsupported (web / missing native module) or when
 * nothing plausible is found — callers should fail open to manual entry.
 */
export async function extractReceiptCostFromImage(
  uri: string
): Promise<ParsedReceiptTotal | null> {
  if (!isSupported) return null;

  try {
    const lines = await extractTextFromImage(uri);
    if (!lines.length) return null;
    return parseReceiptTotal(lines);
  } catch {
    return null;
  }
}
