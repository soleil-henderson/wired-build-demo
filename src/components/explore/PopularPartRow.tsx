import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';

import { AppleCard } from '@/components/apple/AppleCard';
import type { ExplorePartCard } from '@/lib/explore';
import { formatModCategory } from '@/lib/mod-categories';
import { colors } from '@/lib/theme';

const CATEGORY_TINTS = ['#FFF8E6', '#FFF0E8', '#E8F2FF', '#E8F8EE', '#F3EEFF'];

type Props = {
  part: ExplorePartCard;
  saving: boolean;
  saved: boolean;
  onSave: () => void;
};

export function PopularPartRow({ part, saving, saved, onSave }: Props) {
  const router = useRouter();
  const tint = CATEGORY_TINTS[part.category.length % CATEGORY_TINTS.length];
  const isDiscover = part.source === 'discover';
  const displayName = `${part.brand} ${part.name}`.trim();

  const openPart = () => {
    if (isDiscover && part.product_url) {
      router.push(
        `/product/link?url=${encodeURIComponent(part.product_url)}&name=${encodeURIComponent(displayName)}`
      );
      return;
    }
    router.push(`/part/${part.id}`);
  };

  return (
    <AppleCard style={{ padding: 12 }}>
      <View className="flex-row items-center gap-3">
        <Pressable onPress={openPart} className="active:opacity-85">
          {part.image_url ? (
            <Image
              source={{ uri: part.image_url }}
              style={{
                width: 56,
                height: 56,
                borderRadius: 12,
                backgroundColor: colors.bg2,
              }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 12,
                backgroundColor: tint,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="construct-outline" size={24} color={colors.tertiary} />
            </View>
          )}
        </Pressable>

        <View className="min-w-0 flex-1">
          <Pressable onPress={openPart} className="active:opacity-85">
            <Text className="text-[10px] font-semibold uppercase tracking-wider text-apple-tertiary">
              {isDiscover ? part.store_label ?? 'Web' : formatModCategory(part.category)}
            </Text>
            <Text className="mt-0.5 text-base font-semibold text-apple-ink" numberOfLines={1}>
              {part.brand}
            </Text>
            <Text className="text-sm text-apple-secondary" numberOfLines={2}>
              {part.name}
            </Text>
            <View className="mt-1.5 flex-row items-center justify-between gap-2">
              {part.price_range ? (
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '700',
                    color: '#007AFF',
                    letterSpacing: -0.2,
                  }}
                  numberOfLines={1}
                >
                  {part.price_range}
                </Text>
              ) : (
                <Text className="text-sm text-apple-tertiary">Price on request</Text>
              )}
              {!isDiscover ? (
                <Text className="shrink-0 text-[12px] text-apple-tertiary">
                  {part.install_count} install{part.install_count === 1 ? '' : 's'}
                </Text>
              ) : null}
            </View>
          </Pressable>
        </View>

        <Pressable
          onPress={onSave}
          disabled={saving || saved}
          className={`shrink-0 rounded-xl px-3 py-2 disabled:opacity-60 ${
            saved ? 'bg-apple-bg2' : 'bg-accent-soft active:opacity-80'
          }`}
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Saved to wishlist' : 'Add to wishlist'}
        >
          {saving ? (
            <ActivityIndicator color={colors.accent} size="small" />
          ) : (
            <Text
              className={`text-xs font-semibold ${saved ? 'text-apple-tertiary' : 'text-accent'}`}
            >
              {saved ? 'Saved' : '+ Wishlist'}
            </Text>
          )}
        </Pressable>
      </View>
    </AppleCard>
  );
}
