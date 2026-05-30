import { Share } from 'react-native';

import { publicBuildUrl } from './site-url';

export function publicBuildShareMessage(title: string): string {
  return `Check out this build on Wired Build: ${title}`;
}

/**
 * Share a public build link.
 * Keep the URL out of the visible sentence — iOS shows a rich preview from the
 * link on the next line. Do not pass a separate `url` field; RN duplicates it in the body.
 */
export async function sharePublicBuild(vehicleId: string, title: string): Promise<void> {
  const url = publicBuildUrl(vehicleId);
  const message = publicBuildShareMessage(title);

  try {
    await Share.share({
      message: `${message}\n${url}`,
      title,
    });
  } catch {
    // User dismissed the sheet.
  }
}
