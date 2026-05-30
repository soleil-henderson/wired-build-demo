import { Stack } from 'expo-router';
import { useMemo, type ComponentProps } from 'react';

import { useStackScreenOptions } from '@/lib/stack-options';

type StackComponentProps = ComponentProps<typeof Stack>;

type Props = Omit<StackComponentProps, 'screenOptions'> & {
  screenOptions?: StackComponentProps['screenOptions'];
};

/** Stack navigator that re-themes headers when the user switches appearance. */
export function ThemeStack({ screenOptions, ...rest }: Props) {
  const themed = useStackScreenOptions();
  const merged = useMemo(
    () =>
      typeof screenOptions === 'function'
        ? screenOptions
        : { ...themed, ...screenOptions },
    [themed, screenOptions]
  );

  return <Stack screenOptions={merged} {...rest} />;
}

ThemeStack.Screen = Stack.Screen;
