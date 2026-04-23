/**
 * anatomyToPdfSvg — converts our tagged anatomy SVG assets into a shape that
 * @react-pdf/renderer can render.
 *
 * @react-pdf does NOT parse raw SVG markup. You must hand it structured
 * primitives (<Svg>, <Path>, <Circle>, ...). This module reads the raw SVG
 * text for an anatomy view, extracts the `<path>` elements (both
 * `#silhouette` outline paths and `#segments` vein paths), and returns a
 * plain data structure the DiagramSection consumes.
 *
 * Both fetch (browser) and readFile (Node) code-paths are provided. The
 * right one is selected automatically based on whether `window` exists.
 *
 * Plain-language: the web diagram is a regular SVG. The PDF needs the same
 * drawing but spelled out path-by-path as React components. This helper
 * does that translation.
 */
import type { Competency } from '../../types/anatomy';
import type { VenousLESegmentBase, VenousSegmentFindings } from '../studies/venous-le/config';
import { deriveCompetency } from '../studies/venous-le/config';
import { COMPETENCY_COLORS } from '../../constants/theme-colors';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type AnatomyViewName = 'le-anterior' | 'le-posterior';

export interface PdfSvgElement {
  readonly kind: 'segment' | 'outline';
  /** Canonical segment id, present only for kind='segment'. */
  readonly id?: string;
  readonly d: string;
  readonly fill: string;
  readonly stroke: string;
  readonly strokeWidth: number;
}

export interface AnatomyToPdfResult {
  readonly viewBox: string;
  readonly elements: ReadonlyArray<PdfSvgElement>;
}

// ---------------------------------------------------------------------------
// SVG loading — browser vs node
// ---------------------------------------------------------------------------

/**
 * Cache the raw SVG text keyed by view so generating many PDFs in one
 * session doesn't re-fetch/re-read the files.
 */
const rawCache = new Map<AnatomyViewName, string>();

/**
 * Read the raw SVG text for a view. Uses `fetch` in browsers and Node's
 * `fs.promises.readFile` when run under Node/tsx.
 */
export async function loadRawAnatomySvg(view: AnatomyViewName): Promise<string> {
  const cached = rawCache.get(view);
  if (cached !== undefined) return cached;

  const isBrowser = typeof window !== 'undefined' && typeof fetch === 'function';

  let text: string;
  if (isBrowser) {
    // In the browser, Vite serves public/ from the site root. Respect any
    // configured base path so GH Pages deploys still resolve correctly.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = import.meta as unknown as { env?: { BASE_URL?: string } };
    const base: string = meta.env?.BASE_URL ?? '/';
    const normalizedBase = base.endsWith('/') ? base : `${base}/`;
    const url = `${normalizedBase}anatomy/${view}.svg`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to load anatomy SVG "${view}": ${response.status} ${response.statusText}`
      );
    }
    text = await response.text();
  } else {
    // Node path — lazy-import fs/path so the browser bundle never pulls them.
    // We build the specifier strings at runtime to prevent Vite's static
    // analyzer from touching them (it can't statically see dynamic concatenated
    // specifiers, so the browser bundle stays clean).
    const fsSpecifier = 'node:' + 'fs/promises';
    const pathSpecifier = 'node:' + 'path';
    const fsMod = await import(/* @vite-ignore */ fsSpecifier);
    const pathMod = await import(/* @vite-ignore */ pathSpecifier);
    const filePath = pathMod.resolve(process.cwd(), 'public', 'anatomy', `${view}.svg`);
    text = await fsMod.readFile(filePath, 'utf-8');
  }

  rawCache.set(view, text);
  return text;
}

// ---------------------------------------------------------------------------
// SVG parsing
// ---------------------------------------------------------------------------

/**
 * Extract the `viewBox` attribute value from a raw SVG string.
 */
function extractViewBox(raw: string): string {
  const match = raw.match(/<svg\b[^>]*\bviewBox="([^"]+)"/);
  return match?.[1] ?? '0 0 600 900';
}

interface PathWithSection {
  readonly section: 'segments' | 'silhouette' | 'outline';
  readonly id?: string;
  readonly d: string;
}

/**
 * Extract `<path>` elements from the raw SVG, tagged by which `<g>` they
 * live under (silhouette vs segments). We rely on the stable structure of
 * our own `le-anterior.svg` / `le-posterior.svg` files:
 *   - `<g id="silhouette"> <path d="..." /> <path d="..." /> </g>`
 *   - `<g id="pelvis-hint"> <path d="..." /> </g>`
 *   - `<g id="segments"> <path id="cfv-left" d="..."> ... </g>`
 *
 * We use a simple regex-splitter approach (rather than DOMParser) because
 * the SVGs are ours and well-formed, and DOMParser isn't available in Node.
 */
function extractPaths(raw: string): ReadonlyArray<PathWithSection> {
  const results: PathWithSection[] = [];

  const collectPathsInGroup = (
    groupId: 'silhouette' | 'pelvis-hint' | 'segments'
  ): void => {
    const groupRe = new RegExp(`<g\\s+id="${groupId}"[^>]*>([\\s\\S]*?)</g>`);
    const groupMatch = raw.match(groupRe);
    if (!groupMatch?.[1]) return;
    const inner = groupMatch[1];

    const pathRe = /<path\b([^>]*?)(?:\/>|>[\s\S]*?<\/path>)/g;
    let m: RegExpExecArray | null;
    while ((m = pathRe.exec(inner)) !== null) {
      const attrs = m[1] ?? '';
      const dMatch = attrs.match(/\bd="([^"]+)"/);
      const idMatch = attrs.match(/\bid="([^"]+)"/);
      if (!dMatch?.[1]) continue;
      const section: PathWithSection['section'] =
        groupId === 'segments'
          ? 'segments'
          : groupId === 'silhouette'
            ? 'silhouette'
            : 'outline';
      results.push({
        section,
        d: dMatch[1],
        ...(idMatch?.[1] ? { id: idMatch[1] } : {}),
      });
    }
  };

  collectPathsInGroup('silhouette');
  collectPathsInGroup('pelvis-hint');
  collectPathsInGroup('segments');

  return results;
}

// ---------------------------------------------------------------------------
// Segment id → competency derivation
// ---------------------------------------------------------------------------

/**
 * Split a full segment id like "gsv-ak-left" into base + side. Returns
 * `null` if the id doesn't end in a known side suffix.
 */
function splitSegmentId(
  fullId: string
): { base: VenousLESegmentBase; side: 'left' | 'right' } | null {
  if (fullId.endsWith('-left')) {
    return { base: fullId.slice(0, -5) as VenousLESegmentBase, side: 'left' };
  }
  if (fullId.endsWith('-right')) {
    return { base: fullId.slice(0, -6) as VenousLESegmentBase, side: 'right' };
  }
  return null;
}

/**
 * Derive the competency + colors for a segment id given the current
 * findings map. Uses the venous-le `deriveCompetency` helper so the PDF
 * stays in lock-step with the on-screen diagram.
 */
function colorsForSegment(
  fullId: string,
  findings: VenousSegmentFindings
): { competency: Competency; fill: string; stroke: string } {
  const split = splitSegmentId(fullId);
  let competency: Competency = 'normal';

  if (split) {
    const key = `${split.base}-${split.side}` as keyof typeof findings;
    const finding = findings[key];
    competency = deriveCompetency(split.base, finding);
  }

  const { fill, stroke } = COMPETENCY_COLORS[competency];
  return { competency, fill, stroke };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load + parse an anatomy view, assigning competency colors to each segment
 * path based on the supplied findings map. The result is consumed directly
 * by `DiagramSection` to emit `<Svg>` + `<Path>` children.
 */
export async function loadAnatomyForPdf(
  view: AnatomyViewName,
  findings: VenousSegmentFindings,
  options?: {
    readonly outlineStroke?: string;
    readonly outlineStrokeWidth?: number;
    readonly segmentStrokeWidth?: number;
  }
): Promise<AnatomyToPdfResult> {
  const raw = await loadRawAnatomySvg(view);
  const viewBox = extractViewBox(raw);
  const paths = extractPaths(raw);

  const outlineStroke = options?.outlineStroke ?? '#cbd5e0';
  const outlineStrokeWidth = options?.outlineStrokeWidth ?? 1.25;
  const segmentStrokeWidth = options?.segmentStrokeWidth ?? 4;

  const elements: PdfSvgElement[] = [];

  for (const p of paths) {
    if (p.section === 'segments') {
      if (!p.id) continue;
      const { fill, stroke } = colorsForSegment(p.id, findings);
      elements.push({
        kind: 'segment',
        id: p.id,
        d: p.d,
        fill,
        stroke,
        strokeWidth: segmentStrokeWidth,
      });
    } else {
      elements.push({
        kind: 'outline',
        d: p.d,
        fill: p.section === 'silhouette' ? '#f7fafc' : 'none',
        stroke: outlineStroke,
        strokeWidth: outlineStrokeWidth,
      });
    }
  }

  return { viewBox, elements };
}

/** Testing / diagnostic helper — expose the cached raw size. */
export function __anatomyPdfCacheSize(): number {
  return rawCache.size;
}
