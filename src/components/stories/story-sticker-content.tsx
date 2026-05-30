import { Text, View } from 'react-native';

import {
  normalizeStoryTextColor,
  normalizeStoryTextStyle,
  resolveStoryTextAppearance,
} from '@/lib/story-text-styles';
import type { StorySticker } from '@/lib/stories';

const BASE_EMOJI_SIZE = 42;

export function StoryStickerContent({ sticker }: { sticker: StorySticker }) {
  if (sticker.kind === 'emoji') {
    return <Text style={{ fontSize: BASE_EMOJI_SIZE }}>{sticker.content}</Text>;
  }

  const styleName = normalizeStoryTextStyle(sticker.text_style);
  const colorId = normalizeStoryTextColor(sticker.text_color);
  const { textStyle, containerStyle } = resolveStoryTextAppearance(styleName, colorId);

  const text =
    styleName === 'neon' ? (
      <View className="max-w-[300px] items-center">
        <Text
          className="absolute text-center"
          style={[
            textStyle,
            {
              color: 'transparent',
              textShadowColor: textStyle.color,
              textShadowRadius: 14,
            },
          ]}
        >
          {sticker.content}
        </Text>
        <Text className="text-center" style={textStyle}>
          {sticker.content}
        </Text>
      </View>
    ) : (
      <Text className="max-w-[300px] text-center" style={textStyle}>
        {sticker.content}
      </Text>
    );

  if (containerStyle) {
    return <View style={containerStyle}>{text}</View>;
  }

  return text;
}
