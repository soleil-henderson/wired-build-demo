/**
 * Lightweight analytics hook — wire PostHog/Amplitude when keys are set.
 */
export function trackEvent(name: string, properties?: Record<string, string | number | boolean>) {
  if (__DEV__) {
    console.log('[analytics]', name, properties);
  }
  const key = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  // PostHog native SDK can be added here without changing call sites.
}
