import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { type ReactNode, useCallback, useRef } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { storyCameraHref } from '@/lib/story-camera-nav';
import { colors } from '@/lib/theme';

type Props = {
  children: ReactNode;
  enabled?: boolean;
};

/** Finger must start within this many px of the screen edge (Instagram-style). */
const LEFT_EDGE_PX = 40;
const RIGHT_EDGE_PX = 40;
const SWIPE_THRESHOLD = 56;
const VELOCITY_THRESHOLD = 400;

const SPRING_OPEN = { damping: 26, stiffness: 280, mass: 0.85 };
const SPRING_CLOSE = { damping: 28, stiffness: 320, mass: 0.9 };

export function HomeSwipeShell({ children, enabled = true }: Props) {
  const router = useRouter();
  const navigation = useNavigation();
  const firedRef = useRef(false);
  const screenWidth = Dimensions.get('window').width;
  const startEdge = useSharedValue<'left' | 'right' | 'none'>('none');
  const translateX = useSharedValue(0);

  const setTabBarHidden = useCallback(
    (hidden: boolean) => {
      navigation.getParent()?.setOptions({
        tabBarStyle: hidden ? { display: 'none' } : undefined,
      });
    },
    [navigation]
  );

  useFocusEffect(
    useCallback(() => {
      translateX.value = 0;
      setTabBarHidden(false);
      return () => setTabBarHidden(false);
    }, [setTabBarHidden, translateX])
  );

  useAnimatedReaction(
    () => translateX.value > 6,
    (hidden, prev) => {
      if (hidden === prev) return;
      runOnJS(setTabBarHidden)(hidden);
    },
    [setTabBarHidden]
  );

  function openStoryCamera() {
    if (firedRef.current) return;
    firedRef.current = true;
    router.push(storyCameraHref(true));
    setTimeout(() => {
      firedRef.current = false;
    }, 800);
  }

  function openMessages() {
    if (firedRef.current) return;
    firedRef.current = true;
    router.push('/messages');
    setTimeout(() => {
      firedRef.current = false;
    }, 800);
  }

  const pan = Gesture.Pan()
    .enabled(enabled)
    .manualActivation(true)
    .onTouchesDown((event, state) => {
      'worklet';
      const touch = event.allTouches[0];
      if (!touch) {
        state.fail();
        return;
      }
      const x = touch.absoluteX;
      if (x <= LEFT_EDGE_PX) {
        startEdge.value = 'left';
        state.activate();
      } else if (x >= screenWidth - RIGHT_EDGE_PX) {
        startEdge.value = 'right';
        state.activate();
      } else {
        startEdge.value = 'none';
        state.fail();
      }
    })
    .activeOffsetX([-12, 12])
    .failOffsetY([-28, 28])
    .onUpdate((event) => {
      'worklet';
      if (startEdge.value !== 'left') return;
      translateX.value = Math.max(0, Math.min(screenWidth, event.translationX));
    })
    .onEnd((event) => {
      'worklet';
      const { translationX, velocityX } = event;
      const edge = startEdge.value;
      startEdge.value = 'none';

      if (edge === 'left') {
        const shouldOpen =
          translationX >= SWIPE_THRESHOLD || velocityX >= VELOCITY_THRESHOLD;
        if (shouldOpen) {
          runOnJS(openStoryCamera)();
          translateX.value = withSpring(screenWidth, SPRING_OPEN);
        } else {
          translateX.value = withSpring(0, SPRING_CLOSE);
        }
        return;
      }

      if (
        edge === 'right' &&
        (translationX <= -SWIPE_THRESHOLD || velocityX <= -VELOCITY_THRESHOLD)
      ) {
        translateX.value = withTiming(0, { duration: 120 });
        runOnJS(openMessages)();
      }
    });

  const panelStyle = useAnimatedStyle(() => ({
    flex: 1,
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={styles.root}>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.panel, panelStyle]}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  panel: {
    flex: 1,
    backgroundColor: colors.bg2,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 10,
  },
});
