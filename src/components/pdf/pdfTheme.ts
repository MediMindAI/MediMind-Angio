/**
 * PDF theme tokens — colors, layout, and font sizes used by all PDF
 * components.
 *
 * These mirror the web-side design tokens from `constants/theme-colors.ts`
 * but are restated here because @react-pdf/renderer cannot read CSS
 * variables (it has no browser context). Keep both files in sync when
 * updating brand colors.
 *
 * Layout uses millimeters via the @react-pdf default unit converter
 * (`mm`). A4 portrait: 210×297 mm. Margins: 20 mm all sides.
 *
 * Font sizes follow a 5-step type scale tuned for clinical reports on
 * A4. We favor 10 pt body and 9 pt labels so dense data tables still
 * fit without side-scrolling.
 */

import { THEME_COLORS, SEMANTIC_COLORS, GRAY_COLORS, COMPETENCY_COLORS } from '../../constants/theme-colors';

/**
 * Brand + surface colors for PDF.
 *
 * Restates `THEME_COLORS` / `SEMANTIC_COLORS` in the shape the PDF layer
 * wants (flat, no nesting). If you need a new token, add it here *and*
 * in `constants/theme-colors.ts`.
 */
export const PDF_THEME = {
  // Brand
  primary: THEME_COLORS.primary,
  secondary: THEME_COLORS.secondary,
  accent: THEME_COLORS.accent,
  // Text
  text: THEME_COLORS.textPrimary,
  textMuted: THEME_COLORS.textSecondary,
  // Surface
  background: '#ffffff',
  border: GRAY_COLORS.gray300,
  borderStrong: GRAY_COLORS.gray400,
  // Semantic
  success: SEMANTIC_COLORS.success,
  warning: SEMANTIC_COLORS.warning,
  error: SEMANTIC_COLORS.error,
  // Competency overlay (for anatomy diagrams rendered inside PDF)
  competencyNormal: COMPETENCY_COLORS.normal.fill,
  competencyAblated: COMPETENCY_COLORS.ablated.fill,
  competencyAblatedStroke: COMPETENCY_COLORS.ablated.stroke,
  competencyIncompetent: COMPETENCY_COLORS.incompetent.fill,
  competencyInconclusive: COMPETENCY_COLORS.inconclusive.fill,
} as const;

/**
 * Page layout — A4 portrait with 20 mm margins (default).
 *
 * `mm` is the default measurement unit for @react-pdf when the page
 * `size="A4"` prop is used; each numeric style value is interpreted as
 * points by default but @react-pdf accepts `mm`, `cm`, `in` suffixes.
 * For simplicity we keep raw numbers here and express padding/margin in
 * points via the default conversion: 1 mm ≈ 2.8346 pt.
 *
 * The default export `PDF_LAYOUT` is preserved for back-compat; the new
 * `PDF_PAGE_PRESETS` table adds a Letter preset (US 8.5 × 11 in) so the
 * report can be rendered for North-American clinics by passing
 * `pageSize="Letter"` into `<ReportDocument />`.
 */
export const PDF_LAYOUT = {
  pageSize: 'A4',
  orientation: 'portrait',
  // 20 mm margin ≈ 56.7 pt
  marginTopPt: 56.7,
  marginBottomPt: 56.7,
  marginLeftPt: 56.7,
  marginRightPt: 56.7,
  // Derived content width/height (A4 = 210×297 mm = 595.28×841.89 pt)
  contentWidthPt: 595.28 - 56.7 * 2,
  contentHeightPt: 841.89 - 56.7 * 2,
} as const;

/**
 * Supported PDF page-size presets. A4 is the global / Georgian default;
 * Letter (8.5 × 11 in = 612 × 792 pt) is offered for US-based clinics.
 *
 * `contentWidthPt` / `contentHeightPt` already subtract the symmetric
 * 1-inch (72 pt) margin used for Letter so layout code that anchors to
 * the content box stays correct across both presets.
 */
export type PdfPageSize = 'A4' | 'Letter';

export const PDF_PAGE_PRESETS: Record<
  PdfPageSize,
  {
    readonly pageSize: PdfPageSize;
    readonly contentWidthPt: number;
    readonly contentHeightPt: number;
  }
> = {
  A4: {
    pageSize: 'A4',
    contentWidthPt: 595.28 - 56.7 * 2,
    contentHeightPt: 841.89 - 56.7 * 2,
  },
  Letter: {
    pageSize: 'Letter',
    contentWidthPt: 612 - 72 * 2,
    contentHeightPt: 792 - 72 * 2,
  },
} as const;

/**
 * Severity-band fill / text colors shared by every PDF table that
 * tints rows or chips (Wave 4.3 — single source of truth).
 *
 * Plain-language: each badge / chip / row tint in the PDF uses one of
 * these five "bands" (success = green, info = blue, warning = amber,
 * error = red, neutral = gray). Centralizing them here means every
 * section gets the same shade and we only edit one place when the
 * brand updates.
 */
export type PdfBandKey = 'success' | 'info' | 'warning' | 'error' | 'neutral';

export const PDF_BAND_COLORS: Record<
  PdfBandKey,
  { readonly bg: string; readonly fg: string }
> = {
  success: { bg: '#bbf7d0', fg: '#166534' },
  info: { bg: '#bfdbfe', fg: '#1e40af' },
  warning: { bg: '#fde68a', fg: '#92400e' },
  error: { bg: '#fecaca', fg: '#991b1b' },
  neutral: { bg: '#e5e7eb', fg: '#374151' },
} as const;

/**
 * Font sizes in points (pt). Chosen so the 10 pt body reads comfortably
 * on an A4 print, with enough headroom in headings for section breaks.
 */
export const PDF_FONT_SIZES = {
  footnote: 8,
  label: 9,
  body: 10,
  heading: 12,
  title: 18,
} as const;

/**
 * Default font family for all PDF text. Registered by
 * `services/fontService.ts` before any PDF renders.
 */
export const PDF_FONT_FAMILY = 'NotoSansGeorgian' as const;
