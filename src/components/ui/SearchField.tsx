import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { TextInput, View, type TextStyle } from 'react-native';

import { colors } from '@/lib/theme';

/** TextInput style without text shadow (avoids placeholder "glow" on iOS). */
export function plainTextInputStyle(extra?: TextStyle): TextStyle {
  return {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    color: colors.ink,
    paddingVertical: 0,
    textShadowRadius: 0,
    textShadowOffset: { width: 0, height: 0 },
    textShadowColor: 'transparent',
    ...extra,
  };
}

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  trailing?: ReactNode;
};

/** Flat search row — no card shadow (shadow + TextInput causes blurry placeholder). */
export function SearchField({ value, onChangeText, placeholder, trailing }: Props) {
  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-apple-border bg-apple-surface px-4 py-3">
      <Ionicons name="search" size={20} color={colors.tertiary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.tertiary}
        autoCapitalize="none"
        autoCorrect={false}
        underlineColorAndroid="transparent"
        style={plainTextInputStyle()}
      />
      {trailing}
    </View>
  );
}
