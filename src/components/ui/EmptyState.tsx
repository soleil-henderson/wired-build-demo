import { Pressable, Text, View } from 'react-native';

import { AppleCard } from '@/components/apple/AppleCard';

type Props = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, message, actionLabel, onAction }: Props) {
  return (
    <View className="mx-6 mt-6">
      <AppleCard padded>
        <Text className="text-lg font-semibold text-apple-ink">{title}</Text>
        <Text className="mt-2 text-sm text-apple-secondary">{message}</Text>
        {actionLabel && onAction ? (
          <Pressable
            onPress={onAction}
            className="mt-4 self-start rounded-xl bg-accent px-4 py-2.5 active:opacity-90"
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
          >
            <Text className="font-semibold text-white">{actionLabel}</Text>
          </Pressable>
        ) : null}
      </AppleCard>
    </View>
  );
}
