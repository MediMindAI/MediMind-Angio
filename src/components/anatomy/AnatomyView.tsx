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
import { COMPETENCY_COLORS } from '../../constants/theme-colors';
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
  /**
   * Overlay mode: the SVG contains an `<image>` backdrop and segment
   * paths are invisible until colored. When true, finding-driven colors
   * are painted as translucent strokes over the backdrop instead of solid
   * fills. Used by the venous-LE reference-image diagram.
   */
  overlay?: boolean;
  /**
   * Per-segment SVG path-d override. When a segment id is present in
   * this map, its `<path d>` is replaced with the supplied string —
   * letting the user reshape an overlay path without editing the
   * shipped SVG asset. Captured by the "Edit segment" mode of the
   * drawing toolbar.
   */
  pathOverrides?: Map<SegmentId, string> | Record<SegmentId, string>;
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
  overlay: boolean = false,
  pathOverrides?: Map<SegmentId, string>,
): string {
  // 0) Backdrop image href — rewrite to respect Vite's BASE_URL so the
  //    image resolves correctly when the app is hosted under a sub-path
  //    (GH Pages). The SVG ships with `/anatomy/le-reference.png` (root-
  //    relative), which is fine for normal deploys; under a base path
  //    we need to prepend it.
  const meta = import.meta as unknown as { env?: { BASE_URL?: string } };
  const baseUrl = meta.env?.BASE_URL ?? '/';
  let out: string;
  if (baseUrl !== '/' && baseUrl) {
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    out = raw.replace(
      /(<image[^>]*\bhref=")\/anatomy\//,
      `$1${normalizedBase}/anatomy/`,
    );
  } else {
    out = raw;
  }

  // 0a) Force the root <svg> to fill its host. The source SVGs ship with
  //     only a `viewBox` (no `width`/`height`), and a few browsers fall
  //     back to the 300×150 default in that case — which would make the
  //     anatomy render at a different size than the sibling DrawingCanvas
  //     and break stroke alignment. Inject explicit 100%/100% so the box
  //     geometry is identical to the canvas overlay across all browsers.
  out = out.replace(
    /^(\s*<svg\b)([^>]*?)(>)/,
    (_match, head: string, attrs: string, tail: string) => {
      let next = attrs;
      if (!/\swidth=/.test(next)) next = ` width="100%"${next}`;
      if (!/\sheight=/.test(next)) next = ` height="100%"${next}`;
      return `${head}${next}${tail}`;
    },
  );

  // 1) Silhouette leg outline stroke -- theme-aware so it reads in dark mode.
  out = out.replace(
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
  //    Match the WHOLE element (opening tag + optional inner content +
  //    closing tag, OR self-closing form) so we can replace it cleanly
  //    with one or more sibling elements (overlay mode emits two paths).
  out = out.replace(
    /<path\s+id="([a-z0-9-]+)"([^>]*?)(?:>([\s\S]*?)<\/path>|\/>)/g,
    (_match: string, id: string, rest: string, inner: string | undefined) => {
      const innerContent = inner ?? '';
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
      // Overlay mode: emit TWO paths per segment.
      //   1. A wide TRANSPARENT path that owns the `id` and `data-segment-id`
      //      attributes — this is the click-target. ~20px in viewBox space
      //      gives a forgiving hit area on a line-art backdrop.
      //   2. A narrow COLORED path that renders the actual visible mask. At
      //      ~7px in viewBox space (~5px on a 480-px panel) the colored
      //      stroke sits tightly on the printed vein instead of bleeding
      //      ±11px on either side, which is what made small alignment
      //      offsets look much worse than they were.
      //
      // Both paths share the same `d` so the geometry is identical; only
      // the first one carries the segment id (event delegation matches the
      // first ancestor with `[data-segment-id]`).
      //
      // Calibration: append `?anatomy-debug=1` to the URL to make the
      // wide hit-zone path visible as a faint red mask — useful for
      // re-tracing path coordinates against a reference image.
      if (overlay) {
        const isFilled = segmentsMap.has(id);
        const debugMode =
          typeof window !== 'undefined' &&
          window.location.search.includes('anatomy-debug=1');
        const visibleColor = isFilled
          ? overlayStrokeFor(competency)
          : 'transparent';
        const hitZoneColor = debugMode ? 'rgba(220, 38, 38, 0.32)' : 'transparent';
        const hitZoneWidth = 20;
        const visibleWidth = isHighlighted ? 9 : 6;
        const dMatch = cleanRest.match(/\sd="([^"]*)"/);
        const staticD = dMatch ? dMatch[1] : '';
        const overrideD = pathOverrides?.get(id);
        const d = overrideD && overrideD.length > 0 ? overrideD : staticD;
        const cleanedNoD = cleanRest.replace(/\sd="[^"]*"/, '');
        // 1. Hit-zone path (carries id + data-segment-id) — keeps the
        //    original inner content (<title>) for accessibility.
        const hitZone = `<path id="${id}"${cleanedNoD} d="${d}" fill="transparent" stroke="${hitZoneColor}" stroke-width="${hitZoneWidth}" data-segment-id="${id}"${competencyAttr} pointer-events="stroke">${innerContent}</path>`;
        // 2. Visible color path — sibling of the hit-zone, no events.
        const colored = `<path d="${d}" fill="transparent" stroke="${visibleColor}" stroke-width="${visibleWidth}"${filterAttr} stroke-linecap="round" stroke-linejoin="round" pointer-events="none" />`;
        return hitZone + colored;
      }
      return `<path id="${id}"${cleanRest} fill="${fill}" stroke="${stroke}" stroke-width="${widthToApply}"${filterAttr} data-segment-id="${id}"${competencyAttr}>${innerContent}</path>`;
    },
  );

  return out;
}

/**
 * Translucent stroke color used to paint the segment overlay on top of
 * the printed PNG anatomy. Sourced directly from the canonical
 * `COMPETENCY_COLORS` table so the segment-table swatch, pen palette,
 * PDF, and overlay all agree.
 */
function overlayStrokeFor(competency: Competency): string {
  const entry = COMPETENCY_COLORS[competency as keyof typeof COMPETENCY_COLORS];
  return entry?.overlay ?? 'transparent';
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
  overlay = false,
  pathOverrides,
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
  const pathOverrideMap = useMemo(() => {
    if (!pathOverrides) return undefined;
    if (pathOverrides instanceof Map) return pathOverrides;
    const m = new Map<SegmentId, string>();
    for (const [k, v] of Object.entries(pathOverrides)) if (v) m.set(k, v);
    return m;
  }, [pathOverrides]);

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
      overlay,
      pathOverrideMap,
    );
  }, [rawSvg, segmentsMap, defaultCompetency, segmentStrokeWidth, highlightId, colorFn, overlay, pathOverrideMap]);

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
  // In overlay mode (drawing canvas stacked above), the wrapper must
  // fill the parent `.stage` exactly so its coordinate system matches the
  // sibling DrawingCanvas SVG. In standalone mode, keep the original
  // in-flow sizing so the component still works wherever it's rendered.
  const wrapperStyle: CSSProperties = overlay
    ? {
        position: 'absolute',
        inset: 0,
        touchAction: 'manipulation',
        ['--anatomy-segment-hover-stroke' as string]: `${segmentStrokeWidth + 1.5}px`,
      }
    : {
        position: 'relative',
        width: '100%',
        maxWidth: `${maxWidth}px`,
        margin: '0 auto',
        touchAction: 'manipulation',
        ['--anatomy-segment-hover-stroke' as string]: `${segmentStrokeWidth + 1.5}px`,
      };

  const svgHostStyle: CSSProperties = overlay
    ? { width: '100%', height: '100%', display: 'block' }
    : { width: '100%', display: 'block' };

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
  'cfv', 'fv-prox', 'fv-mid', 'fv-dist', 'pfv',
  'gsv-prox-thigh', 'gsv-mid-thigh', 'gsv-dist-thigh', 'gsv-knee', 'gsv-calf',
  'pop-ak', 'pop-bk',
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
