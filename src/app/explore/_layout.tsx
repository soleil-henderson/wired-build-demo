import { ThemeStack } from '@/components/navigation/ThemeStack';

export default function ExploreStackLayout() {
  return (
    <ThemeStack screenOptions={{ headerShown: true, headerBackVisible: true }}>
      <ThemeStack.Screen name="nearby" options={{ title: 'Near you' }} />
      <ThemeStack.Screen name="events" options={{ title: 'Events' }} />
      <ThemeStack.Screen name="parts" options={{ title: 'Parts marketplace' }} />
    </ThemeStack>
  );
}
