import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Linking, Pressable, Text, View } from 'react-native';

import {
  type ModProductLink,
  type ModProductLinks,
} from '@/lib/mod-products';
import { navigateToModProduct, navigateToProductLink } from '@/lib/product-nav';
import { colors } from '@/lib/theme';

import { ShoppingAlternativesList } from './ProductUrlResolver';

type DisplayProps = {
  links: ModProductLinks | null;
  /** When true, primary link is shown elsewhere (e.g. ShopProductButton). */
  hidePrimary?: boolean;
  modId?: string;
};

export function ModProductLinksDisplay({ links, hidePrimary = false, modId }: DisplayProps) {
  const router = useRouter();
  const hasExtras = (links?.extras.length ?? 0) > 0;
  const hasShopping =
    (links?.shopping?.length ?? 0) > 0 || !!links?.shopping_search_url;
  const hasPrimary = !hidePrimary && !!links?.primary?.url;

  if (!links || (!hasPrimary && !hasExtras && !hasShopping)) {
    return null;
  }

  return (
    <View className="mt-3 gap-2">
      {(hasPrimary || hasExtras) ? (
        <>
          <Text className="text-xs font-semibold uppercase tracking-wider text-apple-secondary">
            {hasExtras ? 'Other products used' : 'Products used'}
          </Text>
          {hasPrimary && links.primary ? (
            <ProductRow
              link={links.primary}
              primary
              onPress={() => {
                if (modId) navigateToModProduct(router, { id: modId });
                else navigateToProductLink(router, links.primary!);
              }}
            />
          ) : null}
          {links.extras.map((link, i) => (
            <ProductRow
              key={i}
              link={link}
              onPress={() => navigateToProductLink(router, link)}
            />
          ))}
        </>
      ) : null}
      {(links.shopping?.length ?? 0) > 0 ? (
        <ShoppingAlternativesList offers={links.shopping!} />
      ) : links.shopping_search_url ? (
        <Pressable
          onPress={() => Linking.openURL(links.shopping_search_url!)}
          className="flex-row items-center gap-2 rounded-xl border border-apple-border bg-apple-bg2 p-3"
        >
          <Ionicons name="logo-google" size={16} color={colors.blue} />
          <Text className="text-sm font-semibold text-signal-blue">
            Compare on Google Shopping
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ProductRow({
  link,
  primary,
  onPress,
}: {
  link: ModProductLink;
  primary?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress ?? (() => Linking.openURL(link.url))}
      className="flex-row items-start gap-3 rounded-xl border border-apple-border bg-apple-bg2 p-3 active:opacity-80"
    >
      <View className="mt-0.5 h-8 w-8 items-center justify-center rounded-lg bg-white">
        <Ionicons
          name={primary ? 'link' : 'cube-outline'}
          size={16}
          color={colors.accent}
        />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-semibold text-apple-ink">{link.name}</Text>
        {link.purpose ? (
          <Text className="mt-0.5 text-xs text-apple-secondary">{link.purpose}</Text>
        ) : null}
        <Text className="mt-1 text-xs text-signal-blue" numberOfLines={1}>
          {link.url}
        </Text>
      </View>
      <Ionicons name="open-outline" size={16} color={colors.tertiary} />
    </Pressable>
  );
}
