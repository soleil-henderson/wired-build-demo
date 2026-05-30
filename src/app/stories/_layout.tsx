import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { useStackScreenOptions } from '@/lib/stack-options';
import { STORY_CAMERA_INSTANT_PARAM } from '@/lib/story-camera-nav';

const slideFromLeft = Platform.select({
  ios: 'slide_from_left',
  android: 'slide_from_left',
  default: 'slide_from_left',
}) as NativeStackNavigationOptions['animation'];

export default function StoriesLayout() {
  const stackHeader = useStackScreenOptions();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="camera"
        options={({ route }) => {
          const instant =
            (route.params as Record<string, string | undefined> | undefined)?.[
              STORY_CAMERA_INSTANT_PARAM
            ] === '1';
          return {
            animation: instant ? 'none' : slideFromLeft,
            animationDuration: 280,
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
            gestureDirection: 'horizontal',
            animationMatchesGesture: !instant,
          };
        }}
      />
      <Stack.Screen
        name="create"
        options={{
          ...stackHeader,
          headerShown: false,
          presentation: 'fullScreenModal',
          title: 'New story',
        }}
      />
      <Stack.Screen name="view/[userId]" options={{ presentation: 'fullScreenModal' }} />
    </Stack>
  );
}
