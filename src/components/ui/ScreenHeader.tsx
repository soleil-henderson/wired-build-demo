import { Text, View } from 'react-native';

import { WiredHeaderTitle } from '@/components/ui/WiredHeaderTitle';

type Props = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
};

/** In-scroll page intro — subtitle only when the stack header already shows the title. */
export function ScreenHeader({ eyebrow, title, subtitle }: Props) {
  if (!eyebrow && !title && !subtitle) return null;

  return (
    <View className="px-4 pb-3 pt-2">
      {eyebrow ? (
        <Text className="text-xs font-semibold uppercase tracking-wider text-apple-secondary">
          {eyebrow}
        </Text>
      ) : null}
      {title ? (
        <WiredHeaderTitle size="screen" className="mt-1 text-apple-ink">
          {title}
        </WiredHeaderTitle>
      ) : null}
      {subtitle ? <Text className="mt-2 text-sm text-apple-secondary">{subtitle}</Text> : null}
    </View>
  );
}
