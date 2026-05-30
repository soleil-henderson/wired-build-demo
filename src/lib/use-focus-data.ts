import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

export type FocusLoadContext = {
  /** True only for the first load after mount or when cacheKey changes */
  isInitial: boolean;
  /** True when `cacheKey` changed since the previous load */
  cacheKeyChanged: boolean;
};

export type UseFocusDataOptions = {
  /** When this changes, the next load is initial and `onCacheKeyChange` runs first */
  cacheKey?: string | number | null | undefined;
  /** Skip silent refetch if data was fetched within this window */
  staleMs?: number;
  /** Refetch when the screen regains focus (default true) */
  refetchOnFocus?: boolean;
  /** Clear stale entity state when `cacheKey` changes (e.g. route id) */
  onCacheKeyChange?: () => void;
};

/**
 * Loads screen data on focus without flashing a full-screen loader on every back navigation.
 * First visit (or cacheKey change) runs with isInitial=true; later visits refetch silently
 * unless refetchOnFocus is false or staleMs has not elapsed.
 */
export function useFocusData(
  load: (ctx: FocusLoadContext) => void | Promise<void>,
  _deps: readonly unknown[] = [],
  options?: UseFocusDataOptions
): { invalidate: () => void } {
  const hasLoaded = useRef(false);
  const lastFetchAt = useRef(0);
  const cacheKeyRef = useRef(options?.cacheKey);
  const staleMs = options?.staleMs ?? 30_000;
  const refetchOnFocus = options?.refetchOnFocus ?? true;
  const cacheKey = options?.cacheKey;

  const loadRef = useRef(load);
  loadRef.current = load;

  const onCacheKeyChangeRef = useRef(options?.onCacheKeyChange);
  onCacheKeyChangeRef.current = options?.onCacheKeyChange;

  const runLoad = useCallback(async (ctx: FocusLoadContext) => {
    await Promise.resolve(loadRef.current(ctx));
    hasLoaded.current = true;
  }, []);

  const invalidate = useCallback(() => {
    hasLoaded.current = false;
    lastFetchAt.current = 0;
  }, []);

  // Route param changes while the screen stays mounted (same component instance).
  useEffect(() => {
    if (cacheKey === undefined) return;
    if (cacheKey === cacheKeyRef.current) return;

    const previousKey = cacheKeyRef.current;
    cacheKeyRef.current = cacheKey;
    hasLoaded.current = false;
    lastFetchAt.current = 0;

    if (previousKey !== undefined) {
      onCacheKeyChangeRef.current?.();
    }

    void runLoad({
      isInitial: true,
      cacheKeyChanged: previousKey !== undefined,
    });
  }, [cacheKey, runLoad]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const run = async () => {
        const isInitial = !hasLoaded.current;
        if (!isInitial) {
          if (!refetchOnFocus) return;
          if (Date.now() - lastFetchAt.current < staleMs) return;
        }

        lastFetchAt.current = Date.now();
        try {
          await runLoad({
            isInitial,
            cacheKeyChanged: false,
          });
        } catch {
          if (!cancelled) hasLoaded.current = false;
        }
      };

      void run();
      return () => {
        cancelled = true;
      };
    }, [refetchOnFocus, staleMs, runLoad])
  );

  return { invalidate };
}
