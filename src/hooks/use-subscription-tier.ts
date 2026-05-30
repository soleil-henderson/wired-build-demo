import { useCallback, useState } from 'react';

import { useAuth } from '@/lib/auth-context';
import { getUserSubscriptionTier } from '@/lib/subscription';
import { useFocusData } from '@/lib/use-focus-data';
import type { SubscriptionTier } from '@/types/database';

export function useSubscriptionTier() {
  const { session } = useAuth();
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!session) {
      setTier('free');
      setLoading(false);
      return;
    }
    const next = await getUserSubscriptionTier(session.user.id);
    setTier(next);
    setLoading(false);
  }, [session]);

  useFocusData(() => refresh(), [refresh], {
    cacheKey: session?.user.id,
    staleMs: 60_000,
  });

  return { tier, loading, refresh };
}
