import { Image } from 'expo-image';
import { Text, View, type ViewStyle } from 'react-native';

import { colors } from '@/lib/theme';

type Props = {
  uri: string | null;
  name: string;
  size?: number;
  borderWidth?: number;
  style?: ViewStyle;
};

/** Circular avatar with correct crop + orientation (expo-image respects EXIF). */
export function ProfileAvatar({
  uri,
  name,
  size = 88,
  borderWidth = 3,
  style,
}: Props) {
  const initial = (name || '?')[0].toUpperCase();

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth,
          borderColor: '#FFFFFF',
          backgroundColor: colors.bg2,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={150}
          accessibilityLabel={`${name} profile photo`}
        />
      ) : (
        <View
          style={{
            flex: 1,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: size * 0.34, fontWeight: '700', color: '#fff' }}>
            {initial}
          </Text>
        </View>
      )}
    </View>
  );
}
