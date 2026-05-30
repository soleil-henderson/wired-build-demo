import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/lib/theme-context';

/** iOS-style app badge label (caps at 99+). */
export function formatNotificationBadgeCount(count: number): string {
  if (count <= 0) return '';
  return count > 99 ? '99+' : String(count);
}

type Props = {
  count: number;
  onPress: () => void;
  accessibilityLabel?: string;
};

/** Bell icon with an Apple-style red numeric badge. */
export function NotificationBellButton({ count, onPress, accessibilityLabel }: Props) {
  const { theme } = useTheme();
  const { colors } = theme;
  const label = formatNotificationBadgeCount(count);
  const wide = label.length > 1;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ??
        (count > 0 ? `Notifications, ${count} unread` : 'Notifications')
      }
      hitSlop={8}
      className="items-center justify-center active:opacity-70"
    >
      <Ionicons
        name={count > 0 ? 'notifications' : 'notifications-outline'}
        size={22}
        color={colors.ink}
      />
      {label ? (
        <View
          style={[
            styles.badge,
            wide ? styles.badgeWide : styles.badgeRound,
            label.length >= 3 ? styles.badgeExtraWide : null,
            { backgroundColor: colors.red, borderColor: colors.bg2 },
          ]}
        >
          <Text style={styles.badgeText} numberOfLines={1}>
            {label}
          </Text>
        </View>
      ) : count > 0 ? (
        <View style={[styles.dot, { backgroundColor: colors.red, borderColor: colors.bg2 }]} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
    top: 0,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minHeight: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  badgeRound: {
    minWidth: 18,
    width: 18,
    borderRadius: 9,
    paddingHorizontal: 0,
  },
  badgeWide: {
    minWidth: 22,
    borderRadius: 9,
    paddingHorizontal: 5,
  },
  badgeExtraWide: {
    minWidth: 28,
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 13,
    includeFontPadding: false,
    textAlign: 'center',
  },
});
