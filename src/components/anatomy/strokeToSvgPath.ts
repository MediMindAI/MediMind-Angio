// SPDX-License-Identifier: Apache-2.0
/**
 * strokeToSvgPath — convert an ordered series of pointer points into a
 * smooth, filled SVG path-`d` string using perfect-freehand.
 *
 * Plain-language: a freehand drawing on a touch screen is just a list of
 * (x, y, pressure) points. perfect-freehand smooths them into the outline
 * of an ink stroke (variable width based on pressure / velocity). We then
 * stitch those outline points into an SVG `<path>` so a stroke can be
 * rendered with a single DOM element.
 */

import { getStroke } from 'perfect-freehand';
import type { DrawingPoint } from '../../types/drawing';

/** Stable perfect-freehand options for clinical sketching. */
const STROKE_OPTIONS = {
  thinning: 0.55,
  smoothing: 0.5,
  streamline: 0.5,
  start: { taper: 0, cap: true },
  end: { taper: 0, cap: true },
};

/**
 * Run perfect-freehand and return an SVG path-`d` string. Returns `''`
 * for input arrays with fewer than two points (no stroke to render).
 */
export function strokeToSvgPath(
  points: ReadonlyArray<DrawingPoint>,
  size: number,
): string {
  if (points.length < 2) return '';
  // perfect-freehand accepts mutable `number[][]`; convert from our
  // readonly tuple representation.
  const mutable: number[][] = points.map((p) => [
    p[0],
    p[1],
    p[2] ?? 0.5,
  ]);
  const outline = getStroke(mutable, {
    size: size * 2,
    ...STROKE_OPTIONS,
  });
  return outlineToPath(outline);
}

/**
 * Convert perfect-freehand's outline points into an SVG path string.
 * Recipe from https://github.com/steveruizok/perfect-freehand#rendering.
 */
function outlineToPath(stroke: number[][]): string {
  if (stroke.length === 0) return '';
  const head = stroke[0];
  if (!head || head.length < 2) return '';
  const d: Array<string | number> = ['M', head[0]!, head[1]!, 'Q'];
  for (let i = 0; i < stroke.length - 1; i++) {
    const a = stroke[i];
    const b = stroke[i + 1];
    if (!a || !b || a.length < 2 || b.length < 2) continue;
    const x0 = a[0]!;
    const y0 = a[1]!;
    const x1 = b[0]!;
    const y1 = b[1]!;
    d.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  d.push('Z');
  return d.join(' ');
}
