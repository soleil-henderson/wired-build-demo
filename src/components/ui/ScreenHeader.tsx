import { Text, View } from 'react-native';

type Props = {
  eyebrow: string;
  title: string;
  subtitle?: string;
};

/** Consistent screen hero used across profile, explore, garage flows. */
export function ScreenHeader({ eyebrow, title, subtitle }: Props) {
  return (
    <View className="px-6 pt-6">
      <Text className="font-display text-xs font-semibold tracking-[3px] text-accent">
        {eyebrow}
      </Text>
      <Text className="font-display mt-1 text-3xl font-bold text-apple-ink">{title}</Text>
      {subtitle ? <Text className="mt-2 text-apple-secondary">{subtitle}</Text> : null}
    </View>
  );
}
