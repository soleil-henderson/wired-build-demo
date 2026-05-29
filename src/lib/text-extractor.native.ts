import Constants from 'expo-constants';

/** Expo Go does not ship the ExpoTextExtractor native module. */
function availableInThisBuild(): boolean {
  return Constants.appOwnership !== 'expo';
}

export function isTextExtractorSupported(): boolean {
  return availableInThisBuild();
}

export async function extractTextFromImage(uri: string): Promise<string[]> {
  if (!availableInThisBuild()) return [];

  try {
    const { extractTextFromImage: extract, isSupported } = await import(
      'expo-text-extractor'
    );
    if (!isSupported) return [];
    return extract(uri);
  } catch {
    return [];
  }
}
