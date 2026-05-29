import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { processQueuedModPhotoUploads } from './offline-queue';
import {
  clearPushToken,
  registerForPushNotificationsAsync,
  setAppBadgeCount,
} from './push-notifications';
import { supabase } from './supabase';

type AuthContextValue = {
  session: Session | null;
  isLoading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Tracks which user id we've already registered a push token for, so we
  // don't re-register on every auth event (token refresh fires frequently).
  const pushRegisteredFor = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setIsLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  // When a session lands, register push notifications. Fire-and-forget —
  // permission denial or simulator just no-ops.
  useEffect(() => {
    const userId = session?.user.id;
    if (!userId || pushRegisteredFor.current === userId) return;
    pushRegisteredFor.current = userId;
    registerForPushNotificationsAsync(userId).catch((err) => {
      console.warn('[auth] push registration failed', err);
    });
    processQueuedModPhotoUploads().catch((err) => {
      console.warn('[auth] offline upload retry failed', err);
    });
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading,
      async signInWithEmail(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (
            error.message.toLowerCase().includes('email not confirmed') ||
            error.message.toLowerCase().includes('not confirmed')
          ) {
            throw new Error(
              'Confirm your email first — check your inbox for the verification link, then sign in again.'
            );
          }
          throw error;
        }
        if (data.user && !data.user.email_confirmed_at) {
          await supabase.auth.signOut();
          throw new Error(
            'Confirm your email first — check your inbox for the verification link, then sign in again.'
          );
        }
      },
      async signUpWithEmail(email, password) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      },
      async signOut() {
        // Clear push token BEFORE signing out — RLS still allows the
        // update while the session is alive. If clearing fails we still
        // sign out (don't strand the user).
        if (session?.user.id) {
          await clearPushToken(session.user.id).catch(() => {});
        }
        await setAppBadgeCount(0).catch(() => {});
        pushRegisteredFor.current = null;
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
    }),
    [session, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
