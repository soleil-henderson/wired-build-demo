import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { NotificationBellButton } from '@/components/NotificationBellButton';
import { WiredHeaderTitle } from '@/components/ui/WiredHeaderTitle';
import { colors } from '@/lib/theme';

type Props = {
  title: string;
  notificationCount?: number;
  onNotificationsPress?: () => void;
  onSearchPress?: () => void;
  right?: ReactNode;
};

/** Tab screen title row — matches the home feed header (bg, font, no divider). */
export function AppleHeader({
  title,
  notificationCount = 0,
  onNotificationsPress,
  onSearchPress,
  right,
}: Props) {
  return (
    <View className="bg-apple-bg2 px-4 pb-2.5 pt-1">
      <View className="h-11 flex-row items-center justify-between">
        <WiredHeaderTitle size="screen" className="flex-1 text-apple-ink">
          {title}
        </WiredHeaderTitle>
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
