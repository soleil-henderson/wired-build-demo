import { Redirect } from 'expo-router';

/** Legacy route — business accounts use the same onboarding as builders. */
export default function OnboardingWorkshopRedirect() {
  return <Redirect href="/(auth)/onboarding" />;
}
