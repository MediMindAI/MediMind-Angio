/** User's theme preference setting */
export type ThemeMode = 'light' | 'dark' | 'system';

/** The actual theme being displayed (after resolving 'system' to concrete value) */
export type ResolvedTheme = 'light' | 'dark';

/** Context value provided by ThemeProvider */
export interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  resolvedTheme: ResolvedTheme;
  toggleTheme: () => void;
  isSystemTheme: boolean;
}
