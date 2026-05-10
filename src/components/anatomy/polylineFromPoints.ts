// SPDX-License-Identifier: Apache-2.0
/**
 * polylineFromPoints — convert a freehand drag of pointer positions
 * (in viewBox coordinates) into a clean SVG `<path d>` polyline.
 *
 * Used by the in-form "Edit segment" mode (DrawingCanvas) to produce
 * the geometry stored on `VenousSegmentFinding.pathOverride`, and also
 * by the standalone calibration tool (`public/anatomy/calibrate.html`).
 *
 * Pipeline:
 *   1. Ramer–Douglas–Peucker simplification with a tunable tolerance
 *      drops jittery sub-pixel points while preserving curvature.
 *   2. Coordinates are rounded to the nearest integer (viewBox units
 *      are roughly 1 px on a 480-px panel, so sub-pixel precision is
 *      noise).
 *   3. Emitted as `M x,y L x,y L x,y …` — a centreline that the
 *      `overlayStrokeFor` colour and its stroke-width visually paint on.
 *
 * Centreline (not perfect-freehand outline) is correct for segment
 * overlays because the overlay paths are drawn with `stroke-width`
 * applied at render time; a centreline + stroke-width is fewer DOM
 * nodes and renders identically to a thick line.
 */

export type Point = readonly [number, number, number?];

/**
 * Ramer–Douglas–Peucker simplification. `tol` is in viewBox units; ~1.5
 * is a good default for hand drawing.
 */
export function rdp(pts: ReadonlyArray<Point>, tol = 1.5): Point[] {
  if (pts.length < 3) return pts.slice() as Point[];
  const a = pts[0]!;
  const b = pts[pts.length - 1]!;
  let maxD = 0;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDist(pts[i]!, a, b);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD > tol) {
    return rdp(pts.slice(0, idx + 1), tol).slice(0, -1).concat(rdp(pts.slice(idx), tol));
  }
  return [a, b];
}

function perpDist(p: Point, a: Point, b: Point): number {
  const [x, y] = p; const [x1, y1] = a; const [x2, y2] = b;
  const num = Math.abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1);
  const den = Math.hypot(y2 - y1, x2 - x1) || 1;
  return num / den;
}

/** Emit `M x,y L x,y L x,y …` from an array of viewBox points. */
export function pointsToPathD(pts: ReadonlyArray<Point>): string {
  if (pts.length < 2) return '';
  const head = pts[0]!;
  let d = `M ${Math.round(head[0])},${Math.round(head[1])}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]!;
    d += ` L ${Math.round(p[0])},${Math.round(p[1])}`;
  }
  return d;
}

/** Simplify, round, and emit in one call. */
export function polylineFromPoints(
  pts: ReadonlyArray<Point>,
  tol = 1.5,
): string {
  if (pts.length < 2) return '';
  return pointsToPathD(rdp(pts, tol));
}
