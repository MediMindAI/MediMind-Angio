/**
 * svgLoader — lazy-loads raw anatomical SVG text for a given view.
 *
 * The SVG files live in `public/anatomy/*.svg` (not bundled — served as
 * static assets). We `fetch()` them through `import.meta.env.BASE_URL`
 * so the GitHub Pages deploy works with a non-root `VITE_BASE_PATH`.
 *
 * Results are cached per-view (module-level Map) so repeated mounts of
 * `AnatomyView` don't re-fetch the same file.
 */

export type AnatomyView =
  | 'le-anterior'
  | 'le-posterior'
  | 'abdominal-pelvic'
  | 'le-arterial'
  | 'le-arterial-anterior'
  | 'carotid'
  | 'neck-carotid'
  | 'dialysis-access';

/** In-flight + completed cache, keyed by view. */
const svgCache = new Map<AnatomyView, Promise<string>>();

/**
 * Load the raw SVG markup for a view. Returns a promise that resolves
 * to the SVG source text (including `<?xml ...?>` prolog).
 *
 * Throws if the SVG cannot be fetched or the response is not OK.
 */
export async function loadAnatomySvg(view: AnatomyView): Promise<string> {
  const cached = svgCache.get(view);
  if (cached) return cached;

  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const url = `${normalizedBase}anatomy/${view}.svg`;

  const promise = (async (): Promise<string> => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load anatomy SVG "${view}": ${response.status} ${response.statusText}`);
      }
      const text = await response.text();
      // Strict-prefix check rejects HTML 404 / soft-error pages that happen
      // to contain `<svg>` somewhere in the body. A real SVG asset starts
      // with either an `<?xml ...?>` prolog or `<svg ...>` directly.
      const trimmed = text.trimStart();
      if (!(trimmed.startsWith('<?xml') || trimmed.startsWith('<svg'))) {
        throw new Error(`Invalid SVG content for view "${view}"`);
      }
      // Soft content-type sanity check — some static hosts serve `.svg`
      // as `text/plain`, so we warn rather than throw.
      const ct = response.headers.get('content-type');
      if (ct && !ct.includes('image/svg+xml') && !ct.includes('text/xml') && !ct.includes('application/xml')) {
        console.warn('[svgLoader] unexpected content-type:', ct);
      }
      return text;
    } catch (err) {
      // Evict the failed promise so a retry can attempt the fetch again.
      svgCache.delete(view);
      throw err;
    }
  })();

  svgCache.set(view, promise);
  return promise;
}

/** Test helper — clear the cache (not exported from barrel). */
export function __clearAnatomySvgCache(): void {
  svgCache.clear();
}
