/** Apple-inspired design tokens (matches wired_build_demo.jsx reference). */
export const colors = {
  bg: '#FFFFFF',
  bg2: '#F5F5F7',
  surface: '#FFFFFF',
  surfaceSubtle: '#FBFBFD',
  border: '#E8E8ED',
  borderStrong: '#D2D2D7',
  ink: '#1D1D1F',
  secondary: '#6E6E73',
  tertiary: '#A1A1A6',
  accent: '#FF6A2B',
  accentSoft: '#FFF1EA',
  blue: '#0071E3',
  blueSoft: '#E8F1FD',
  green: '#34C759',
  greenSoft: '#E8F8EC',
  amber: '#FF9F0A',
  amberSoft: '#FFF6E5',
  purple: '#AF52DE',
  red: '#FF3B30',
} as const;

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

/** Expo Router stack screens — Apple light chrome. */
export const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.bg },
  headerTintColor: colors.blue,
  headerTitleStyle: { color: colors.ink, fontWeight: '600' as const },
  headerShadowVisible: true,
  contentStyle: { backgroundColor: colors.bg2 },
} as const;

/** Common input field classes for light screens. */
export const inputClassName =
  'rounded-xl border border-apple-border bg-white px-4 py-3 text-apple-ink';

export const inputPlaceholderColor = colors.tertiary;

/** Screen/card surfaces on the light background. */
export const screenBgClass = 'bg-apple-bg2';
export const cardBgClass = 'bg-white border border-apple-border rounded-[18px]';
