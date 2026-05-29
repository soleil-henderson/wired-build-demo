import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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

/**
 * Bell icon with an Apple-style red numeric badge in the top-right corner.
 */
export function NotificationBellButton({ count, onPress, accessibilityLabel }: Props) {
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
      className="h-10 w-10 items-center justify-center rounded-full bg-ink-900 active:bg-ink-800"
    >
      <Ionicons
        name={count > 0 ? 'notifications' : 'notifications-outline'}
        size={22}
        color="#B7BDC8"
      />
      {label ? (
        <View
          style={[
            styles.badge,
            wide ? styles.badgeWide : styles.badgeRound,
            label.length >= 3 ? styles.badgeExtraWide : null,
          ]}
        >
          <Text style={styles.badgeText} numberOfLines={1}>
            {label}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minHeight: 18,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0E1014',
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
