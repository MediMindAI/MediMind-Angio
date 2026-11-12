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

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { strokeToSvgPath } from './strokeToSvgPath';
import { polylineFromPoints, type Point as PolyPoint } from './polylineFromPoints';
import {
  ANATOMY_VIEWBOX,
  DRAWING_COLOR_HEX,
  fontForSize,
  type AnatomyViewKey,
  type DrawingMode,
  type DrawingPoint,
  type DrawingStroke,
  type DrawingTool,
  type DrawingColor,
  type DrawingSize,
} from '../../types/drawing';
import type { SegmentId } from '../../types/anatomy';

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
  /** Placeholder/aria text for the inline text-annotation input. */
  readonly textPlaceholder?: string;
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

/**
 * Map a screen-pixel point onto SVG viewBox space using a known svg element
 * (vs. `svgPointFrom`, which reads it off the event's currentTarget). Used by
 * the text-drag handlers, whose events fire on the `<text>` child.
 */
function clientToViewBox(
  svg: SVGSVGElement | null,
  clientX: number,
  clientY: number,
): readonly [number, number] {
  const ctm = svg?.getScreenCTM();
  if (!svg || !ctm) return [0, 0];
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const { x, y } = pt.matrixTransform(ctm.inverse());
  return [x, y];
}

// ----- Text-label clamp (UX-ANGIO-019) -----
// A label is anchored at its LEFT baseline (`points[0]`) and runs rightward,
// so one dropped near the right edge used to overflow the viewBox and get
// cut off — on screen (the overlay SVG clips) and in the PDF (same anchor).
// We clamp the stored anchor so the whole label sits inside the viewBox;
// because the clamped anchor is what persists, the PDF matches the screen.

const TEXT_FONT_FAMILY = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
/** Gap (viewBox units) kept between a label and the diagram edge. */
const TEXT_EDGE_PAD = 6;
/** Headroom for the PDF font (Noto Sans Georgian bold), which can run a
 *  little wider than the screen font the label is measured in. */
const TEXT_WIDTH_SLACK = 1.1;

/** Rendered width of `text` in viewBox units. Measures with a throw-away
 *  `<text>` in the overlay SVG; falls back to a per-glyph estimate where
 *  layout is unavailable (jsdom, detached SVG). */
function measureTextWidth(svg: SVGSVGElement | null, text: string, fontSize: number): number {
  const estimate = text.length * fontSize * 0.6;
  if (!svg) return estimate;
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  el.setAttribute('font-size', String(fontSize));
  el.setAttribute('font-family', TEXT_FONT_FAMILY);
  el.setAttribute('font-weight', '600');
  el.textContent = text;
  svg.appendChild(el);
  try {
    const width = typeof el.getComputedTextLength === 'function' ? el.getComputedTextLength() : 0;
    return width > 0 ? width : estimate;
  } finally {
    svg.removeChild(el);
  }
}

/** Clamp a label's left-baseline anchor so the whole label fits the viewBox. */
function clampTextAnchor(
  x: number,
  y: number,
  width: number,
  fontSize: number,
  viewBoxW: number,
  viewBoxH: number,
): readonly [number, number] {
  const maxX = Math.max(TEXT_EDGE_PAD, viewBoxW - width * TEXT_WIDTH_SLACK - TEXT_EDGE_PAD);
  const minY = fontSize + TEXT_EDGE_PAD; // room for the glyph ascent
  const maxY = Math.max(minY, viewBoxH - fontSize * 0.3 - TEXT_EDGE_PAD); // room for descenders
  return [Math.min(Math.max(x, TEXT_EDGE_PAD), maxX), Math.min(Math.max(y, minY), maxY)];
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
  textPlaceholder,
}: DrawingCanvasProps): React.ReactElement {
  // Per-view viewBox so the overlay shares the backdrop SVG's coordinate space.
  const [VIEWBOX_W, VIEWBOX_H] = ANATOMY_VIEWBOX[view];
  const [activePoints, setActivePoints] = useState<DrawingPoint[]>([]);
  const activeRef = useRef<DrawingPoint[]>([]);
  // Text-tool: where the pending inline input is anchored (viewBox coords)
  // and its current value. `null` position = no input open.
  const [textAnchor, setTextAnchor] = useState<{ x: number; y: number } | null>(null);
  const [textValue, setTextValue] = useState('');
  const textInputRef = useRef<HTMLInputElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  // When the inline input opened (ms). Used to ignore the spurious blur that
  // the opening click itself fires before the user has typed anything.
  const textOpenedAtRef = useRef(0);
  // Live drag of a committed text label: which label, the grab offset from its
  // anchor, and its current (live) anchor. `null` = not dragging.
  const [dragText, setDragText] = useState<
    { id: string; dx: number; dy: number; x: number; y: number; width: number } | null
  >(null);

  const isDrawing = mode === 'draw' && tool === 'pen';
  const isErasing = mode === 'draw' && tool === 'eraser';
  const isTexting = mode === 'draw' && tool === 'text';
  // Edit-segment mode captures strokes when a segment is selected.
  // When no segment is selected, the canvas lets pointer events fall
  // through so the user can click a hit-zone in the anatomy SVG below
  // to select one.
  const isEditingSegment = mode === 'edit-segment' && !!editingSegmentId;

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>): void => {
      if (isTexting) {
        // One input at a time: if one is already open, this click lands on
        // the canvas background and the input's onBlur commits it (then the
        // NEXT click opens a fresh one). Otherwise open an input here.
        if (textAnchor) return;
        const [x, y] = svgPointFrom(event);
        textOpenedAtRef.current =
          typeof performance !== 'undefined' ? performance.now() : Date.now();
        setTextValue('');
        setTextAnchor({ x, y });
        return;
      }
      if (!isDrawing && !isEditingSegment) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      const next = [svgPointFrom(event)];
      activeRef.current = next;
      setActivePoints(next);
    },
    [isTexting, textAnchor, isDrawing, isEditingSegment],
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
    (strokeId: string) => (event: React.MouseEvent<SVGElement>) => {
      if (!isErasing) return;
      event.stopPropagation();
      onEraseStroke(strokeId);
    },
    [isErasing, onEraseStroke],
  );

  // Commit the pending text label as a `drawings` item (a stroke whose
  // `text` is set, anchored at points[0]). Empty/whitespace = discard.
  // Idempotent: after it runs, the anchor/value are cleared so a stray
  // blur firing right after Enter/Escape is a harmless no-op.
  const commitAndCloseText = useCallback((): void => {
    const value = textValue.trim();
    if (textAnchor && value) {
      const fontSize = fontForSize(size);
      const [ax, ay] = clampTextAnchor(
        textAnchor.x,
        textAnchor.y,
        measureTextWidth(svgRef.current, value, fontSize),
        fontSize,
        VIEWBOX_W,
        VIEWBOX_H,
      );
      onCommitStroke({
        id:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `text-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        view,
        color,
        size,
        points: [[ax, ay]],
        text: value,
        createdAt: new Date().toISOString(),
      });
    }
    setTextAnchor(null);
    setTextValue('');
  }, [textAnchor, textValue, view, color, size, onCommitStroke, VIEWBOX_W, VIEWBOX_H]);

  const handleTextKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>): void => {
      if (event.key === 'Enter') {
        event.preventDefault();
        commitAndCloseText();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setTextAnchor(null);
        setTextValue('');
      }
    },
    [commitAndCloseText],
  );

  // Blur = "clicked away" → commit. BUT the very click that opens the input
  // also fires a focus-settling blur a millisecond later (Blink/Opera); if we
  // closed on that, the input would vanish before the user could type. So an
  // empty blur within a short window of opening is treated as spurious and we
  // just re-assert focus instead of closing.
  const handleTextBlur = useCallback((): void => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (textValue.trim() === '' && now - textOpenedAtRef.current < 500) {
      requestAnimationFrame(() => textInputRef.current?.focus());
      return;
    }
    commitAndCloseText();
  }, [textValue, commitAndCloseText]);

  // Focus the inline input once it opens so the clinician can type
  // immediately. Deferred to the next frame so the opening click's own
  // focus handling has fully settled first (otherwise it blurs instantly).
  useEffect(() => {
    if (!textAnchor) return;
    const raf = requestAnimationFrame(() => textInputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [textAnchor]);

  // ----- Drag a committed text label to reposition it -----
  // Grab a label (text-tool only). stopPropagation so the canvas doesn't also
  // open a new text input under the same press.
  const startTextDrag = useCallback(
    (stroke: DrawingStroke) => (event: ReactPointerEvent<SVGTextElement>): void => {
      if (!isTexting) return;
      event.stopPropagation();
      const anchor = stroke.points[0];
      if (!anchor) return;
      const [px, py] = clientToViewBox(svgRef.current, event.clientX, event.clientY);
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // capture can race on rapid taps — safe to ignore.
      }
      const width = measureTextWidth(svgRef.current, stroke.text ?? '', fontForSize(stroke.size));
      setDragText({ id: stroke.id, dx: px - anchor[0], dy: py - anchor[1], x: anchor[0], y: anchor[1], width });
    },
    [isTexting],
  );

  const moveTextDrag = useCallback(
    (stroke: DrawingStroke) => (event: ReactPointerEvent<SVGTextElement>): void => {
      setDragText((d) => {
        if (!d) return d;
        const [px, py] = clientToViewBox(svgRef.current, event.clientX, event.clientY);
        const [x, y] = clampTextAnchor(
          px - d.dx,
          py - d.dy,
          d.width,
          fontForSize(stroke.size),
          VIEWBOX_W,
          VIEWBOX_H,
        );
        return { ...d, x, y };
      });
    },
    [VIEWBOX_W, VIEWBOX_H],
  );

  // Drop: persist the new position. Implemented as erase + re-commit (same id,
  // new anchor) so it reuses the existing reducer actions — no per-form change.
  const endTextDrag = useCallback(
    (stroke: DrawingStroke) => (event: ReactPointerEvent<SVGTextElement>): void => {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // ignore — capture may already be gone.
      }
      setDragText((d) => {
        if (!d || d.id !== stroke.id) return null;
        const anchor = stroke.points[0];
        const movedFar =
          !anchor || Math.abs(d.x - anchor[0]) > 0.5 || Math.abs(d.y - anchor[1]) > 0.5;
        if (movedFar) {
          const newAnchor: DrawingPoint = [d.x, d.y];
          onEraseStroke(stroke.id);
          onCommitStroke({ ...stroke, points: [newAnchor] });
        }
        return null;
      });
    },
    [onEraseStroke, onCommitStroke],
  );

  // Pointer events pass through to the anatomy below in click mode AND
  // in edit-segment mode while no segment has been selected yet (so the
  // user can click a hit-zone to pick the target). Once a segment is
  // selected, we capture events to draw the redrawn polyline.
  const pointerEvents: CSSProperties['pointerEvents'] = isDrawing
    ? 'all'
    : isEditingSegment
    ? 'all'
    : isTexting
    ? 'all'
    : isErasing
    ? 'none'
    : 'none';

  const cursor =
    isDrawing || isEditingSegment ? 'crosshair' : isTexting ? 'text' : 'default';

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

  // Inline input width: as much room as the click leaves, 120–280 units.
  const textInputW = textAnchor ? Math.max(120, Math.min(280, VIEWBOX_W - textAnchor.x)) : 0;

  return (
    <svg
      ref={svgRef}
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
        // Text label: render the typed string at its anchor point. While the
        // label is being dragged, render it at the live drag position instead.
        if (stroke.text != null) {
          const anchor = stroke.points[0];
          if (!anchor) return null;
          const live = dragText && dragText.id === stroke.id;
          const tx = live ? dragText.x : anchor[0];
          const ty = live ? dragText.y : anchor[1];
          // In text mode the label is draggable; in erase mode it's click-to-
          // delete; otherwise it's inert (pointer events fall through).
          const textStyle: CSSProperties = isTexting
            ? { pointerEvents: 'all', cursor: 'move', touchAction: 'none' }
            : isErasing
            ? { pointerEvents: 'all', cursor: 'pointer' }
            : { pointerEvents: 'none' };
          return (
            <text
              key={stroke.id}
              x={tx}
              y={ty}
              fill={DRAWING_COLOR_HEX[stroke.color]}
              fontSize={fontForSize(stroke.size)}
              fontFamily={TEXT_FONT_FAMILY}
              fontWeight={600}
              data-stroke-id={stroke.id}
              data-testid={`drawing-text-${stroke.id}`}
              onClick={handleStrokeClick(stroke.id)}
              onPointerDown={startTextDrag(stroke)}
              onPointerMove={moveTextDrag(stroke)}
              onPointerUp={endTextDrag(stroke)}
              style={textStyle}
            >
              {stroke.text}
            </text>
          );
        }
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
      {/* Inline text-annotation input. Hosted in a <foreignObject> so it
          lives in the SAME viewBox coordinate space as the anatomy — no
          screen↔userspace math needed to place it at the click point. */}
      {textAnchor && (
        <foreignObject
          // Keep the input box inside the viewBox too, so it isn't half-hidden
          // when the clinician clicks near the right or bottom edge.
          x={Math.max(0, Math.min(textAnchor.x, VIEWBOX_W - textInputW))}
          y={Math.max(0, Math.min(textAnchor.y - fontForSize(size), VIEWBOX_H - fontForSize(size) * 2))}
          width={textInputW}
          height={fontForSize(size) * 2}
          style={{ overflow: 'visible' }}
        >
          <input
            ref={textInputRef}
            value={textValue}
            onChange={(event) => setTextValue(event.target.value)}
            onKeyDown={handleTextKeyDown}
            onBlur={handleTextBlur}
            onPointerDown={(event) => event.stopPropagation()}
            placeholder={textPlaceholder}
            aria-label={textPlaceholder ?? 'Label text'}
            data-testid="drawing-text-input"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              fontSize: `${fontForSize(size)}px`,
              fontFamily: TEXT_FONT_FAMILY,
              fontWeight: 600,
              color: DRAWING_COLOR_HEX[color],
              background: 'var(--emr-bg-input)',
              border: `1.5px solid ${DRAWING_COLOR_HEX[color]}`,
              borderRadius: 'var(--emr-border-radius-sm)',
              padding: '1px 6px',
              outline: 'none',
            }}
          />
        </foreignObject>
      )}
    </svg>
  );
});

export default DrawingCanvas;
