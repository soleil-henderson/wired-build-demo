import { ThemeStack } from '@/components/navigation/ThemeStack';

export default function EventLayout() {
  return (
    <ThemeStack screenOptions={{ headerShown: true, headerBackVisible: true }}>
      <ThemeStack.Screen name="new" options={{ title: 'New event' }} />
      <ThemeStack.Screen name="[id]" options={{ title: 'Event' }} />
    </ThemeStack>
  );
}
