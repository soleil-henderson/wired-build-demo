import { Redirect } from 'expo-router';

/** Web app entry at /app — send users into the main tabs. */
export default function AppEntryRedirect() {
  return <Redirect href="/(tabs)" />;
}
