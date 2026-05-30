import type { ReactNode } from 'react';
import { Text, type TextStyle } from 'react-native';

/** Space Grotesk title styling — matches the home feed wordmark. */
export const wiredTitleStyle: TextStyle = {
  fontFamily: 'SpaceGrotesk_700Bold',
  letterSpacing: -0.5,
};

type TitleProps = {
  children: ReactNode;
  size?: 'nav' | 'screen' | 'wordmark';
  className?: string;
  numberOfLines?: number;
};

const sizeClass = {
  nav: 'text-[20px]',
  screen: 'text-[22px]',
  wordmark: 'text-[22px]',
} as const;

/** Wired wordmark / screen title text. */
export function WiredHeaderTitle({
  children,
  size = 'screen',
  className = 'text-apple-ink',
  numberOfLines = 1,
}: TitleProps) {
  return (
    <Text
      className={`${sizeClass[size]} ${className}`}
      style={wiredTitleStyle}
      numberOfLines={numberOfLines}
    >
      {children}
    </Text>
  );
}

/** Centered stack navigator title. */
export function WiredStackTitle({ children }: { children: string }) {
  return (
    <WiredHeaderTitle size="nav" numberOfLines={1}>
      {children}
    </WiredHeaderTitle>
  );
}
