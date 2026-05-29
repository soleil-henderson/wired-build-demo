import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { colors } from '@/lib/theme';

const CATEGORY_COLORS = [
  colors.accent,
  colors.amber,
  colors.green,
  colors.blue,
  colors.purple,
  '#FF2D55',
  '#5AC8FA',
];

export function categoryColor(index: number): string {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

export function AppleChip({
  children,
  color = colors.secondary,
  bg = colors.bg2,
}: {
  children: React.ReactNode;
  color?: string;
  bg?: string;
}) {
  return (
    <View
      style={{
        backgroundColor: bg,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 100,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: '600', color, letterSpacing: -0.12 }}>
        {children}
      </Text>
    </View>
  );
}

export function GradientAvatar({
  initials,
  size = 40,
  color = colors.accent,
}: {
  initials: string;
  size?: number;
  color?: string;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.36, fontWeight: '600', color: '#fff' }}>
        {initials}
      </Text>
    </View>
  );
}

export function MoneyText({
  value,
  size = 17,
  color = colors.ink,
  weight = '600' as const,
}: {
  value: number;
  size?: number;
  color?: string;
  weight?: '600' | '700';
}) {
  return (
    <Text
      style={{
        fontSize: size,
        fontWeight: weight,
        color,
        letterSpacing: -0.34,
        fontVariant: ['tabular-nums'],
      }}
    >
      ${value.toLocaleString()}
    </Text>
  );
}

export function VehicleThumb({
  size = 56,
  color = colors.accent,
}: {
  size?: number;
  color?: string;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 14,
        backgroundColor: `${color}18`,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name="car-sport-outline" size={size * 0.45} color={color} />
    </View>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        fontSize: 13,
        fontWeight: '600',
        color: colors.secondary,
        letterSpacing: -0.13,
        marginBottom: 10,
      }}
    >
      {children}
    </Text>
  );
}

export function VerifiedLabel({ size = 14 }: { size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name="checkmark-circle" size={size} color={colors.green} />
      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.green }}>Verified</Text>
    </View>
  );
}
