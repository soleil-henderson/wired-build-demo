import { Platform, View } from 'react-native';

type Props = {
  children: React.ReactNode;
};

/**
 * On web/desktop, constrains the app to a phone-width column centered on
 * a gray canvas — prevents hero images and tab chrome from stretching edge-to-edge.
 * Native apps pass children through unchanged.
 */
export function WebAppShell({ children }: Props) {
  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  return (
    <View className="flex-1 items-stretch bg-apple-bg2 md:items-center">
      <View
        className="w-full flex-1 bg-apple-bg2 md:max-w-[430px] lg:max-w-[480px] xl:max-w-[540px] md:border-x md:border-apple-border"
        style={{ flex: 1, ...(Platform.OS === 'web' ? { boxShadow: '0 0 48px rgba(0,0,0,0.06)' } : {}) }}
      >
        {children}
      </View>
    </View>
  );
}
