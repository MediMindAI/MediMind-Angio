/**
 * Theme Color Constants for TypeScript
 *
 * Mirrors MediMind's theme-colors.ts — use these instead of hardcoding hex
 * values in TypeScript/inline styles. Keeps CSS variables and TS color
 * references in sync.
 *
 * FORBIDDEN: Tailwind blues (#3b82f6, #60a5fa, #2563eb, etc.)
 * ALLOWED: the five brand blues below and the semantic colors.
 */

// =============================================================================
// PRIMARY THEME COLORS
// =============================================================================

export const THEME_COLORS = {
  /** Deep navy — primary brand, headers, primary buttons */
  primary: '#1a365d',
  /** Medium blue — secondary actions, interactive */
  secondary: '#2b6cb0',
  /** Bright blue — accents, highlights, focus */
  accent: '#3182ce',
  /** Very light blue — subtle backgrounds */
  lightAccent: '#bee3f8',
  white: '#ffffff',
  textPrimary: '#1f2937',
  textSecondary: '#6b7280',
} as const;

// =============================================================================
// GRAY SCALE — palette-inverting in dark mode (prefer SURFACE_* for bg)
// =============================================================================

export const GRAY_COLORS = {
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',
} as const;

// =============================================================================
// SEMANTIC COLORS
// =============================================================================

export const SEMANTIC_COLORS = {
  success: '#38a169',
  successLight: '#c6f6d5',
  warning: '#dd6b20',
  warningLight: '#feebc8',
  error: '#e53e3e',
  errorLight: '#fed7d7',
  info: '#3182ce',
  infoLight: '#bee3f8',
} as const;

// =============================================================================
// SURFACE COLORS (Light Mode)
// =============================================================================

export const SURFACE_COLORS = {
  page: '#ffffff',
  card: '#ffffff',
  modal: '#ffffff',
  hover: '#f7fafc',
  input: '#ffffff',
  border: '#e5e7eb',
} as const;

// =============================================================================
// GRADIENTS
// =============================================================================

export const GRADIENTS = {
  /** Primary button gradient — use for ALL primary CTAs */
  primary: 'linear-gradient(135deg, #1a365d 0%, #2b6cb0 50%, #3182ce 100%)',
  secondary: 'linear-gradient(135deg, #2b6cb0 0%, #3182ce 50%, #3182ce 100%)',
  success: 'linear-gradient(135deg, #38a169 0%, #48bb78 100%)',
  warning: 'linear-gradient(135deg, #dd6b20 0%, #ed8936 100%)',
  error: 'linear-gradient(135deg, #e53e3e 0%, #fc8181 100%)',
  sectionHeader: 'linear-gradient(135deg, #2b6cb0 0%, #3182ce 100%)',
} as const;

// =============================================================================
// COMPETENCY COLORS (angiology-specific — drives anatomy diagram fills)
// =============================================================================

/**
 * Colors for vein segment competency overlay on anatomical diagrams.
 * Clinical 5-state palette (production):
 *   - Normal       → sky-blue   (patent, evaluated)
 *   - Occluded     → red        (thrombus / non-compressible vein)
 *   - Incompetent  → amber      (reflux)
 *   - Inconclusive → gray       (insufficient data)
 *   - Ablated      → green      (post-procedural)
 *
 * `fill` is the solid swatch color used for segment-table dropdowns,
 * legends, and PDF. `stroke` is the outline. `overlay` is the translucent
 * variant used to paint segment overlays on top of the printed PNG
 * anatomy (see `overlayStrokeFor` in AnatomyView.tsx).
 */
export const COMPETENCY_COLORS = {
  normal:       { fill: '#0ea5e9', stroke: '#0369a1', overlay: 'rgba(14, 165, 233, 0.65)' },
  occluded:     { fill: '#dc2626', stroke: '#991b1b', overlay: 'rgba(220, 38, 38, 0.70)' },
  incompetent:  { fill: '#f59e0b', stroke: '#b45309', overlay: 'rgba(245, 158, 11, 0.70)' },
  inconclusive: { fill: '#9ca3af', stroke: '#4b5563', overlay: 'rgba(156, 163, 175, 0.60)' },
  ablated:      { fill: '#16a34a', stroke: '#166534', overlay: 'rgba(22, 163, 74, 0.60)' },
} as const;

// =============================================================================
// SEVERITY COLORS (arterial + carotid — drives stenosis overlay)
// =============================================================================

/**
 * Five-band severity palette used by arterial LE and carotid duplex
 * anatomy diagrams. Green → amber → orange → red → dark red as stenosis
 * worsens, with occluded rendered as a near-black dark red.
 */
export const SEVERITY_COLORS = {
  normal: { fill: '#22c55e', stroke: '#16a34a' },
  mild: { fill: '#fbbf24', stroke: '#d97706' },
  moderate: { fill: '#f97316', stroke: '#ea580c' },
  severe: { fill: '#ef4444', stroke: '#b91c1c' },
  occluded: { fill: '#991b1b', stroke: '#7f1d1d' },
} as const;

export type Severity = keyof typeof SEVERITY_COLORS;

// =============================================================================
// STATUS COLORS (for badges, state maps)
// =============================================================================

export const STATUS_COLORS = {
  pending: '#dd6b20',
  inProgress: '#2b6cb0',
  completed: '#38a169',
  failed: '#e53e3e',
  cancelled: '#6b7280',
  draft: '#9ca3af',
  scheduled: '#3182ce',
} as const;

// =============================================================================
// FORBIDDEN COLORS
// =============================================================================

/**
 * These Tailwind/external blues are NOT allowed in this codebase.
 * Lint rule should reject them. Use THEME_COLORS instead.
 */
export const FORBIDDEN_COLORS = [
  '#3b82f6', // Tailwind blue-500  → use THEME_COLORS.secondary
  '#60a5fa', // Tailwind blue-400  → use THEME_COLORS.accent
  '#2563eb', // Tailwind blue-600  → use THEME_COLORS.primary
  '#93c5fd', // Tailwind blue-300  → use THEME_COLORS.lightAccent
  '#1d4ed8', // Tailwind blue-700  → use THEME_COLORS.primary
  '#4299e1', // Chakra  blue-400   → use THEME_COLORS.accent
  '#63b3ed', // Chakra  blue-300   → use THEME_COLORS.accent
] as const;

export type ThemeColor = keyof typeof THEME_COLORS;
export type SemanticColor = keyof typeof SEMANTIC_COLORS;
export type StatusColor = keyof typeof STATUS_COLORS;
export type GradientName = keyof typeof GRADIENTS;
// `Competency` is canonically declared in `src/types/anatomy.ts`. It is
// kept in sync with the keys of `COMPETENCY_COLORS` above; the type-check
// guard below catches any drift between the two at compile time.
import type { Competency } from '../types/anatomy';
type _CompetencyKeysMatchPalette = Exclude<Competency, keyof typeof COMPETENCY_COLORS> extends never
  ? Exclude<keyof typeof COMPETENCY_COLORS, Competency> extends never
    ? true
    : never
  : never;
const _competencyKeysMatchPalette: _CompetencyKeysMatchPalette = true;
void _competencyKeysMatchPalette;

