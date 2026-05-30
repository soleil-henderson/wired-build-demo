import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import {
  formatNotificationBadgeCount,
  NotificationBellButton,
} from '@/components/NotificationBellButton';
import { WiredHeaderTitle } from '@/components/ui/WiredHeaderTitle';
import { useTheme } from '@/lib/theme-context';

type Props = {
  notificationCount?: number;
  messageCount?: number;
  onNotificationsPress: () => void;
  onMessagesPress?: () => void;
};

/** Instagram-style home feed header — centered wordmark, activity + DMs on the right. */
export function InstagramHomeHeader({
  notificationCount = 0,
  messageCount = 0,
  onNotificationsPress,
  onMessagesPress,
}: Props) {
  const { theme } = useTheme();
  const iconColor = theme.colors.ink;

  return (
    <View className="bg-apple-bg2 px-4 pb-2.5 pt-1">
      <View className="relative h-11 items-center justify-center">
        <WiredHeaderTitle size="wordmark">Wired</WiredHeaderTitle>
        <View className="absolute bottom-0 right-0 top-0 flex-row items-center gap-[18px]">
          <NotificationBellButton
            count={notificationCount}
            onPress={onNotificationsPress}
          />
          {onMessagesPress ? (
            <MessageIconButton
              count={messageCount}
              onPress={onMessagesPress}
              color={iconColor}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

function MessageIconButton({
  count,
  onPress,
  color,
}: {
  count: number;
  onPress: () => void;
  color: string;
}) {
  const label = formatNotificationBadgeCount(count);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `Messages, ${count} unread` : 'Messages'}
      hitSlop={8}
      className="items-center justify-center active:opacity-70"
    >
      <Ionicons
        name={count > 0 ? 'paper-plane' : 'paper-plane-outline'}
        size={22}
        color={color}
      />
      {label ? (
        <View
          className="absolute -right-2 -top-1 min-h-[18px] items-center justify-center rounded-full bg-signal-red px-1"
          style={{ minWidth: label.length > 1 ? 22 : 18 }}
        >
          <Text className="text-[11px] font-semibold text-white">{label}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
