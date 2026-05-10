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

export type AnatomyViewKey = 'le-anterior' | 'le-posterior';

/**
 * Drawing-toolbar mode.
 *  - `click`        — segment pointer events flow through to AnatomyView
 *  - `draw`         — pen captures pointer events on the drawing canvas
 *  - `edit-segment` — pen pointer events redraw the geometry of the most
 *                     recently clicked anatomy segment, persisted as
 *                     `pathOverride` on its `VenousSegmentFinding`.
 */
export type DrawingMode = 'click' | 'draw' | 'edit-segment';

export type DrawingTool = 'pen' | 'eraser';

/**
 * Pen palette is the same clinical 5-state palette as the anatomy
 * overlays. A red pen and a template-coloured "occluded" segment match.
 */
export const DRAWING_COLORS = ['normal', 'occluded', 'incompetent', 'inconclusive'] as const;
export type DrawingColor = (typeof DRAWING_COLORS)[number];

/** Resolves a `DrawingColor` token to a concrete CSS color string. */
export const DRAWING_COLOR_HEX: Readonly<Record<DrawingColor, string>> = {
  normal:       COMPETENCY_COLORS.normal.fill,
  occluded:     COMPETENCY_COLORS.occluded.fill,
  incompetent:  COMPETENCY_COLORS.incompetent.fill,
  inconclusive: COMPETENCY_COLORS.inconclusive.fill,
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
      return value;
    default:
      return 'normal';
  }
}

/** Stroke widths — three sizes, in viewBox units. */
export const DRAWING_SIZES = [2, 4, 8] as const;
export type DrawingSize = (typeof DRAWING_SIZES)[number];

/** Tuple of [x, y, pressure?] in viewBox coordinates. */
export type DrawingPoint = readonly [number, number, number?];

export interface DrawingStroke {
  readonly id: string;
  readonly view: AnatomyViewKey;
  readonly color: DrawingColor;
  readonly size: DrawingSize;
  readonly points: ReadonlyArray<DrawingPoint>;
  readonly createdAt: string;
}

export const DEFAULT_DRAWING_COLOR: DrawingColor = 'normal';
export const DEFAULT_DRAWING_SIZE: DrawingSize = 4;
