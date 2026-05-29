import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

import { cardShadow, colors } from '@/lib/theme';

type Props = ViewProps & {
  children: ReactNode;
  padded?: boolean;
};

/** White card with Apple-style border radius and subtle shadow. */
export function AppleCard({ children, padded = false, style, ...rest }: Props) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: 18,
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
