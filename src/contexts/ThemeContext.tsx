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

function applyTheme(theme: ResolvedTheme): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-mantine-color-scheme', theme);
  }
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

export function ThemeProvider({ children, initialMode }: ThemeProviderProps) {
  const [mode, setModeState] = useState<ThemeMode>(() => initialMode ?? getStoredTheme());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(mode));
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  const setColorSchemeRef = useRef(setColorScheme);
  setColorSchemeRef.current = setColorScheme;

  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  // Sync FROM Mantine — when a child calls setColorScheme() directly
  useEffect(() => {
    const externalMode = mantineToMode(colorScheme);
    if (externalMode !== mode) {
      setModeState(externalMode);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, externalMode);
      }
      setResolvedTheme(resolveTheme(externalMode));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  useEffect(() => {
    setResolvedTheme(resolveTheme(mode));
  }, [mode]);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newMode);
    }
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
