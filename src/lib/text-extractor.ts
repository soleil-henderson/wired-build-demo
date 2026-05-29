/** Web — on-device OCR not available. */
export function isTextExtractorSupported(): boolean {
  return false;
}

export async function extractTextFromImage(_uri: string): Promise<string[]> {
  return [];
}
