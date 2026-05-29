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
      <Text className="font-display text-accent text-xs font-semibold tracking-[3px]">
        {eyebrow}
      </Text>
      <Text className="font-display mt-1 text-3xl font-bold text-white">{title}</Text>
      {subtitle ? <Text className="mt-2 text-ink-300">{subtitle}</Text> : null}
    </View>
  );
}
