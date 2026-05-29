import { extractTextFromImage, isTextExtractorSupported } from './text-extractor';
import { extractVinFromOcrText } from './vin-handoff';

/**
 * On-device OCR for a door-jamb / windshield sticker when the barcode
 * cannot be read. Fails open (returns null) on web, Expo Go, or unsupported devices.
 */
export async function extractVinFromImage(uri: string): Promise<string | null> {
  if (!isTextExtractorSupported()) return null;

  try {
    const lines = await extractTextFromImage(uri);
    if (!lines.length) return null;
    return extractVinFromOcrText(lines);
  } catch {
    return null;
  }
}
