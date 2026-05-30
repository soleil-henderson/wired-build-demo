import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import { FlatList, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/lib/theme';

export type CarouselMedia = {
  url: string;
  kind: 'photo' | 'video';
  thumbnail_url?: string | null;
};

type Props = {
  items: CarouselMedia[];
  aspectRatio?: number;
  /** Single tap — e.g. open post from feed. Omit on post detail so tap does nothing. */
  onSingleTap?: () => void;
  onDoubleTap?: () => void;
  liked?: boolean;
};

export function MediaCarousel({
  items,
  aspectRatio = 1,
  onSingleTap,
  onDoubleTap,
  liked = false,
}: Props) {
  const [index, setIndex] = useState(0);
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const listRef = useRef<FlatList<CarouselMedia>>(null);
  const heartScale = useSharedValue(0);
  const heartOpacity = useSharedValue(0);

  const heartStyle = useAnimatedStyle(() => ({
    opacity: heartOpacity.value,
    transform: [{ scale: heartScale.value }],
  }));

  const flashHeart = useCallback(() => {
    heartOpacity.value = 1;
    heartScale.value = 0.4;
    heartScale.value = withSequence(
      withTiming(1.15, { duration: 180 }),
      withTiming(1, { duration: 100 }),
      withTiming(1, { duration: 400 })
    );
    heartOpacity.value = withSequence(
      withTiming(1, { duration: 180 }),
      withTiming(0, { duration: 500 })
    );
  }, [heartOpacity, heartScale]);

  const handleDoubleTap = useCallback(() => {
    flashHeart();
    onDoubleTap?.();
  }, [flashHeart, onDoubleTap]);

  const media = items.length > 0 ? items : [];

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0]?.index != null) setIndex(viewableItems[0].index);
    }
  ).current;

  const carouselGesture = useMemo(() => {
    const nativeScroll = Gesture.Native();

    if (!onSingleTap && !onDoubleTap) {
      return nativeScroll;
    }

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDelay(300)
      .maxDistance(12)
      .onEnd(() => {
        if (onDoubleTap) runOnJS(handleDoubleTap)();
      });

    const singleTap = Gesture.Tap()
      .numberOfTaps(1)
      .maxDuration(250)
      .maxDistance(12)
      .onEnd(() => {
        if (onSingleTap) runOnJS(onSingleTap)();
      });

    const taps =
      onSingleTap && onDoubleTap
        ? Gesture.Exclusive(doubleTap, singleTap)
        : onDoubleTap
          ? doubleTap
          : singleTap;

    return Gesture.Simultaneous(nativeScroll, taps);
  }, [handleDoubleTap, onDoubleTap, onSingleTap]);

  if (media.length === 0) {
    return (
      <View
        className="w-full items-center justify-center bg-apple-bg2"
        style={{ aspectRatio }}
      >
        <Ionicons name="image-outline" size={48} color={colors.tertiary} />
      </View>
    );
  }

  const { width, height } = layout;

  return (
    <View
      className="relative w-full overflow-hidden bg-apple-bg2"
      style={{ aspectRatio }}
      onLayout={(e: LayoutChangeEvent) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        setLayout({ width: w, height: h });
      }}
    >
      {width > 0 && height > 0 ? (
        <GestureDetector gesture={carouselGesture}>
          <Animated.View style={{ width, height }}>
            <FlatList
              ref={listRef}
              data={media}
              horizontal
              pagingEnabled
              nestedScrollEnabled
              directionalLockEnabled
              decelerationRate="fast"
              snapToAlignment="center"
              disableIntervalMomentum
              showsHorizontalScrollIndicator={false}
              bounces={media.length > 1}
              scrollEnabled={media.length > 1}
              keyExtractor={(item, i) => `${item.url}-${i}`}
              getItemLayout={(_, i) => ({
                length: width,
                offset: width * i,
                index: i,
              })}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
              renderItem={({ item }) => (
                <MediaSlide item={item} width={width} height={height} />
              )}
              onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                const i = Math.round(e.nativeEvent.contentOffset.x / width);
                if (i !== index) setIndex(i);
              }}
              scrollEventThrottle={16}
              style={{ width, height }}
            />
          </Animated.View>
        </GestureDetector>
      ) : null}

      {onDoubleTap ? (
        <Animated.View
          pointerEvents="none"
          style={heartStyle}
          className="absolute inset-0 items-center justify-center"
        >
          <Ionicons
            name="heart"
            size={72}
            color={liked ? colors.accent : '#fff'}
          />
        </Animated.View>
      ) : null}

      {media.length > 1 ? (
        <>
          <View
            pointerEvents="none"
            className="absolute bottom-3 left-0 right-0 flex-row items-center justify-center gap-1.5"
          >
            {media.map((_, i) => (
              <View
                key={i}
                className={`h-1.5 rounded-full ${
                  i === index ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
                }`}
              />
            ))}
          </View>
          <View
            pointerEvents="none"
            className="absolute right-3 top-3 rounded-full bg-black/45 px-2.5 py-1"
          >
            <Text className="text-xs font-semibold text-white">
              {index + 1}/{media.length}
            </Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

function MediaSlide({
  item,
  width,
  height,
}: {
  item: CarouselMedia;
  width: number;
  height: number;
}) {
  if (item.kind === 'video') {
    return (
      <View style={{ width, height }}>
        <VideoSlide uri={item.url} poster={item.thumbnail_url} />
      </View>
    );
  }

  return (
    <View style={{ width, height }}>
      <Image
        source={{ uri: item.url }}
        style={{ width, height }}
        resizeMode="cover"
      />
    </View>
  );
}

function VideoSlide({ uri, poster }: { uri: string; poster?: string | null }) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Video, ResizeMode } = require('expo-av') as typeof import('expo-av');
    return (
      <Video
        source={{ uri }}
        posterSource={poster ? { uri: poster } : undefined}
        usePoster={!!poster}
        style={{ width: '100%', height: '100%' }}
        resizeMode={ResizeMode.COVER}
        useNativeControls
        isLooping={false}
      />
    );
  } catch {
    return (
      <Pressable
        className="h-full w-full items-center justify-center bg-apple-ink"
        onPress={() => {
          import('expo-linking').then(({ openURL }) => openURL(uri));
        }}
      >
        <Ionicons name="play-circle" size={56} color="#fff" />
        <Text className="mt-2 text-sm text-white/80">Tap to open video</Text>
      </Pressable>
    );
  }
}
