import { Platform } from 'react-native';

import { getThemeById, DEFAULT_THEME_ID } from '@/lib/themes/definitions';
import type { ThemeColors } from '@/lib/themes/types';
import type { AppTheme } from '@/lib/themes/types';

/** Mutable color tokens — synced when the user switches themes. */
export const colors: ThemeColors = { ...getThemeById(DEFAULT_THEME_ID).colors };

function syncWebDocumentSurface(bg2: string): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  document.documentElement.style.backgroundColor = bg2;
  document.body.style.backgroundColor = bg2;

  const root = document.getElementById('root');
  if (root) root.style.backgroundColor = bg2;

  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', bg2);
}

export function syncThemeColors(theme: AppTheme): void {
  Object.assign(colors, theme.colors);
  syncWebDocumentSurface(theme.colors.bg2);
}

export const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.04,
  shadowRadius: 3,
  elevation: 2,
} as const;

export const tabBarShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: -1 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 8,
} as const;

/** Space Grotesk stack title styling — synced with WiredHeaderTitle. */
export const wiredNavTitleStyle = {
  fontFamily: 'SpaceGrotesk_700Bold' as const,
  fontSize: 20,
  fontWeight: '700' as const,
  letterSpacing: -0.5,
};

/** Expo Router stack screens — themed chrome matching the home feed header. */
export function getStackScreenOptions() {
  return {
    headerStyle: { backgroundColor: colors.bg2 },
    headerTintColor: colors.ink,
    headerTitleStyle: { ...wiredNavTitleStyle, color: colors.ink },
    headerShadowVisible: false,
    headerBackVisible: false,
    contentStyle: { backgroundColor: colors.bg2 },
    freezeOnBlur: true,
    // Web stack transitions often flash content; instant navigation feels cleaner.
    ...(Platform.OS === 'web' ? { animation: 'none' as const } : {}),
  };
}

/** @deprecated Use getStackScreenOptions() for theme-aware navigation. */
export const stackScreenOptions = getStackScreenOptions();

/** Common input field classes for light screens. */
export const inputClassName =
  'rounded-xl border border-apple-border bg-apple-surface px-4 py-3 text-apple-ink';

/** Screen/card surfaces on the themed background. */
export const screenBgClass = 'bg-apple-bg2';
export const cardBgClass = 'bg-apple-surface border border-apple-border rounded-[18px]';
