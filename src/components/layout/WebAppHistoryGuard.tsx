import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { WEB_APP_BASE_PATH } from '@/lib/site-url';

const LAST_APP_PATH_KEY = 'wb_web_last_app_path';

function isAppWebPath(pathname: string): boolean {
  return pathname === WEB_APP_BASE_PATH || pathname.startsWith(`${WEB_APP_BASE_PATH}/`);
}

/** Map `/app/sign-in` → `/(auth)/sign-in` for expo-router. */
function expoRouteFromWebPath(webPath: string): string {
  const pathOnly = webPath.split('?')[0]?.split('#')[0] ?? webPath;
  const stripped = pathOnly.replace(new RegExp(`^${WEB_APP_BASE_PATH}/?`), '');
  if (!stripped) return '/(tabs)';

  const authRoots = new Set([
    'sign-in',
    'sign-up',
    'onboarding',
    'onboarding-workshop',
    'forgot-password',
    'verify-email',
  ]);
  if (authRoots.has(stripped)) return `/(auth)/${stripped}`;

  return stripped.startsWith('/') ? stripped : `/${stripped}`;
}

/**
 * Web only: keep the user inside `/app` — block browser / trackpad back to the
 * marketing landing page once they've entered the app.
 */
export function WebAppHistoryGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const historySeeded = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (!isAppWebPath(window.location.pathname)) return;

    const fullPath =
      window.location.pathname + window.location.search + window.location.hash;
    sessionStorage.setItem(LAST_APP_PATH_KEY, fullPath);

    if (!historySeeded.current) {
      historySeeded.current = true;
      window.history.replaceState({ wbInApp: true }, '', fullPath);
      window.history.pushState({ wbInApp: true }, '', fullPath);
    }
  }, [pathname]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const onPopState = () => {
      if (isAppWebPath(window.location.pathname)) return;

      const restore =
        sessionStorage.getItem(LAST_APP_PATH_KEY) ?? WEB_APP_BASE_PATH;
      window.history.pushState({ wbInApp: true }, '', restore);
      router.replace(expoRouteFromWebPath(restore) as never);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [router]);

  return null;
}
