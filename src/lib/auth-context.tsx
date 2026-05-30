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
import { formatSignInError, normalizeAuthEmail } from './auth-account';
import { webAppAbsoluteUrl } from './site-url';
import { supabase } from './supabase';
import type { AccountType } from '@/types/database';

type AuthContextValue = {
  session: Session | null;
  isLoading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    password: string,
    options?: { accountType?: AccountType }
  ) => Promise<{ session: Session | null; needsEmailConfirmation: boolean }>;
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
        const normalizedEmail = normalizeAuthEmail(email);
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (error) {
          throw formatSignInError(error);
        }
      },
      async signUpWithEmail(email, password, options) {
        const accountType = options?.accountType ?? 'builder';
        const normalizedEmail = normalizeAuthEmail(email);
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: { account_type: accountType },
            emailRedirectTo: webAppAbsoluteUrl('/auth/callback'),
          },
        });
        if (error) throw error;

        if (data.user && data.user.identities?.length === 0) {
          throw new Error(
            'An account with this email already exists. Try signing in instead.'
          );
        }

        const needsEmailConfirmation = !data.session && !!data.user;
        return {
          session: data.session,
          needsEmailConfirmation,
        };
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
