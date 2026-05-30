import { Redirect, useLocalSearchParams } from 'expo-router';

import { routeParam } from '@/lib/route-param';

/** Legacy URL — public business pages are /@handle like every other user. */
export default function WorkshopPublicRedirect() {
  const params = useLocalSearchParams<{ handle: string }>();
  const handle = routeParam(params.handle);
  if (!handle) {
    return <Redirect href="/(tabs)/explore" />;
  }
  return <Redirect href={`/user/${handle}`} />;
}
