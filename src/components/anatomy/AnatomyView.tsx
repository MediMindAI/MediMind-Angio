/**
 * AnatomyView — renders an anatomical SVG with per-segment competency colors.
 *
 * Plain-language: think of it as a coloring book. The SVG ships with empty
 * "segments" (each vein is a `<path id="cfv-left">`). This component fills
 * each one with the color dictated by the segments map ("normal" = black,
 * "incompetent" = red, etc.) and wires up hover + click interactivity.
 *
 * Architecture notes:
 *   - Loads raw SVG text via `svgLoader` (cached per-view).
 *   - Mutates the SVG string ONCE per (view, segments, defaultCompetency)
 *     change to set `fill` + `stroke` + `stroke-width` on each segment.
 *   - Renders via `dangerouslySetInnerHTML` (safe — the SVG is our own
 *     static asset shipped from `public/anatomy/`, never user content).
 *   - Delegates pointer events on the wrapper so we don't attach listeners
 *     to every path.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { Box, Loader, Text } from '@mantine/core';
import type { Competency, SegmentId } from '../../types/anatomy';
import { useTranslation } from '../../contexts/TranslationContext';
import { colorForCompetency } from './useAnatomyColors';
import { loadAnatomySvg, type AnatomyView as AnatomyViewType } from './svgLoader';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type AnatomyViewSize = 'sm' | 'md' | 'lg' | 'xl' | 'print';

export interface AnatomyViewProps {
  /** Which anatomical view to render. */
  view: AnatomyViewType;
  /** Segment-id to competency map (Map or plain object both accepted). */
  segments: Map<SegmentId, Competency> | Record<SegmentId, Competency>;
  /** Fill for segments not present in the map. Default: 'normal'. */
  defaultCompetency?: Competency;
  /** Visual size preset (determines max-width). */
  size?: AnatomyViewSize;
  /** Hover + click enabled. Default: true. Forced false when size = 'print'. */
  interactive?: boolean;
  /** Click handler (segment id + current competency). */
  onSegmentClick?: (id: SegmentId, current: Competency) => void;
  /** Hover handler (segment id or null when leaving). */
  onSegmentHover?: (id: SegmentId | null) => void;
  /** Visually emphasize one segment (e.g. "jump-to" link highlight). */
  highlightId?: SegmentId | null;
  /** Additional CSS class for the outer wrapper. */
  className?: string;
  /** Accessible label for the whole diagram. */
  ariaLabel?: string;
  /**
   * Optional override — if provided, bypasses the built-in competency-based
   * coloring and lets the caller decide colors per segment id directly.
   * Used by non-venous studies (arterial, carotid) that have their own
   * severity bands instead of the 4-state `Competency` enum.
   */
  colorFn?: (id: SegmentId) => { fill: string; stroke: string };
}

// ---------------------------------------------------------------------------
// Size => max-width map (px)
// ---------------------------------------------------------------------------

const SIZE_MAX_WIDTH: Record<AnatomyViewSize, number> = {
  sm: 200,
  md: 320,
  lg: 480,
  xl: 640,
  print: 480,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeSegments(
  segments: Map<SegmentId, Competency> | Record<SegmentId, Competency>,
): Map<SegmentId, Competency> {
  if (segments instanceof Map) return segments;
  const map = new Map<SegmentId, Competency>();
  for (const key of Object.keys(segments)) {
    const value = segments[key];
    if (value !== undefined) map.set(key, value);
  }
  return map;
}

/**
 * Inject competency-driven `fill` + `stroke` + `stroke-width` attributes
 * on each `<path id="...">` under `#segments`. Mutates the raw SVG string
 * using a precise `<path ...id="X"...>` regex — we own the SVG so markup
 * is well-known and stable.
 */
function colorizeSvg(
  raw: string,
  segmentsMap: Map<SegmentId, Competency>,
  defaultCompetency: Competency,
  silhouetteStroke: string,
  segmentStrokeWidth: number,
  highlightId: SegmentId | null,
  colorFn: ((id: SegmentId) => { fill: string; stroke: string }) | undefined,
): string {
  // 1) Silhouette leg outline stroke -- theme-aware so it reads in dark mode.
  let out = raw.replace(
    /(<g id="silhouette"[^>]*stroke=")[^"]*(")/,
    `$1${silhouetteStroke}$2`,
  );
  out = out.replace(
    /(<g id="pelvis-hint"[^>]*stroke=")[^"]*(")/,
    `$1${silhouetteStroke}$2`,
  );

  // 2) Each <path id="..."> under #segments -- inject inline fill/stroke.
  out = out.replace(
    /<path\s+id="([a-z0-9-]+)"([^>]*)>/g,
    (_match: string, id: string, rest: string) => {
      const competency = segmentsMap.get(id) ?? defaultCompetency;
      const { fill, stroke } = colorFn
        ? colorFn(id)
        : colorForCompetency(competency);
      const isHighlighted = highlightId === id;
      const widthToApply = isHighlighted ? segmentStrokeWidth + 2 : segmentStrokeWidth;
      // Strip any existing fill/stroke/stroke-width on this <path>, then append ours.
      const cleanRest = rest
        .replace(/\sfill="[^"]*"/g, '')
        .replace(/\sstroke="[^"]*"/g, '')
        .replace(/\sstroke-width="[^"]*"/g, '');
      const filterAttr = isHighlighted
        ? ' filter="drop-shadow(0 0 4px rgba(49,130,206,0.6))"'
        : '';
      return `<path id="${id}"${cleanRest} fill="${fill}" stroke="${stroke}" stroke-width="${widthToApply}"${filterAttr} data-segment-id="${id}" data-competency="${competency}">`;
    },
  );

  return out;
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

interface TooltipState {
  id: SegmentId;
  label: string;
  competency: Competency;
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AnatomyView({
  view,
  segments,
  defaultCompetency = 'normal',
  size = 'md',
  interactive = true,
  onSegmentClick,
  onSegmentHover,
  highlightId = null,
  className,
  ariaLabel,
  colorFn,
}: AnatomyViewProps): React.ReactElement {
  const { t } = useTranslation();
  const [rawSvg, setRawSvg] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Non-interactive when printing.
  const isInteractive = size !== 'print' && interactive;
  const segmentStrokeWidth = size === 'print' ? 4 : 3;
  const maxWidth = SIZE_MAX_WIDTH[size];

  // Load raw SVG on view change.
  useEffect(() => {
    let cancelled = false;
    setRawSvg(null);
    setLoadError(null);

    loadAnatomySvg(view)
      .then((text) => {
        if (!cancelled) setRawSvg(text);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          setLoadError(msg);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [view]);

  // Normalize segments once per render.
  const segmentsMap = useMemo(() => normalizeSegments(segments), [segments]);

  // Colorize SVG whenever inputs change.
  const colorizedSvg = useMemo(() => {
    if (!rawSvg) return null;
    const silhouetteStroke = 'var(--emr-text-primary)';
    return colorizeSvg(
      rawSvg,
      segmentsMap,
      defaultCompetency,
      silhouetteStroke,
      segmentStrokeWidth,
      highlightId ?? null,
      colorFn,
    );
  }, [rawSvg, segmentsMap, defaultCompetency, segmentStrokeWidth, highlightId, colorFn]);

  // ---------- Pointer event delegation ----------

  const findSegmentId = useCallback((target: EventTarget | null): SegmentId | null => {
    if (!(target instanceof Element)) return null;
    const match = target.closest('[data-segment-id]');
    if (!match) return null;
    return match.getAttribute('data-segment-id');
  }, []);

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isInteractive) return;
      const id = findSegmentId(event.target);
      if (!id) {
        if (tooltip !== null) setTooltip(null);
        if (wrapperRef.current) wrapperRef.current.style.cursor = 'default';
        return;
      }
      const competency = segmentsMap.get(id) ?? defaultCompetency;
      const wrapperRect = wrapperRef.current?.getBoundingClientRect();
      const x = wrapperRect ? event.clientX - wrapperRect.left : event.clientX;
      const y = wrapperRect ? event.clientY - wrapperRect.top : event.clientY;
      setTooltip({
        id,
        label: humanLabelFromId(id),
        competency,
        x,
        y,
      });
      if (wrapperRef.current) wrapperRef.current.style.cursor = 'pointer';
    },
    [isInteractive, findSegmentId, segmentsMap, defaultCompetency, tooltip],
  );

  const handlePointerLeave = useCallback(() => {
    if (!isInteractive) return;
    setTooltip(null);
    if (wrapperRef.current) wrapperRef.current.style.cursor = 'default';
    onSegmentHover?.(null);
  }, [isInteractive, onSegmentHover]);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!isInteractive) return;
      const id = findSegmentId(event.target);
      if (!id) return;
      const current = segmentsMap.get(id) ?? defaultCompetency;
      onSegmentClick?.(id, current);
    },
    [isInteractive, findSegmentId, segmentsMap, defaultCompetency, onSegmentClick],
  );

  // Fire `onSegmentHover` only when the hovered id changes.
  const lastHoveredIdRef = useRef<SegmentId | null>(null);
  useEffect(() => {
    if (!onSegmentHover) return;
    const current = tooltip?.id ?? null;
    if (current !== lastHoveredIdRef.current) {
      lastHoveredIdRef.current = current;
      onSegmentHover(current);
    }
  }, [tooltip, onSegmentHover]);

  // ---------- Render ----------

  const wrapperStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    maxWidth: `${maxWidth}px`,
    margin: '0 auto',
    touchAction: 'manipulation',
  };

  const svgHostStyle: CSSProperties = {
    width: '100%',
    display: 'block',
  };

  if (loadError) {
    return (
      <Box role="alert" style={wrapperStyle}>
        <Text
          style={{
            color: 'var(--emr-error-text)',
            fontSize: 'var(--emr-font-sm)',
            textAlign: 'center',
          }}
        >
          {loadError}
        </Text>
      </Box>
    );
  }

  if (!colorizedSvg) {
    return (
      <Box
        style={{
          ...wrapperStyle,
          minHeight: `${maxWidth * 1.5}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-busy="true"
      >
        <Loader size="sm" color="blue" />
      </Box>
    );
  }

  const resolvedAriaLabel = ariaLabel ?? t(`anatomy.view.${view}`, `Anatomy: ${view}`);

  return (
    <div
      ref={wrapperRef}
      className={className}
      style={wrapperStyle}
      role={isInteractive ? 'group' : 'img'}
      aria-label={resolvedAriaLabel}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClick={handleClick}
    >
      <div
        style={svgHostStyle}
        // SVG is loaded from public/anatomy/*.svg (our own asset) — safe.
        dangerouslySetInnerHTML={{ __html: colorizedSvg }}
      />

      {tooltip && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            left: `${tooltip.x + 12}px`,
            top: `${tooltip.y + 12}px`,
            background: 'var(--emr-bg-card)',
            color: 'var(--emr-text-primary)',
            border: '1px solid var(--emr-border-default)',
            borderRadius: 'var(--emr-border-radius)',
            boxShadow: 'var(--emr-shadow-md)',
            padding: '8px 10px',
            fontSize: 'var(--emr-font-sm)',
            pointerEvents: 'none',
            zIndex: 1200,
            maxWidth: '220px',
            lineHeight: 1.375,
          }}
        >
          <div style={{ fontWeight: 600 }}>
            {tooltip.label}
          </div>
          <div
            style={{
              marginTop: '2px',
              color: 'var(--emr-text-secondary)',
              fontSize: 'var(--emr-font-xs)',
            }}
          >
            {t(`competency.${tooltip.competency}`, tooltip.competency)}
          </div>
        </div>
      )}

      {/* Hover style for segment paths -- slightly larger stroke + subtle glow. */}
      <style>{`
        [data-segment-id] {
          transition: stroke-width 150ms ease, filter 150ms ease;
        }
        ${
          isInteractive
            ? `[data-segment-id]:hover {
                stroke-width: ${segmentStrokeWidth + 1.5}px;
                filter: drop-shadow(0 0 3px rgba(49,130,206,0.5));
                cursor: pointer;
              }`
            : ''
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Label helper (decoupled from scripts/ to avoid bundling dev tooling).
// ---------------------------------------------------------------------------

const SEGMENT_BASE_LABELS: Record<string, string> = {
  cfv: 'Common femoral vein',
  eiv: 'External iliac vein',
  'fv-prox': 'Femoral vein (proximal)',
  'fv-mid': 'Femoral vein (mid)',
  'fv-dist': 'Femoral vein (distal)',
  pfv: 'Profunda (deep femoral) vein',
  'gsv-ak': 'Great saphenous vein (above knee)',
  'gsv-prox-calf': 'Great saphenous vein (proximal calf)',
  'gsv-mid-calf': 'Great saphenous vein (mid calf)',
  'gsv-dist-calf': 'Great saphenous vein (distal calf)',
  'pop-ak': 'Popliteal vein (above knee)',
  'pop-fossa': 'Popliteal vein (fossa)',
  'pop-bk': 'Popliteal vein (below knee)',
  ptv: 'Posterior tibial vein',
  per: 'Peroneal vein',
  ssv: 'Small saphenous vein',
  gastroc: 'Gastrocnemius vein',
  soleal: 'Soleal vein',
  sfj: 'Saphenofemoral junction',
  spj: 'Saphenopopliteal junction',
  ivc: 'Inferior vena cava',
  lrv: 'Left renal vein',
  cia: 'Common iliac vein',
  eia: 'External iliac vein',
  iia: 'Internal iliac vein',
  cfa: 'Common femoral artery',
  sfa: 'Superficial femoral artery',
  'pop-art': 'Popliteal artery',
  at: 'Anterior tibial artery',
  pt: 'Posterior tibial artery',
  'per-art': 'Peroneal artery',
  dp: 'Dorsalis pedis artery',
  cca: 'Common carotid artery',
  ica: 'Internal carotid artery',
  eca: 'External carotid artery',
  va: 'Vertebral artery',
  'avf-inflow': 'AVF inflow',
  'avf-anastomosis': 'AVF anastomosis',
  'avf-outflow': 'AVF outflow',
};

/** Given a full id like "gsv-ak-left" return "Great saphenous vein (above knee) (left)". */
function humanLabelFromId(fullId: SegmentId): string {
  const sideMatch = fullId.match(/-(left|right|bilateral|midline)$/);
  if (!sideMatch) {
    return SEGMENT_BASE_LABELS[fullId] ?? fullId;
  }
  const side = sideMatch[1] ?? '';
  const base = fullId.slice(0, fullId.length - side.length - 1);
  const baseLabel = SEGMENT_BASE_LABELS[base] ?? base;
  return `${baseLabel} (${side})`;
}
