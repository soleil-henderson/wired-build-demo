import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, View } from 'react-native';
import { vars } from 'nativewind';

import { DEFAULT_THEME_ID, getThemeById, isAppThemeId } from '@/lib/themes/definitions';
import { themeToCssVars } from '@/lib/themes/css-vars';
import type { AppTheme, AppThemeId } from '@/lib/themes/types';
import { syncThemeColors } from '@/lib/theme';

const STORAGE_KEY = 'wired_app_theme_id';

type ThemeContextValue = {
  themeId: AppThemeId;
  theme: AppTheme;
  setThemeId: (id: AppThemeId) => Promise<void>;
  isReady: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

async function loadStoredThemeId(): Promise<AppThemeId> {
  try {
    const stored =
      Platform.OS === 'web' && typeof localStorage !== 'undefined'
        ? localStorage.getItem(STORAGE_KEY)
        : await AsyncStorage.getItem(STORAGE_KEY);
    if (stored && isAppThemeId(stored)) return stored;
  } catch {
    // fall through to default
  }
  return DEFAULT_THEME_ID;
}

async function persistThemeId(id: AppThemeId): Promise<void> {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, id);
    return;
  }
  await AsyncStorage.setItem(STORAGE_KEY, id);
}

function ThemeRoot({ theme, children }: { theme: AppTheme; children: React.ReactNode }) {
  const cssVars = useMemo(() => themeToCssVars(theme), [theme]);
  return (
    <View
      style={[vars(cssVars), { flex: 1, backgroundColor: theme.colors.bg2 }]}
      className="flex-1"
    >
      {children}
    </View>
  );
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState<AppThemeId>(DEFAULT_THEME_ID);

  const theme = useMemo(() => getThemeById(themeId), [themeId]);

  useEffect(() => {
    syncThemeColors(theme);
    void loadStoredThemeId().then((id) => {
      if (id === themeId) return;
      syncThemeColors(getThemeById(id));
      setThemeIdState(id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate stored theme once on mount
  }, []);

  const setThemeId = useCallback(async (id: AppThemeId) => {
    await persistThemeId(id);
    syncThemeColors(getThemeById(id));
    setThemeIdState(id);
  }, []);

  const value = useMemo(
    () => ({ themeId, theme, setThemeId, isReady: true }),
    [themeId, theme, setThemeId]
  );

  return (
    <ThemeContext.Provider value={value}>
      <ThemeRoot theme={theme}>{children}</ThemeRoot>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}

/** Scale a base font size by the active theme's typography scale. */
export function useThemeFontSize(
  base: number,
  role: 'body' | 'caption' | 'heading' | 'title' = 'body'
): number {
  const { theme } = useTheme();
  return Math.round(base * theme.typography.scale[role]);
}
