import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { getAuthStorage } from './auth-storage';
import type { Database } from '@/types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. ' +
      'Copy .env.example to .env and fill in your project credentials.'
  );
}

/** Native uses AsyncStorage; web uses localStorage when `window` exists. SSR uses memory. */
function shouldPersistSession(): boolean {
  if (Platform.OS !== 'web') return true;
  return typeof window !== 'undefined';
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: getAuthStorage(),
    autoRefreshToken: shouldPersistSession(),
    persistSession: shouldPersistSession(),
    detectSessionInUrl: false,
  },
});
