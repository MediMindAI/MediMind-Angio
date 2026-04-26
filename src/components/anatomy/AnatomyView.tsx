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
import classes from './AnatomyView.module.css';

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
  /**
   * Optional tooltip status text resolver. When `colorFn` is in use the
   * built-in `competency.<value>` translation lookup is misleading because
   * the segments map is empty for non-venous studies (the venous Competency
   * enum doesn't apply to severity bands). If both `colorFn` and
   * `tooltipText` are provided, the tooltip status line uses this resolver.
   * If `colorFn` is provided but `tooltipText` is not, the status line is
   * hidden entirely (still shows the segment label). Venous studies
   * (no `colorFn`) keep the existing competency-based status text.
   */
  tooltipText?: (id: SegmentId) => string;
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

  // 2) Side labels (R/L letters) -- the SVGs ship with `fill="#4a5568"`
  //    (slate-600), which is nearly invisible against the dark page
  //    background `--emr-bg-page` ≈ `#0f172a`. R/L confusion on a vascular
  //    map is a clinical-safety smell; rewrite to the theme text token so
  //    the letters track light/dark mode automatically.
  out = out.replace(
    /(<g id="side-labels"[^>]*fill=")[^"]*(")/,
    `$1var(--emr-text-primary)$2`,
  );

  // 3) Junction dots (anatomical landmarks on arterial + carotid views)
  //    ship with `fill="#1a365d"` (deep navy), which becomes nearly
  //    invisible on the dark page. Use the secondary text token — slightly
  //    less prominent than the R/L letters, which keeps the anatomical
  //    hierarchy visually correct in both themes.
  out = out.replace(
    /(<g id="junction-dots"[^>]*fill=")[^"]*(")/,
    `$1var(--emr-text-secondary)$2`,
  );

  // 4) Each <path id="..."> under #segments -- inject inline fill/stroke.
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
      // Drop the data-competency attribute when colorFn is in use — it would
      // be misleading because the segments map is empty for non-venous
      // studies; the visible color comes from severity bands, not competency
      // (Area 01 BLOCKER). The data-segment-id attribute is preserved for
      // event delegation.
      const competencyAttr = colorFn ? '' : ` data-competency="${competency}"`;
      return `<path id="${id}"${cleanRest} fill="${fill}" stroke="${stroke}" stroke-width="${widthToApply}"${filterAttr} data-segment-id="${id}"${competencyAttr}>`;
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
  tooltipText,
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
        label: humanLabelFromId(id, t),
        competency,
        x,
        y,
      });
      if (wrapperRef.current) wrapperRef.current.style.cursor = 'pointer';
    },
    [isInteractive, findSegmentId, segmentsMap, defaultCompetency, tooltip, t],
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

  // Wave 4.6 (Part 01 MEDIUM) — segment hover affordances live in
  // `AnatomyView.module.css`. The dynamic stroke width still has to come
  // from JS (depends on `size`), so we feed it through a CSS custom
  // property and let the CSS module read `var(--anatomy-segment-hover-stroke)`.
  const wrapperStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    maxWidth: `${maxWidth}px`,
    margin: '0 auto',
    touchAction: 'manipulation',
    ['--anatomy-segment-hover-stroke' as string]: `${segmentStrokeWidth + 1.5}px`,
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

  const wrapperClass = [classes.host, className].filter(Boolean).join(' ');

  return (
    <div
      ref={wrapperRef}
      className={wrapperClass}
      data-interactive={isInteractive ? 'true' : 'false'}
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
          {(() => {
            // Status-line text resolution:
            // - colorFn + tooltipText → caller-supplied severity label (arterial / carotid)
            // - colorFn alone        → hide the line (competency would be misleading)
            // - no colorFn (venous)  → translated competency value (existing behavior)
            if (colorFn) {
              if (!tooltipText) return null;
              return (
                <div
                  style={{
                    marginTop: '2px',
                    color: 'var(--emr-text-secondary)',
                    fontSize: 'var(--emr-font-xs)',
                  }}
                >
                  {tooltipText(tooltip.id)}
                </div>
              );
            }
            return (
              <div
                style={{
                  marginTop: '2px',
                  color: 'var(--emr-text-secondary)',
                  fontSize: 'var(--emr-font-xs)',
                }}
              >
                {t(`competency.${tooltip.competency}`, tooltip.competency)}
              </div>
            );
          })()}
        </div>
      )}

      {/* Hover affordance lives in AnatomyView.module.css (Wave 4.6). */}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Label helper (decoupled from scripts/ to avoid bundling dev tooling).
// ---------------------------------------------------------------------------

/**
 * Translation-key suffixes for every segment base id rendered in the anatomy
 * tooltips. Mirrors the keys defined under `anatomy.segment.*` in the shared
 * locale JSONs (`translations/{en,ka,ru}.json`).
 *
 * Keys are normalized (lowercase, dashes → underscores) so they remain valid
 * JSON identifiers — e.g. `'fv-prox'` → `'fv_prox'`.
 */
function segmentTranslationKey(baseId: string): string {
  return baseId.replace(/-/g, '_');
}

const SEGMENT_BASE_IDS: ReadonlyArray<string> = [
  'cfv', 'eiv', 'fv-prox', 'fv-mid', 'fv-dist', 'pfv',
  'gsv-ak', 'gsv-prox-calf', 'gsv-mid-calf', 'gsv-dist-calf',
  'pop-ak', 'pop-fossa', 'pop-bk',
  'ptv', 'per', 'ssv', 'gastroc', 'soleal', 'sfj', 'spj',
  'ivc', 'lrv', 'cia', 'eia', 'iia',
  'cfa', 'sfa', 'pop-art', 'at', 'pt', 'per-art', 'dp',
  'cca', 'ica', 'eca', 'va',
  'avf-inflow', 'avf-anastomosis', 'avf-outflow',
];

type AnatomyT = (key: string, fallback?: string | Record<string, unknown>) => string;

/**
 * Given a full id like "gsv-ak-left" return a localized label like
 * "Great saphenous vein (above knee) (left)" (or the equivalent in the
 * active language). Falls back to the raw base id when a translation key
 * is missing so we never render an empty tooltip.
 */
function humanLabelFromId(fullId: SegmentId, t: AnatomyT): string {
  const sideMatch = fullId.match(/-(left|right|bilateral|midline)$/);
  const lookupBase = (base: string): string => {
    // Only attempt a translation lookup for ids we know about; otherwise the
    // raw id is more useful than a `anatomy.segment.<unknown>` placeholder.
    if (SEGMENT_BASE_IDS.includes(base)) {
      return t(`anatomy.segment.${segmentTranslationKey(base)}`, base);
    }
    return base;
  };

  if (!sideMatch) {
    return lookupBase(fullId);
  }
  const side = sideMatch[1] ?? '';
  const base = fullId.slice(0, fullId.length - side.length - 1);
  const baseLabel = lookupBase(base);
  const sideLabel = t(`anatomy.side.${side}`, side);
  return `${baseLabel} (${sideLabel})`;
}
