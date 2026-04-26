// SPDX-License-Identifier: Apache-2.0
/**
 * Wave 3.3 — Area 01 MEDIUM guard.
 *
 * `loadAnatomySvg` MUST reject HTML soft-error pages (e.g. a 200-status SPA
 * fallback that happens to contain the substring `<svg`). Without a strict
 * prefix check, a misconfigured static host could feed an entire HTML
 * document into the SVG render path, causing the anatomy panel to silently
 * render nothing or worse — leak unrelated markup.
 *
 * These tests also cover the happy-path: a real `<?xml ...?>`-prefixed SVG
 * and a leading-whitespace `<svg>` payload both resolve cleanly.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __clearAnatomySvgCache, loadAnatomySvg } from './svgLoader';

const REAL_SVG = '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg"></svg>';
const SVG_WITH_LEADING_WS = '   \n  <svg xmlns="http://www.w3.org/2000/svg"></svg>';
const HTML_404 = '<!doctype html><html><head><title>404</title></head><body><p>Not found — see <svg> for our logo</p></body></html>';

function mockFetch(body: string, init: { ok?: boolean; status?: number; contentType?: string } = {}): void {
  const headers = new Map<string, string>();
  if (init.contentType) headers.set('content-type', init.contentType);
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.ok === false ? 'Not Found' : 'OK',
    text: async () => body,
    headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
  })));
}

describe('loadAnatomySvg', () => {
  beforeEach(() => {
    __clearAnatomySvgCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('resolves when the response body starts with an `<?xml ...?>` prolog', async () => {
    mockFetch(REAL_SVG, { contentType: 'image/svg+xml' });
    await expect(loadAnatomySvg('le-anterior')).resolves.toContain('<svg');
  });

  it('resolves when the response body starts with `<svg` after leading whitespace', async () => {
    mockFetch(SVG_WITH_LEADING_WS, { contentType: 'image/svg+xml' });
    await expect(loadAnatomySvg('le-posterior')).resolves.toContain('<svg');
  });

  it('rejects an HTML 404 page that contains the substring `<svg` somewhere in the body', async () => {
    // Note: the response is `ok: true` here to specifically exercise the
    // content-shape check (not the status-code check). A misconfigured SPA
    // host can serve 200 + HTML for any unmatched path.
    mockFetch(HTML_404);
    await expect(loadAnatomySvg('le-arterial-anterior')).rejects.toThrow(/Invalid SVG content/);
  });

  it('rejects when the response status is not OK', async () => {
    mockFetch('<svg></svg>', { ok: false, status: 404 });
    await expect(loadAnatomySvg('neck-carotid')).rejects.toThrow(/Failed to load anatomy SVG/);
  });

  it('warns on unexpected content-type but still returns the body', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockFetch(REAL_SVG, { contentType: 'text/plain' });
    await expect(loadAnatomySvg('le-anterior')).resolves.toContain('<svg');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('unexpected content-type'),
      'text/plain',
    );
    warnSpy.mockRestore();
  });

  it('does not warn when content-type is image/svg+xml', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockFetch(REAL_SVG, { contentType: 'image/svg+xml; charset=utf-8' });
    await loadAnatomySvg('le-posterior');
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('evicts a failed fetch from the cache so a retry can succeed', async () => {
    // First attempt: bad HTML body.
    mockFetch(HTML_404);
    await expect(loadAnatomySvg('le-anterior')).rejects.toThrow();

    // Retry: real SVG. Must hit fetch again (cache evicted on failure).
    mockFetch(REAL_SVG, { contentType: 'image/svg+xml' });
    await expect(loadAnatomySvg('le-anterior')).resolves.toContain('<svg');
  });
});
