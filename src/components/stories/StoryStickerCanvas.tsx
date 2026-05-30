import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { StoryStickerContent } from '@/components/stories/story-sticker-content';
import { StoryTextComposeChrome } from '@/components/stories/StoryTextComposeChrome';
import type { StorySticker } from '@/lib/stories';
import {
  normalizeStoryTextColor,
  normalizeStoryTextStyle,
  type StoryTextColorId,
  type StoryTextStyleName,
} from '@/lib/story-text-styles';

const MIN_SCALE = 0.35;
const MAX_SCALE = 4;

type CanvasSize = { width: number; height: number };

type Props = {
  stickers: StorySticker[];
  onStickersChange: (stickers: StorySticker[]) => void;
  textComposeActive: boolean;
  textDraft: string;
  textStyle: StoryTextStyleName;
  textColor: StoryTextColorId;
  onTextDraftChange: (value: string) => void;
  onTextStyleChange: (style: StoryTextStyleName) => void;
  onTextColorChange: (color: StoryTextColorId) => void;
  onTextComposeDone: () => void;
  onTextComposeCancel: () => void;
  editingStickerId: string | null;
  onEditingStickerIdChange: (id: string | null) => void;
  onSelectionChange?: (id: string | null) => void;
};

function clamp01(value: number, margin = 0.05) {
  'worklet';
  return Math.min(1 - margin, Math.max(margin, value));
}

function clampScale(value: number) {
  'worklet';
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

type DraggableProps = {
  sticker: StorySticker;
  canvasWidth: SharedValue<number>;
  canvasHeight: SharedValue<number>;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (patch: Partial<StorySticker>) => void;
  onEditText: () => void;
};

function DraggableSticker({
  sticker,
  canvasWidth,
  canvasHeight,
  selected,
  onSelect,
  onUpdate,
  onEditText,
}: DraggableProps) {
  const x = useSharedValue(sticker.x);
  const y = useSharedValue(sticker.y);
  const scale = useSharedValue(sticker.scale);
  const rotation = useSharedValue((sticker.rotation * Math.PI) / 180);
  const halfW = useSharedValue(0);
  const halfH = useSharedValue(0);
  const pinchBase = useSharedValue(sticker.scale);
  const rotationBase = useSharedValue(0);
  const panStartX = useSharedValue(sticker.x);
  const panStartY = useSharedValue(sticker.y);

  useEffect(() => {
    x.value = sticker.x;
    y.value = sticker.y;
    scale.value = sticker.scale;
    rotation.value = (sticker.rotation * Math.PI) / 180;
  }, [sticker.id, sticker.x, sticker.y, sticker.scale, sticker.rotation, x, y, scale, rotation]);

  const commit = useCallback(
    (nx: number, ny: number, nScale: number, nRotationRad: number) => {
      onUpdate({
        x: nx,
        y: ny,
        scale: nScale,
        rotation: (nRotationRad * 180) / Math.PI,
      });
    },
    [onUpdate]
  );

  const pan = Gesture.Pan()
    .minDistance(4)
    .onBegin(() => {
      runOnJS(onSelect)();
      panStartX.value = x.value;
      panStartY.value = y.value;
    })
    .onUpdate((event) => {
      const w = canvasWidth.value;
      const h = canvasHeight.value;
      if (w <= 0 || h <= 0) return;
      x.value = clamp01(panStartX.value + event.translationX / w);
      y.value = clamp01(panStartY.value + event.translationY / h);
    })
    .onEnd(() => {
      runOnJS(commit)(x.value, y.value, scale.value, rotation.value);
    });

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      runOnJS(onSelect)();
      pinchBase.value = scale.value;
    })
    .onUpdate((event) => {
      scale.value = clampScale(pinchBase.value * event.scale);
    })
    .onEnd(() => {
      runOnJS(commit)(x.value, y.value, scale.value, rotation.value);
    });

  const rotate = Gesture.Rotation()
    .onBegin(() => {
      runOnJS(onSelect)();
      rotationBase.value = rotation.value;
    })
    .onUpdate((event) => {
      rotation.value = rotationBase.value + event.rotation;
    })
    .onEnd(() => {
      runOnJS(commit)(x.value, y.value, scale.value, rotation.value);
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(280)
    .onEnd(() => {
      if (sticker.kind === 'text') {
        runOnJS(onEditText)();
      }
    });

  const singleTap = Gesture.Tap()
    .maxDuration(220)
    .onEnd(() => {
      runOnJS(onSelect)();
    });

  const taps = Gesture.Exclusive(doubleTap, singleTap);
  const gesture = Gesture.Simultaneous(Gesture.Exclusive(pan, taps), pinch, rotate);

  const positionStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x.value * canvasWidth.value - halfW.value,
    top: y.value * canvasHeight.value - halfH.value,
  }));

  const transformStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotation.value}rad` }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={positionStyle}>
        {selected ? (
          <View
            pointerEvents="none"
            className="absolute -inset-3 rounded-lg border-2 border-white/85"
          />
        ) : null}
        <Animated.View
          style={transformStyle}
          onLayout={(e: LayoutChangeEvent) => {
            const { width, height } = e.nativeEvent.layout;
            halfW.value = width / 2;
            halfH.value = height / 2;
          }}
        >
          <StoryStickerContent sticker={sticker} />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

export function StoryStickerCanvas({
  stickers,
  onStickersChange,
  textComposeActive,
  textDraft,
  textStyle,
  textColor,
  onTextDraftChange,
  onTextStyleChange,
  onTextColorChange,
  onTextComposeDone,
  onTextComposeCancel,
  editingStickerId,
  onEditingStickerIdChange,
  onSelectionChange,
}: Props) {
  const [layout, setLayout] = useState<CanvasSize>({ width: 0, height: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const canvasWidth = useSharedValue(0);
  const canvasHeight = useSharedValue(0);

  const composeVisible = textComposeActive || editingStickerId != null;

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      setLayout({ width, height });
      canvasWidth.value = width;
      canvasHeight.value = height;
    },
    [canvasWidth, canvasHeight]
  );

  const updateSticker = useCallback(
    (id: string, patch: Partial<StorySticker>) => {
      onStickersChange(stickers.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    },
    [stickers, onStickersChange]
  );

  const bringToFront = useCallback(
    (id: string) => {
      const index = stickers.findIndex((s) => s.id === id);
      if (index < 0 || index === stickers.length - 1) return;
      const next = [...stickers];
      const [item] = next.splice(index, 1);
      next.push(item);
      onStickersChange(next);
    },
    [stickers, onStickersChange]
  );

  function handleSelect(id: string) {
    setSelectedId(id);
    onSelectionChange?.(id);
    bringToFront(id);
  }

  function handleDeselect() {
    setSelectedId(null);
    onSelectionChange?.(null);
  }

  function handleEditText(sticker: StorySticker) {
    onEditingStickerIdChange(sticker.id);
    onTextDraftChange(sticker.content);
    onTextStyleChange(normalizeStoryTextStyle(sticker.text_style));
    onTextColorChange(normalizeStoryTextColor(sticker.text_color));
  }

  const dismissCompose = useCallback(() => {
    Keyboard.dismiss();
    onTextComposeCancel();
    onEditingStickerIdChange(null);
  }, [onTextComposeCancel, onEditingStickerIdChange]);

  function handleDeleteSelected() {
    if (!selectedId) return;
    onStickersChange(stickers.filter((s) => s.id !== selectedId));
    handleDeselect();
  }

  return (
    <View className="absolute inset-0" onLayout={onLayout} pointerEvents="box-none">
      {!composeVisible ? (
        <Pressable className="absolute inset-0" onPress={handleDeselect} accessibilityRole="button" />
      ) : null}

      {layout.width > 0 && !composeVisible
        ? stickers.map((sticker) => (
            <DraggableSticker
              key={sticker.id}
              sticker={sticker}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              selected={selectedId === sticker.id}
              onSelect={() => handleSelect(sticker.id)}
              onUpdate={(patch) => updateSticker(sticker.id, patch)}
              onEditText={() => handleEditText(sticker)}
            />
          ))
        : null}

      {selectedId && !composeVisible ? (
        <Pressable
          className="absolute right-4 top-28 z-20 h-10 w-10 items-center justify-center rounded-full bg-black/50 active:opacity-80"
          onPress={handleDeleteSelected}
          hitSlop={8}
        >
          <Ionicons name="trash-outline" size={22} color="#fff" />
        </Pressable>
      ) : null}

      {composeVisible ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="absolute inset-0 z-30"
        >
          <View className="flex-1 bg-black/35">
            <SafeAreaComposeHeader onCancel={dismissCompose} onDone={onTextComposeDone} />

            <StoryTextComposeChrome
              draft={textDraft}
              styleName={textStyle}
              colorId={textColor}
              onDraftChange={onTextDraftChange}
              onStyleChange={onTextStyleChange}
              onColorChange={onTextColorChange}
            />
          </View>
        </KeyboardAvoidingView>
      ) : null}
    </View>
  );
}

function SafeAreaComposeHeader({
  onCancel,
  onDone,
}: {
  onCancel: () => void;
  onDone: () => void;
}) {
  return (
    <SafeAreaView edges={['top']} className="flex-row items-center justify-between px-4">
      <Pressable onPress={onCancel} hitSlop={12} className="active:opacity-70">
        <Ionicons name="close" size={28} color="#fff" />
      </Pressable>
      <Pressable
        onPress={() => {
          Keyboard.dismiss();
          onDone();
        }}
        hitSlop={12}
        className="active:opacity-70"
      >
        <Text className="text-[17px] font-bold text-white">Done</Text>
      </Pressable>
    </SafeAreaView>
  );
}
