import { Redirect } from 'expo-router';

/** Legacy route — business profile lives under /workshop/profile-edit */
export default function WorkshopProfileRedirect() {
  return <Redirect href="/workshop/profile-edit" />;
}
