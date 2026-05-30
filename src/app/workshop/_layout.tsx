import { ThemeStack } from '@/components/navigation/ThemeStack';

export default function WorkshopLayout() {
  return (
    <ThemeStack screenOptions={{ headerShown: true }}>
      <ThemeStack.Screen name="[handle]" options={{ headerShown: false }} />
      <ThemeStack.Screen name="dashboard" options={{ title: 'Workshop' }} />
      <ThemeStack.Screen name="jobs" options={{ title: 'Customer jobs' }} />
      <ThemeStack.Screen name="portfolio" options={{ title: 'Portfolio' }} />
      <ThemeStack.Screen name="enquiries" options={{ title: 'Enquiries' }} />
      <ThemeStack.Screen name="profile-edit" options={{ title: 'Business profile' }} />
      <ThemeStack.Screen name="reviews" options={{ title: 'Reviews' }} />
    </ThemeStack>
  );
}
