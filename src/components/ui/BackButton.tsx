import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { colors } from '@/lib/theme';

type Props = {
  onPress?: () => void;
  color?: string;
};

/** Compact chevron back control for stack headers. */
export function BackButton({ onPress, color = colors.ink }: Props) {
  const router = useRouter();
  return (
    <Pressable
      onPress={onPress ?? (() => router.back())}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      className="-ml-1 h-9 w-9 items-center justify-center rounded-full active:bg-apple-bg2"
    >
      <Ionicons name="chevron-back" size={24} color={color} />
    </Pressable>
  );
}
