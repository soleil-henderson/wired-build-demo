import { ThemeStack } from '@/components/navigation/ThemeStack';

export default function MessagesLayout() {
  return (
    <ThemeStack>
      <ThemeStack.Screen name="index" options={{ title: 'Messages' }} />
      <ThemeStack.Screen name="new" options={{ title: 'New message' }} />
      <ThemeStack.Screen name="[id]" options={{ title: 'Chat' }} />
    </ThemeStack>
  );
}
