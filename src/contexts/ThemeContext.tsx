import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useMantineColorScheme } from '@mantine/core';
import type { ResolvedTheme, ThemeContextValue, ThemeMode } from '../types/theme';
import { STORAGE_KEYS, migratedGetItem } from '../constants/storage-keys';

const STORAGE_KEY = STORAGE_KEYS.THEME;

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  const stored = migratedGetItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return mode === 'system' ? getSystemTheme() : mode;
}

function mantineToMode(cs: string): ThemeMode {
  if (cs === 'auto') return 'system';
  if (cs === 'dark') return 'dark';
  return 'light';
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export interface ThemeProviderProps {
  children: ReactNode;
  initialMode?: ThemeMode;
}

/**
 * ThemeProvider — single source of truth for color-scheme writes.
 *
 * Before Wave 2.7, this provider had two race conditions:
 *   1. `applyTheme()` manually called `setAttribute('data-mantine-color-scheme', ...)`
 *      while Mantine's color-scheme manager set the same attribute. On 'system'
 *      mode the two writers raced — one wrote 'auto', the other the resolved
 *      'light' / 'dark' — producing inconsistent CSS theming.
 *   2. `setMode` wrote localStorage AND called `setColorScheme()`, which
 *      triggered the bidirectional sync effect, which wrote localStorage
 *      AGAIN. Per single setMode call, localStorage was written ≥2x.
 *
 * Fix: Mantine's `createAppColorSchemeManager` (from `styles/mantineTheme.ts`)
 * is the SOLE writer of both `data-mantine-color-scheme` and the
 * `STORAGE_KEYS.THEME` localStorage entry. This provider now only mirrors
 * Mantine's state into our app-shape `ThemeMode` and exposes `setMode`.
 */
export function ThemeProvider({ children, initialMode }: ThemeProviderProps) {
  const [mode, setModeState] = useState<ThemeMode>(() => initialMode ?? getStoredTheme());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(mode));
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  const setColorSchemeRef = useRef(setColorScheme);
  setColorSchemeRef.current = setColorScheme;

  // Sync FROM Mantine — when a child calls setColorScheme() directly OR when
  // our manager hydrates from localStorage on mount, mirror the value into
  // our local `mode` state. We DO NOT write localStorage here — Mantine's
  // colorSchemeManager already persisted it. Writing again would be a
  // redundant double-write (one of the two MEDIUM bugs this fix addresses).
  useEffect(() => {
    const externalMode = mantineToMode(colorScheme);
    setModeState((prev) => (prev === externalMode ? prev : externalMode));
    setResolvedTheme(resolveTheme(externalMode));
  }, [colorScheme]);

  // Listen for OS preference changes when in 'system' mode
  useEffect(() => {
    if (mode !== 'system') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent): void => {
      setResolvedTheme(e.matches ? 'dark' : 'light');
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [mode]);

  const setMode = useCallback((newMode: ThemeMode) => {
    // Single side-effect: tell Mantine to switch. Its colorSchemeManager
    // writes localStorage; the sync-FROM-Mantine effect above mirrors the
    // change back into our `mode` state. No manual localStorage.setItem,
    // no manual data-mantine-color-scheme setAttribute.
    setColorSchemeRef.current(newMode === 'system' ? 'auto' : newMode);
  }, []);

  const toggleTheme = useCallback(() => {
    setMode(resolvedTheme === 'light' ? 'dark' : 'light');
  }, [resolvedTheme, setMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, setMode, resolvedTheme, toggleTheme, isSystemTheme: mode === 'system' }),
    [mode, setMode, resolvedTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export { ThemeContext };
