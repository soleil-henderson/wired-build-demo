import { Platform } from 'react-native';

/** Marketing site origin (no trailing slash). */
export const DEFAULT_SITE_ORIGIN = 'https://wiredbuild.com';

/** Web app is served under /app on wiredbuild.com; native uses root paths. */
export const WEB_APP_BASE_PATH = '/app';

export function getSiteOrigin(): string {
  return process.env.EXPO_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? DEFAULT_SITE_ORIGIN;
}

/** Path to a route inside the web app (e.g. `/sign-in` → `/app/sign-in`). */
export function webAppPath(route = ''): string {
  const normalized = route.startsWith('/') ? route : route ? `/${route}` : '';
  if (Platform.OS === 'web') {
    return `${WEB_APP_BASE_PATH}${normalized}`;
  }
  return normalized || '/';
}

/** Absolute URL for OAuth / password reset callbacks on web. */
export function webAppAbsoluteUrl(route: string): string {
  return `${getSiteOrigin()}${webAppPath(route)}`;
}

/** Public build share link (short URL at /build/*; Vercel redirects to /app/build/*). */
export function publicBuildUrl(id: string): string {
  return `${getSiteOrigin()}/build/${id}`;
}
