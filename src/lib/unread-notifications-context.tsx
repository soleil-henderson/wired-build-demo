import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuth } from './auth-context';
import { getUnreadCount } from './notifications';
import { setAppBadgeCount } from './push-notifications';

type UnreadNotificationsContextValue = {
  count: number;
  refresh: () => Promise<void>;
  /** Optimistically clear the badge before the inbox finishes marking read. */
  clearLocal: () => void;
};

const UnreadNotificationsContext = createContext<UnreadNotificationsContextValue | undefined>(
  undefined
);

export function UnreadNotificationsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!session) {
      setCount(0);
      await setAppBadgeCount(0);
      return;
    }
    try {
      const unread = await getUnreadCount(session.user.id);
      setCount(unread);
      await setAppBadgeCount(unread);
    } catch (err) {
      console.warn('[notifications] unread count refresh failed', err);
    }
  }, [session]);

  const clearLocal = useCallback(() => {
    setCount(0);
    void setAppBadgeCount(0);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Refresh when the app returns to the foreground (new pushes may have arrived).
  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === 'active') {
        void refresh();
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [refresh]);

  const value = useMemo(
    () => ({ count, refresh, clearLocal }),
    [count, refresh, clearLocal]
  );

  return (
    <UnreadNotificationsContext.Provider value={value}>
      {children}
    </UnreadNotificationsContext.Provider>
  );
}

export function useUnreadNotifications() {
  const ctx = useContext(UnreadNotificationsContext);
  if (!ctx) {
    throw new Error('useUnreadNotifications must be used inside <UnreadNotificationsProvider>');
  }
  return ctx;
}
