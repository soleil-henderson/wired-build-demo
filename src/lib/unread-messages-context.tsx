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
import { getUnreadMessageCount } from './messages';

type UnreadMessagesContextValue = {
  count: number;
  refresh: () => Promise<void>;
  clearLocal: () => void;
};

const UnreadMessagesContext = createContext<UnreadMessagesContextValue | undefined>(undefined);

export function UnreadMessagesProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!session) {
      setCount(0);
      return;
    }
    try {
      const unread = await getUnreadMessageCount(session.user.id);
      setCount(unread);
    } catch (err) {
      console.warn('[messages] unread count refresh failed', err);
    }
  }, [session]);

  const clearLocal = useCallback(() => {
    setCount(0);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === 'active') void refresh();
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [refresh]);

  const value = useMemo(() => ({ count, refresh, clearLocal }), [count, refresh, clearLocal]);

  return (
    <UnreadMessagesContext.Provider value={value}>{children}</UnreadMessagesContext.Provider>
  );
}

export function useUnreadMessages() {
  const ctx = useContext(UnreadMessagesContext);
  if (!ctx) {
    throw new Error('useUnreadMessages must be used inside <UnreadMessagesProvider>');
  }
  return ctx;
}
