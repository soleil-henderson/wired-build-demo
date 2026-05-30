import type { AppTheme } from '@/lib/themes/types';

/** NativeWind CSS variable map for runtime theme switching. */
export function themeToCssVars(theme: AppTheme): Record<string, string> {
  const c = theme.colors;
  return {
    '--apple-bg': c.bg,
    '--apple-bg2': c.bg2,
    '--apple-surface': c.surface,
    '--apple-border': c.border,
    '--apple-border-strong': c.borderStrong,
    '--apple-ink': c.ink,
    '--apple-secondary': c.secondary,
    '--apple-tertiary': c.tertiary,
    '--accent': c.accent,
    '--accent-soft': c.accentSoft,
    '--accent-dark': c.accentDark,
    '--accent-light': c.accentLight,
    '--signal-green': c.green,
    '--signal-red': c.red,
    '--signal-blue': c.blue,
    '--signal-amber': c.amber,
    '--signal-purple': c.purple,
  };
}
