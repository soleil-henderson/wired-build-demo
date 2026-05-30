import { useHeaderHeight } from '@react-navigation/elements';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type KeyboardSafeViewProps = {
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  /** Account for stack header height when computing keyboard offset. */
  offsetHeader?: boolean;
  keyboardVerticalOffset?: number;
};

/** Keeps bottom inputs and buttons above the software keyboard. */
export function KeyboardSafeView({
  children,
  className,
  style,
  offsetHeader = true,
  keyboardVerticalOffset,
}: KeyboardSafeViewProps) {
  const headerHeight = useHeaderHeight();
  const offset =
    keyboardVerticalOffset ?? (offsetHeader && headerHeight > 0 ? headerHeight : 0);

  return (
    <KeyboardAvoidingView
      className={className}
      style={[{ flex: 1 }, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={offset}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

type KeyboardStickyFooterProps = {
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Pins a composer to the bottom and lifts it above the keyboard.
 * Drops home-indicator padding while the keyboard is open so the field
 * sits flush above the keys instead of floating too low.
 */
export function KeyboardStickyFooter({ children, className, style }: KeyboardStickyFooterProps) {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const bottomPad = keyboardVisible ? 6 : Math.max(insets.bottom, 10);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={headerHeight}
    >
      <View className={className} style={[{ paddingBottom: bottomPad }, style]}>
        {children}
      </View>
    </KeyboardAvoidingView>
  );
}

type KeyboardSafeScrollViewProps = ScrollViewProps & {
  offsetHeader?: boolean;
  /** Extra scroll padding at the bottom so submit buttons stay reachable. */
  bottomInset?: boolean;
};

/** Scrollable form wrapper that shifts content when the keyboard opens. */
export function KeyboardSafeScrollView({
  children,
  contentContainerStyle,
  offsetHeader = true,
  bottomInset = true,
  keyboardShouldPersistTaps = 'handled',
  keyboardDismissMode = Platform.OS === 'ios' ? 'interactive' : 'on-drag',
  ...rest
}: KeyboardSafeScrollViewProps) {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const offset =
    offsetHeader && headerHeight > 0 ? headerHeight : 0;
  const bottomPad = bottomInset ? Math.max(insets.bottom, 16) + 32 : 32;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={offset}
    >
      <ScrollView
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        keyboardDismissMode={keyboardDismissMode}
        contentContainerStyle={[{ paddingBottom: bottomPad }, contentContainerStyle]}
        {...rest}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
