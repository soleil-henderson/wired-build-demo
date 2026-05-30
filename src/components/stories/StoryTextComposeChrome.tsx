import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import {
  STORY_TEXT_COLORS,
  nextStoryTextStyle,
  resolveStoryTextAppearance,
  storyTextStyleLabel,
  type StoryTextColorId,
  type StoryTextStyleName,
} from '@/lib/story-text-styles';

type Props = {
  draft: string;
  styleName: StoryTextStyleName;
  colorId: StoryTextColorId;
  onDraftChange: (value: string) => void;
  onStyleChange: (style: StoryTextStyleName) => void;
  onColorChange: (color: StoryTextColorId) => void;
};

export function StoryTextComposeChrome({
  draft,
  styleName,
  colorId,
  onDraftChange,
  onStyleChange,
  onColorChange,
}: Props) {
  const appearance = resolveStoryTextAppearance(styleName, colorId);

  return (
    <View className="flex-1">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
        className="max-h-14"
      >
        {STORY_TEXT_COLORS.map((color) => {
          const selected = color.id === colorId;
          const isLight = color.id === 'white' || color.id === 'yellow' || color.id === 'cyan';
          return (
            <Pressable
              key={color.id}
              onPress={() => onColorChange(color.id)}
              className="mr-3 items-center justify-center active:opacity-80"
              hitSlop={6}
            >
              <View
                className={`h-9 w-9 rounded-full ${selected ? 'border-2 border-white' : 'border border-white/25'}`}
                style={{ backgroundColor: color.hex }}
              />
              {isLight && !selected ? (
                <View
                  pointerEvents="none"
                  className="absolute h-9 w-9 rounded-full border border-black/15"
                />
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <View className="flex-1 items-center justify-center px-6">
        <Pressable
          onPress={() => onStyleChange(nextStoryTextStyle(styleName))}
          className="w-full items-center active:opacity-90"
        >
          {appearance.containerStyle ? (
            <View style={appearance.containerStyle}>
              <TextInput
                value={draft}
                onChangeText={onDraftChange}
                placeholder="Type something…"
                placeholderTextColor={appearance.placeholderColor}
                autoFocus
                multiline
                maxLength={120}
                style={[appearance.textStyle, { minHeight: 48, maxWidth: 280 }]}
              />
            </View>
          ) : (
            <TextInput
              value={draft}
              onChangeText={onDraftChange}
              placeholder="Type something…"
              placeholderTextColor={appearance.placeholderColor}
              autoFocus
              multiline
              maxLength={120}
              style={[appearance.textStyle, { minHeight: 48, width: '100%', maxWidth: 300 }]}
            />
          )}
          <Text className="mt-4 text-sm font-medium text-white/55">
            Tap text for {storyTextStyleLabel(nextStoryTextStyle(styleName))}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
