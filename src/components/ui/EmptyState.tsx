import { Pressable, Text, View } from 'react-native';

type Props = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, message, actionLabel, onAction }: Props) {
  return (
    <View className="mx-6 mt-6 rounded-2xl border border-ink-700 bg-ink-900 p-6">
      <Text className="text-lg font-semibold text-white">{title}</Text>
      <Text className="mt-2 text-sm text-ink-300">{message}</Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          className="mt-4 self-start rounded-xl bg-accent px-4 py-2.5"
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text className="font-semibold text-ink-950">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
