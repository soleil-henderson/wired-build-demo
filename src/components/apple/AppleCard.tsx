import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/lib/theme-context';
import { cardShadow, colors } from '@/lib/theme';

type Props = ViewProps & {
  children: ReactNode;
  padded?: boolean;
};

/** Themed card with border radius and subtle shadow. */
export function AppleCard({ children, padded = false, style, ...rest }: Props) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: theme.borderRadius.card,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
          ...cardShadow,
        },
        padded ? { padding: 16 } : null,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
