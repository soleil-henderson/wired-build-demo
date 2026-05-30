import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BottomTabBarHeightCallbackContext } from '@react-navigation/bottom-tabs';
import { useContext } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/lib/theme-context';
import { tabBarShadow } from '@/lib/theme';

const TAB_META: Record<
  string,
  { label: string; icon: keyof typeof Ionicons.glyphMap; iconFocused: keyof typeof Ionicons.glyphMap }
> = {
  index: { label: 'Home', icon: 'home-outline', iconFocused: 'home' },
  explore: { label: 'Explore', icon: 'compass-outline', iconFocused: 'compass' },
  log: { label: 'Log', icon: 'add', iconFocused: 'add' },
  garage: { label: 'Garage', icon: 'car-outline', iconFocused: 'car' },
  profile: { label: 'Profile', icon: 'person-outline', iconFocused: 'person' },
};

export function AppleTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { colors } = theme;
  const onHeightChange = useContext(BottomTabBarHeightCallbackContext);

  return (
    <View
      onLayout={(e) => onHeightChange?.(e.nativeEvent.layout.height)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        backgroundColor: colors.tabBarBg,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, 12),
        paddingHorizontal: 8,
        ...tabBarShadow,
      }}
    >
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const meta = TAB_META[route.name] ?? {
          label: route.name,
          icon: 'ellipse-outline' as const,
          iconFocused: 'ellipse' as const,
        };

        if (route.name === 'log') {
          return (
            <Pressable
              key={route.key}
              onPress={() => navigation.navigate(route.name)}
              accessibilityRole="button"
              accessibilityLabel="Log a mod"
              style={{
                width: 50,
                height: 50,
                borderRadius: 16,
                backgroundColor: colors.accent,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: -12,
                shadowColor: colors.accent,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35,
                shadowRadius: 10,
                elevation: 6,
              }}
            >
              <Ionicons name="add" size={26} color="#FFFFFF" />
            </Pressable>
          );
        }

        const iconName = isFocused ? meta.iconFocused : meta.icon;
        const tint = isFocused ? colors.accent : colors.tertiary;

        return (
          <Pressable
            key={route.key}
            onPress={() => navigation.navigate(route.name)}
            accessibilityRole="button"
            accessibilityState={{ selected: isFocused }}
            accessibilityLabel={meta.label}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 6, gap: 3 }}
          >
            <Ionicons name={iconName} size={24} color={tint} />
            <Text
              style={{
                fontSize: 10,
                fontWeight: '600',
                color: tint,
              }}
            >
              {meta.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
