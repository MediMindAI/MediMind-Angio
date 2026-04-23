import { createTheme, type CSSVariablesResolver, type MantineColorScheme, type MantineColorSchemeManager } from '@mantine/core';

/**
 * Mantine theme configuration — exact mirror of MediMind's index.tsx setup.
 * Overrides the default Mantine palettes so `theme.colors.blue[6]` resolves
 * to our `#2b6cb0` secondary (not Mantine's default #4dabf7).
 */
export const mantineTheme = createTheme({
  primaryColor: 'blue',
  colors: {
    dark: [
      '#f1f5f9', // 0 — text in dark mode
      '#e2e8f0',
      '#cbd5e1',
      '#94a3b8',
      '#64748b',
      '#475569',
      '#334155', // 6 — input bg
      '#1e293b', // 7 — background
      '#0f172a',
      '#020617', // 9 — darkest
    ],
    blue: [
      '#e8f0f8', // 0 — lightest
      '#c7dbed',
      '#a5c5e2',
      '#83afd7',
      '#6199cc',
      '#3182ce', // 5 — accent
      '#2b6cb0', // 6 — secondary (primary button)
      '#245a8c',
      '#1d4869',
      '#1a365d', // 9 — primary
    ],
    cyan: [
      '#e8f4f8',
      '#c7e3ed',
      '#a5d2e2',
      '#83c1d7',
      '#61afcc',
      '#3182ce',
      '#2b6cb0',
      '#245a8c',
      '#1d4869',
      '#1a365d',
    ],
  },
  headings: {
    sizes: {
      h1: { fontSize: '1.125rem', fontWeight: '500', lineHeight: '2.0' },
    },
  },
  fontSizes: {
    xs: '0.6875rem',
    sm: '0.875rem',
    md: '0.875rem',
    lg: '1rem',
    xl: '1.125rem',
  },
  components: {
    Badge: {
      styles: () => ({
        root: { height: 'auto', paddingTop: 3, paddingBottom: 3 },
        label: { lineHeight: 1.4 },
      }),
    },
    Table: {
      styles: () => ({
        table: { color: 'var(--emr-text-primary)' },
        thead: { color: 'var(--emr-text-primary)' },
        tbody: { color: 'var(--emr-text-primary)' },
        th: { color: 'var(--emr-text-primary) !important' },
        td: { color: 'var(--emr-text-primary) !important' },
      }),
    },
  },
});

/**
 * Bridges Mantine's built-in color-scheme variables with our app's theme
 * variables. In both light and dark modes, Mantine's internal tokens read
 * from our `--emr-*` variables so surfaces stay consistent.
 */
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    '--mantine-color-text': 'var(--emr-text-primary)',
    '--mantine-color-body': 'var(--emr-bg-page)',
    '--input-bg': 'var(--emr-bg-input)',
    '--mantine-color-default': 'var(--emr-bg-card)',
    '--mantine-color-default-hover': 'var(--emr-bg-hover)',
  },
  dark: {
    '--mantine-color-text': 'var(--emr-text-primary)',
    '--mantine-color-body': 'var(--emr-bg-page)',
    '--input-bg': 'var(--emr-bg-input)',
    '--mantine-color-default': 'var(--emr-bg-card)',
    '--mantine-color-default-hover': 'var(--emr-bg-hover)',
  },
});

/**
 * Color scheme manager — mirrors MediMind's pattern exactly.
 * Maps our app's localStorage scheme ('light' | 'dark' | 'system') to
 * Mantine's internal ('light' | 'dark' | 'auto') so the system-preference
 * state round-trips cleanly.
 */
export function createAppColorSchemeManager(storageKey: string): MantineColorSchemeManager {
  let handleUpdate: ((value: MantineColorScheme) => void) | undefined;
  let listenerRef: ((e: StorageEvent) => void) | undefined;

  return {
    get(defaultValue) {
      if (typeof window === 'undefined') return defaultValue;
      const raw = localStorage.getItem(storageKey);
      if (raw === 'dark') return 'dark';
      if (raw === 'light') return 'light';
      if (raw === 'system') return 'auto';
      return defaultValue;
    },
    set(value) {
      if (typeof window === 'undefined') return;
      const mapped = value === 'auto' ? 'system' : value;
      localStorage.setItem(storageKey, mapped);
    },
    subscribe(onUpdate) {
      handleUpdate = onUpdate;
      listenerRef = (e: StorageEvent) => {
        if (e.key === storageKey) {
          const raw = e.newValue;
          const mapped: MantineColorScheme =
            raw === 'system' ? 'auto' : raw === 'dark' ? 'dark' : 'light';
          handleUpdate?.(mapped);
        }
      };
      window.addEventListener('storage', listenerRef);
    },
    unsubscribe() {
      handleUpdate = undefined;
      if (listenerRef) {
        window.removeEventListener('storage', listenerRef);
        listenerRef = undefined;
      }
    },
    clear() {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(storageKey);
      }
    },
  };
}
