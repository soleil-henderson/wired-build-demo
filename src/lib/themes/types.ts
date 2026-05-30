export type AppThemeId =
  | 'wired-original'
  | 'off-road'
  | 'track'
  | 'jdm'
  | 'muscle'
  | 'euro'
  | 'race';

export type ThemeColors = {
  bg: string;
  bg2: string;
  surface: string;
  surfaceSubtle: string;
  border: string;
  borderStrong: string;
  ink: string;
  secondary: string;
  tertiary: string;
  accent: string;
  accentSoft: string;
  accentDark: string;
  accentLight: string;
  blue: string;
  blueSoft: string;
  green: string;
  greenSoft: string;
  amber: string;
  amberSoft: string;
  purple: string;
  red: string;
  tabBarBg: string;
};

export type AppTheme = {
  id: AppThemeId;
  name: string;
  tagline: string;
  emoji: string;
  colors: ThemeColors;
  statusBar: 'light' | 'dark';
  borderRadius: { card: number; button: number };
  typography: {
    scale: { body: number; caption: number; heading: number; title: number };
    letterSpacing: { body: number; heading: number };
    displayFont: boolean;
  };
};
