import { Platform, useWindowDimensions } from 'react-native';

/** Breakpoints aligned with tailwind `md` / `lg` / `xl`. */
export const WEB_BREAKPOINTS = {
  md: 640,
  lg: 1024,
  xl: 1280,
} as const;

export const WEB_MAX_WIDTH = {
  md: 430,
  lg: 480,
  xl: 540,
} as const;

/** Max content width for the centered web column, or undefined on native / narrow web. */
export function useWebContentMaxWidth(): number | undefined {
  const { width } = useWindowDimensions();

  if (Platform.OS !== 'web') return undefined;
  if (width < WEB_BREAKPOINTS.md) return undefined;
  if (width >= WEB_BREAKPOINTS.xl) return WEB_MAX_WIDTH.xl;
  if (width >= WEB_BREAKPOINTS.lg) return WEB_MAX_WIDTH.lg;
  return WEB_MAX_WIDTH.md;
}

export function isWebDesktopLayout(width: number): boolean {
  return Platform.OS === 'web' && width >= WEB_BREAKPOINTS.md;
}
