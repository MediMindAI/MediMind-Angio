/**
 * Theme-aligned numeric constants for cases where TypeScript's
 * `React.CSSProperties['fontWeight']` requires a numeric value but the
 * underlying CSS theme variable resolves to the same number.
 *
 * Background — Wave 10E-2 Sweep 4 LOW 1-7 (audit 2026-05-18):
 * Connect components repeatedly cast `'var(--emr-font-semibold)' as unknown as
 * number` in inline-style objects. The double-cast lies about the runtime
 * value (CSS resolves the var to a number at render time, so it works) but
 * silences a legitimate TypeScript error in 7 places. Centralizing the
 * numeric constants here eliminates the casts and keeps a single source of
 * truth aligned with `theme.css`:
 *   --emr-font-normal:   400
 *   --emr-font-medium:   500
 *   --emr-font-semibold: 600
 *   --emr-font-bold:     700
 *
 * Use:
 *   import { THEME_FONT_WEIGHTS } from '@/emr/styles/theme-constants';
 *   const style: React.CSSProperties = {
 *     fontWeight: THEME_FONT_WEIGHTS.semibold,
 *   };
 *
 * For non-style consumers (badges, calculations) the values are stable
 * integers and may be referenced directly.
 */
export const THEME_FONT_WEIGHTS = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export type ThemeFontWeight = (typeof THEME_FONT_WEIGHTS)[keyof typeof THEME_FONT_WEIGHTS];
