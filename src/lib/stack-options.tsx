import { useMemo } from 'react';

import { BackButton } from '@/components/ui/BackButton';
import { WiredStackTitle } from '@/components/ui/WiredHeaderTitle';
import { useTheme } from '@/lib/theme-context';
import { getStackScreenOptions, wiredNavTitleStyle } from '@/lib/theme';

/** Stack navigator defaults with compact back chevron and Wired titles. */
export function useStackScreenOptions() {
  const { themeId, theme } = useTheme();
  return useMemo(
    () => ({
      ...getStackScreenOptions(),
      headerStyle: { backgroundColor: theme.colors.bg2 },
      headerTintColor: theme.colors.ink,
      headerTitleStyle: { ...wiredNavTitleStyle, color: theme.colors.ink },
      contentStyle: { backgroundColor: theme.colors.bg2 },
      headerTitle: ({ children }: { children: string }) => (
        <WiredStackTitle>{children}</WiredStackTitle>
      ),
      headerLeft: ({ canGoBack }: { canGoBack?: boolean }) =>
        canGoBack ? <BackButton /> : null,
    }),
    [themeId, theme.colors.bg2, theme.colors.ink]
  );
}

/** Static fallback — prefer useStackScreenOptions inside navigators. */
export const stackScreenOptions = {
  ...getStackScreenOptions(),
  headerTitle: ({ children }: { children: string }) => (
    <WiredStackTitle>{children}</WiredStackTitle>
  ),
  headerLeft: ({ canGoBack }: { canGoBack?: boolean }) =>
    canGoBack ? <BackButton /> : null,
};
