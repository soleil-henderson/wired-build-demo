import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';

import { StoryStickerContent } from '@/components/stories/story-sticker-content';
import type { StorySticker } from '@/lib/stories';

type Props = {
  stickers?: StorySticker[];
  onLayout?: (size: { width: number; height: number }) => void;
};

function PositionedSticker({
  sticker,
  containerWidth,
  containerHeight,
}: {
  sticker: StorySticker;
  containerWidth: number;
  containerHeight: number;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: sticker.x * containerWidth - size.width / 2,
        top: sticker.y * containerHeight - size.height / 2,
        transform: [{ scale: sticker.scale }, { rotate: `${sticker.rotation}deg` }],
      }}
      onLayout={(e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        if (width !== size.width || height !== size.height) {
          setSize({ width, height });
        }
      }}
    >
      <StoryStickerContent sticker={sticker} />
    </View>
  );
}

export function StoryOverlays({ stickers = [], onLayout }: Props) {
  const [container, setContainer] = useState({ width: 0, height: 0 });

  return (
    <View
      pointerEvents="none"
      className="absolute inset-0"
      onLayout={(event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout;
        setContainer({ width, height });
        onLayout?.({ width, height });
      }}
    >
      {container.width > 0
        ? stickers.map((sticker) => (
            <PositionedSticker
              key={sticker.id}
              sticker={sticker}
              containerWidth={container.width}
              containerHeight={container.height}
            />
          ))
        : null}
    </View>
  );
}
