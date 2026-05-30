import { Redirect } from 'expo-router';

/** Legacy route — business tools live on profile and settings, not a separate hub. */
export default function WorkshopDashboardRedirect() {
  return <Redirect href="/(tabs)/profile" />;
}
