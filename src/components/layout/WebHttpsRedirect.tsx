import { useEffect, type ReactNode } from 'react';
import { Platform } from 'react-native';

/**
 * Production web must use HTTPS (OAuth, secure cookies, no "Not Secure" warning).
 * Redirects http://wiredbuild.com → https:// same path. Skips localhost.
 */
export function WebHttpsRedirect({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const { protocol, hostname, pathname, search, hash } = window.location;
    if (protocol !== 'http:') return;

    const isLocal =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.endsWith('.local');
    if (isLocal) return;

    window.location.replace(`https://${hostname}${pathname}${search}${hash}`);
  }, []);

  return <>{children}</>;
}
