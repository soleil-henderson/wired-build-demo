import { parseReceiptTotal, type ParsedReceiptTotal } from './receipt-parse';
import { extractTextFromImage, isTextExtractorSupported } from './text-extractor';

/**
 * On-device OCR for a receipt image, then heuristic total extraction.
 * Returns null when unsupported (web / Expo Go / missing native module) or when
 * nothing plausible is found — callers should fail open to manual entry.
 */
export async function extractReceiptCostFromImage(
  uri: string
): Promise<ParsedReceiptTotal | null> {
  if (!isTextExtractorSupported()) return null;

  try {
    const lines = await extractTextFromImage(uri);
    if (!lines.length) return null;
    return parseReceiptTotal(lines);
  } catch {
    return null;
  }
}
