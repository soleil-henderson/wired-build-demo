import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { NotificationBellButton } from '@/components/NotificationBellButton';
import { colors } from '@/lib/theme';

type Props = {
  title: string;
  notificationCount?: number;
  onNotificationsPress?: () => void;
  onSearchPress?: () => void;
  right?: ReactNode;
};

/** Large sticky-style screen title row — Apple HIG large title pattern. */
export function AppleHeader({
  title,
  notificationCount = 0,
  onNotificationsPress,
  onSearchPress,
  right,
}: Props) {
  return (
    <View className="border-b border-apple-border bg-white px-4 pb-3.5 pt-2">
      <View className="flex-row items-center justify-between">
        <Text
          className="flex-1 text-[28px] font-bold text-apple-ink"
          style={{ letterSpacing: -0.84 }}
        >
          {title}
        </Text>
        <View className="flex-row items-center gap-[18px]">
          {right}
          {onSearchPress ? (
            <Pressable
              onPress={onSearchPress}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Search"
            >
              <Ionicons name="search-outline" size={22} color={colors.ink} />
            </Pressable>
          ) : null}
          {onNotificationsPress ? (
            <NotificationBellButton count={notificationCount} onPress={onNotificationsPress} />
          ) : null}
        </View>
      </View>
    </View>
  );
}
