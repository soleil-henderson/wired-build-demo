import { Pressable, Text, View } from 'react-native';

import { cardShadow, colors } from '@/lib/theme';

type Option<T extends string> = { id: T; label: string };

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

/** iOS-style segmented control — gray track, white selected pill. */
export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.bg2,
        borderRadius: 12,
        padding: 3,
      }}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <Pressable
            key={opt.id}
            onPress={() => onChange(opt.id)}
            style={{
              flex: 1,
              paddingVertical: 8,
              paddingHorizontal: 4,
              borderRadius: 9,
              backgroundColor: active ? colors.surface : 'transparent',
              ...(active ? cardShadow : {}),
            }}
          >
            <Text
              style={{
                textAlign: 'center',
                fontSize: 14,
                fontWeight: '600',
                color: active ? colors.ink : colors.secondary,
                letterSpacing: -0.14,
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
