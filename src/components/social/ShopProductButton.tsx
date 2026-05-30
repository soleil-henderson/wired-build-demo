import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, Text, View } from 'react-native';

import { colors } from '@/lib/theme';

type Props = {
  url: string;
  label?: string;
  subtitle?: string;
  compact?: boolean;
};

/** Prominent CTA to open the product purchase link. */
export function ShopProductButton({
  url,
  label = 'Shop this product',
  subtitle,
  compact = false,
}: Props) {
  return (
    <Pressable
      onPress={() => Linking.openURL(url)}
      accessibilityRole="link"
      accessibilityLabel={label}
      className={`flex-row items-center justify-center gap-2 rounded-xl bg-accent active:opacity-90 ${
        compact ? 'px-4 py-2' : 'px-5 py-3'
      }`}
    >
      <Ionicons name="cart-outline" size={compact ? 16 : 18} color="#fff" />
      <View className="min-w-0 flex-shrink items-center">
        <Text className={`font-semibold text-white ${compact ? 'text-sm' : 'text-[15px]'}`}>
          {label}
        </Text>
        {subtitle && !compact ? (
          <Text className="mt-0.5 text-center text-xs text-white/85" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Ionicons name="open-outline" size={compact ? 14 : 16} color="#fff" />
    </Pressable>
  );
}

/** Inline shop chip for feed cards. */
export function ShopProductChip({ url, label = 'Shop' }: { url: string; label?: string }) {
  return (
    <Pressable
      onPress={() => Linking.openURL(url)}
      className="flex-row items-center gap-1 rounded-lg bg-accent-soft px-2.5 py-1.5 active:opacity-80"
    >
      <Ionicons name="cart-outline" size={14} color={colors.accent} />
      <Text className="text-xs font-semibold text-accent">{label}</Text>
    </Pressable>
  );
}
