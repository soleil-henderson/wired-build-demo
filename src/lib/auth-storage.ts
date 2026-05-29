import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import type { SupportedStorage } from '@supabase/supabase-js';

const memory = new Map<string, string>();

const webStorage: SupportedStorage = {
  getItem: async (key) => localStorage.getItem(key),
  setItem: async (key, value) => {
    localStorage.setItem(key, value);
  },
  removeItem: async (key) => {
    localStorage.removeItem(key);
  },
};

/**
 * Supabase session storage that works in:
 * - React Native (AsyncStorage)
 * - Web browser (localStorage)
 * - Static web export / SSR (in-memory noop — no window during prerender)
 */
export function getAuthStorage(): SupportedStorage {
  if (typeof window === 'undefined') {
    return {
      getItem: async (key) => memory.get(key) ?? null,
      setItem: async (key, value) => {
        memory.set(key, value);
      },
      removeItem: async (key) => {
        memory.delete(key);
      },
    };
  }
  if (Platform.OS === 'web') {
    return webStorage;
  }
  return AsyncStorage;
}
