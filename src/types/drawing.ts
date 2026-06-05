// SPDX-License-Identifier: Apache-2.0
/**
 * Drawing types — the data model for clinician-authored hand-drawn marks
 * layered on top of the venous LE anatomy diagrams.
 *
 * Strokes are stored as ordered point arrays (with optional pressure) and
 * rendered to SVG via `perfect-freehand`'s `getStroke` outline algorithm.
 * Each stroke is tagged with a `view` so the same `drawings` array can
 * power both the anterior and posterior diagram panels — strokes drawn
 * on one view do NOT appear on the other.
 */

import { COMPETENCY_COLORS } from '../constants/theme-colors';

export type AnatomyViewKey =
  | 'le-anterior'
  | 'le-posterior'
  | 'neck-carotid'
  | 'le-arterial-anterior'
  | 'abdominal-pelvic';

/**
 * ViewBox pixel dimensions per anatomy view. The drawing-canvas overlay SVG
 * must share the anatomy SVG's coordinate space so freehand strokes land
 * where the cursor is. Venous LE is 600×1453; the carotid fillable-vector
 * view (neck-carotid.svg) is 771×910.
 */
export const ANATOMY_VIEWBOX: Record<AnatomyViewKey, readonly [number, number]> = {
  'le-anterior': [600, 1453],
  'le-posterior': [600, 1453],
  'neck-carotid': [771, 910],
  'le-arterial-anterior': [600, 1453],
  // Iliac/pelvic static illustration backdrop (abdominal-pelvic.png is 345×451).
  'abdominal-pelvic': [345, 451],
};

/**
 * Drawing-toolbar mode.
 *  - `click`        — segment pointer events flow through to AnatomyView
 *  - `draw`         — pen captures pointer events on the drawing canvas
 *  - `edit-segment` — pen pointer events redraw the geometry of the most
 *                     recently clicked anatomy segment, persisted as
 *                     `pathOverride` on its `VenousSegmentFinding`.
 */
export type DrawingMode = 'click' | 'draw' | 'edit-segment';

export type DrawingTool = 'pen' | 'eraser' | 'text';

/**
 * Pen palette mirrors the clinical 5-state anatomy palette so a red pen
 * and a "reflux" segment, or a black pen and an "occluded" segment, read
 * as the same idea on screen.
 */
export const DRAWING_COLORS = ['normal', 'occluded', 'incompetent', 'inconclusive', 'ablated'] as const;
export type DrawingColor = (typeof DRAWING_COLORS)[number];

/** Resolves a `DrawingColor` token to a concrete CSS color string. */
export const DRAWING_COLOR_HEX: Readonly<Record<DrawingColor, string>> = {
  normal:       COMPETENCY_COLORS.normal.fill,
  occluded:     COMPETENCY_COLORS.occluded.fill,
  incompetent:  COMPETENCY_COLORS.incompetent.fill,
  inconclusive: COMPETENCY_COLORS.inconclusive.fill,
  ablated:      COMPETENCY_COLORS.ablated.fill,
};

/**
 * Migration helper — older saved strokes used generic colour names
 * (`black|red|blue|green`). Map them to the closest clinical state so
 * already-saved drafts render in the new palette.
 */
export function migrateLegacyDrawingColor(value: unknown): DrawingColor {
  switch (value) {
    case 'red':   return 'occluded';
    case 'blue':  return 'normal';
    case 'green': return 'incompetent';
    case 'black': return 'inconclusive';
    case 'normal':
    case 'occluded':
    case 'incompetent':
    case 'inconclusive':
    case 'ablated':
      return value;
    default:
      return 'normal';
  }
}

/** Stroke widths — three sizes, in viewBox units. */
export const DRAWING_SIZES = [2, 4, 8] as const;
export type DrawingSize = (typeof DRAWING_SIZES)[number];

/**
 * Font size (viewBox units) for a text annotation, derived from the same
 * size pill that controls pen thickness. Reusing the pen `DrawingSize`
 * keeps the toolbar to one "Size" control for both pen and text. Tuned to
 * read clearly on both the venous (600×1453) and carotid (771×910) views.
 */
export function fontForSize(size: DrawingSize): number {
  switch (size) {
    case 2:
      return 20;
    case 8:
      return 40;
    case 4:
    default:
      return 28;
  }
}

/** Tuple of [x, y, pressure?] in viewBox coordinates. */
export type DrawingPoint = readonly [number, number, number?];

export interface DrawingStroke {
  readonly id: string;
  readonly view: AnatomyViewKey;
  readonly color: DrawingColor;
  readonly size: DrawingSize;
  readonly points: ReadonlyArray<DrawingPoint>;
  readonly createdAt: string;
  /**
   * When set, this item is a **text label** anchored at `points[0]` rather
   * than a freehand stroke — rendered as `<text>` (web) / `<Text>` (PDF) in
   * the chosen `color`, at `fontForSize(size)`. Absent on freehand strokes,
   * so older saved drafts keep rendering as paths (backward-compatible).
   */
  readonly text?: string;
}

export const DEFAULT_DRAWING_COLOR: DrawingColor = 'normal';
export const DEFAULT_DRAWING_SIZE: DrawingSize = 4;
