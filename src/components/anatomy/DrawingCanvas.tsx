// SPDX-License-Identifier: Apache-2.0
/**
 * DrawingCanvas — the freehand-stroke layer rendered on top of an
 * AnatomyView. When `mode === 'draw'`, the canvas captures pointer events
 * (drawing or stroke-erasing); otherwise pointer events pass through to
 * the underlying anatomy SVG so segment clicking still works.
 *
 * Strokes are rendered as `<path>` elements inside a sibling `<svg>`
 * positioned absolutely over the anatomy. Coordinates live in the same
 * viewBox space as the anatomy SVG (600 × 1453 for venous LE), so a stroke
 * drawn at viewBox (x, y) scales correctly with the panel size.
 */

import { memo, useCallback, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { strokeToSvgPath } from './strokeToSvgPath';
import { polylineFromPoints, type Point as PolyPoint } from './polylineFromPoints';
import {
  DRAWING_COLOR_HEX,
  type AnatomyViewKey,
  type DrawingMode,
  type DrawingPoint,
  type DrawingStroke,
  type DrawingTool,
  type DrawingColor,
  type DrawingSize,
} from '../../types/drawing';
import type { SegmentId } from '../../types/anatomy';

/** ViewBox dimensions of the venous LE anatomy SVGs. */
const VIEWBOX_W = 600;
const VIEWBOX_H = 1453;

export interface DrawingCanvasProps {
  readonly view: AnatomyViewKey;
  readonly mode: DrawingMode;
  readonly tool: DrawingTool;
  readonly color: DrawingColor;
  readonly size: DrawingSize;
  /** Pre-filtered to this view by the parent. */
  readonly strokes: ReadonlyArray<DrawingStroke>;
  /** Segment currently selected for redraw (mode === 'edit-segment'). */
  readonly editingSegmentId?: SegmentId | null;
  readonly onCommitStroke: (stroke: DrawingStroke) => void;
  readonly onEraseStroke: (strokeId: string) => void;
  /** Commits a redrawn polyline-d for the currently-selected segment. */
  readonly onCommitSegmentEdit?: (segmentId: SegmentId, d: string) => void;
  readonly ariaLabel?: string;
}

/**
 * Map a pointer event in screen-pixel space onto SVG viewBox space using
 * the SVG's own current transformation matrix. `getScreenCTM().inverse()`
 * is the canonical screen→userspace transform — it correctly accounts for
 * `preserveAspectRatio` letterboxing, parent CSS transforms, and browser
 * zoom, so strokes track the cursor exactly under any layout.
 */
function svgPointFrom(
  event: ReactPointerEvent<SVGSVGElement>,
): readonly [number, number, number] {
  const svg = event.currentTarget;
  const ctm = svg.getScreenCTM();
  // PointerEvent.pressure is 0–1 from styluses; mouse defaults to 0.5
  // (or 0 if no button is pressed — we coerce to 0.5 in that case).
  const pressure = event.pressure > 0 ? event.pressure : 0.5;
  if (!ctm) return [0, 0, pressure];
  const pt = svg.createSVGPoint();
  pt.x = event.clientX;
  pt.y = event.clientY;
  const { x, y } = pt.matrixTransform(ctm.inverse());
  return [x, y, pressure];
}

export const DrawingCanvas = memo(function DrawingCanvas({
  view,
  mode,
  tool,
  color,
  size,
  strokes,
  editingSegmentId,
  onCommitStroke,
  onEraseStroke,
  onCommitSegmentEdit,
  ariaLabel,
}: DrawingCanvasProps): React.ReactElement {
  const [activePoints, setActivePoints] = useState<DrawingPoint[]>([]);
  const activeRef = useRef<DrawingPoint[]>([]);

  const isDrawing = mode === 'draw' && tool === 'pen';
  const isErasing = mode === 'draw' && tool === 'eraser';
  // Edit-segment mode captures strokes when a segment is selected.
  // When no segment is selected, the canvas lets pointer events fall
  // through so the user can click a hit-zone in the anatomy SVG below
  // to select one.
  const isEditingSegment = mode === 'edit-segment' && !!editingSegmentId;

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>): void => {
      if (!isDrawing && !isEditingSegment) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      const next = [svgPointFrom(event)];
      activeRef.current = next;
      setActivePoints(next);
    },
    [isDrawing, isEditingSegment],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>): void => {
      if ((!isDrawing && !isEditingSegment) || activeRef.current.length === 0) return;
      const point = svgPointFrom(event);
      const next = [...activeRef.current, point];
      activeRef.current = next;
      setActivePoints(next);
    },
    [isDrawing, isEditingSegment],
  );

  const finishStroke = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>): void => {
      const wasEditing = isEditingSegment;
      if (!isDrawing && !wasEditing) return;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // setPointerCapture/releasePointerCapture can race during cancel events.
      }
      const points = activeRef.current;
      if (points.length >= 2) {
        if (wasEditing && editingSegmentId && onCommitSegmentEdit) {
          // Edit-segment mode: convert the captured stroke into an SVG
          // path-d centreline (M x,y L … L …) and dispatch to the form
          // reducer, which stores it on the segment's `pathOverride`.
          const poly: PolyPoint[] = points.map((p) => [p[0], p[1]] as PolyPoint);
          const d = polylineFromPoints(poly, 1.5);
          if (d) onCommitSegmentEdit(editingSegmentId, d);
        } else if (isDrawing) {
          onCommitStroke({
            id:
              typeof crypto !== 'undefined' && 'randomUUID' in crypto
                ? crypto.randomUUID()
                : `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            view,
            color,
            size,
            points,
            createdAt: new Date().toISOString(),
          });
        }
      }
      activeRef.current = [];
      setActivePoints([]);
    },
    [isDrawing, isEditingSegment, editingSegmentId, view, color, size, onCommitStroke, onCommitSegmentEdit],
  );

  const handleStrokeClick = useCallback(
    (strokeId: string) => (event: React.MouseEvent<SVGPathElement>) => {
      if (!isErasing) return;
      event.stopPropagation();
      onEraseStroke(strokeId);
    },
    [isErasing, onEraseStroke],
  );

  // Pointer events pass through to the anatomy below in click mode AND
  // in edit-segment mode while no segment has been selected yet (so the
  // user can click a hit-zone to pick the target). Once a segment is
  // selected, we capture events to draw the redrawn polyline.
  const pointerEvents: CSSProperties['pointerEvents'] = isDrawing
    ? 'all'
    : isEditingSegment
    ? 'all'
    : isErasing
    ? 'none'
    : 'none';

  const cursor =
    isDrawing || isEditingSegment ? 'crosshair' : 'default';

  // Active (in-progress) stroke preview.
  // - In freehand mode → render via perfect-freehand outline (filled).
  // - In edit-segment mode → render as a centreline polyline (matches
  //   the eventual committed overlay so the user sees what they're
  //   getting).
  const activePath = useMemo(() => {
    if (activePoints.length < 2) return '';
    if (isEditingSegment) {
      return polylineFromPoints(
        activePoints.map((p) => [p[0], p[1]] as PolyPoint),
        0.5,
      );
    }
    return strokeToSvgPath(activePoints, size);
  }, [activePoints, size, isEditingSegment]);

  return (
    <svg
      role="img"
      aria-label={ariaLabel ?? 'Drawing canvas'}
      data-testid={`drawing-canvas-${view}`}
      data-mode={mode}
      data-tool={tool}
      viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents,
        touchAction: 'none',
        cursor,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishStroke}
      onPointerCancel={finishStroke}
    >
      {strokes.map((stroke) => {
        const d = strokeToSvgPath(stroke.points, stroke.size);
        if (!d) return null;
        return (
          <path
            key={stroke.id}
            d={d}
            fill={DRAWING_COLOR_HEX[stroke.color]}
            data-stroke-id={stroke.id}
            data-testid={`drawing-stroke-${stroke.id}`}
            onClick={handleStrokeClick(stroke.id)}
            style={
              isErasing
                ? { pointerEvents: 'all', cursor: 'pointer' }
                : { pointerEvents: 'none' }
            }
          />
        );
      })}
      {activePath && (
        isEditingSegment ? (
          // Edit-segment preview — render as a stroked centreline so the
          // user sees exactly the path that will replace the segment.
          <path
            d={activePath}
            fill="none"
            stroke={DRAWING_COLOR_HEX.occluded}
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
            data-testid="drawing-active-stroke"
            style={{ pointerEvents: 'none' }}
          />
        ) : (
          <path
            d={activePath}
            fill={DRAWING_COLOR_HEX[color]}
            data-testid="drawing-active-stroke"
            style={{ pointerEvents: 'none' }}
          />
        )
      )}
    </svg>
  );
});

export default DrawingCanvas;
