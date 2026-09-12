import React, { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { darkColors, lightColors } from '@/constants/colors';
import type { ThemeColors } from '@/constants/colors';

export type ThemeMode = 'light' | 'dark';

const THEME_KEY = 'receiptsnap_theme';

/**
 * App-wide theme mode, persisted locally. Separate from ReceiptsContext so
 * appearance settings stay independent from receipt data.
 */
export const [ThemeProvider, useThemeMode] = createContextHook(() => {
  const [mode, setMode] = useState<ThemeMode>('light');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_KEY);
        if (!cancelled && (stored === 'dark' || stored === 'light')) {
          setMode(stored);
        }
      } catch {
        // Corrupted or unavailable storage — fall back to light, never crash.
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setTheme = useCallback((next: ThemeMode) => {
    setMode(next);
    void AsyncStorage.setItem(THEME_KEY, next).catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    setMode((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      void AsyncStorage.setItem(THEME_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  return { mode, isLoaded, setTheme, toggleTheme };
});

/** Themed color tokens for the current mode. */
export function useThemeColors(): ThemeColors {
  const { mode } = useThemeMode();
  return mode === 'dark' ? darkColors : lightColors;
}
