// SPDX-License-Identifier: Apache-2.0
/**
 * Wave 3.3 — Area 01 HIGH guard (dark-mode label visibility).
 *
 * The four shipped anatomy SVGs hardcode light-mode fills on
 * `<g id="side-labels" fill="#4a5568">` (R/L letters) and
 * `<g id="junction-dots" fill="#1a365d">` (anatomical landmarks).
 * On a dark page background (`--emr-bg-page` ≈ `#0f172a`) those colors
 * become nearly invisible. R/L confusion on a vascular map is a
 * clinical-safety smell, so `colorizeSvg` MUST rewrite both fills to
 * theme-token values that follow light/dark automatically.
 *
 * These tests stub `loadAnatomySvg` so we can render `AnatomyView` in
 * isolation and assert the post-colorize markup contains the expected
 * theme tokens.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { TranslationProvider } from '../../contexts/TranslationContext';
import { AnatomyView } from './AnatomyView';
import * as svgLoader from './svgLoader';

// Minimal SVG fixture — has both groups with the same shipped fills as
// the real `public/anatomy/le-arterial-anterior.svg` and `neck-carotid.svg`.
const SVG_WITH_LABELS_AND_DOTS = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 200">',
  '  <g id="silhouette" fill="#f7fafc" stroke="#cbd5e0"></g>',
  '  <g id="pelvis-hint" fill="none" stroke="#cbd5e0"></g>',
  '  <g id="side-labels" font-size="14" fill="#4a5568" text-anchor="middle">',
  '    <text x="20" y="20">R</text>',
  '    <text x="80" y="20">L</text>',
  '  </g>',
  '  <g id="segments" fill="none" stroke="#1a365d" stroke-width="3"></g>',
  '  <g id="junction-dots" fill="#1a365d" stroke="none">',
  '    <circle cx="50" cy="50" r="3"></circle>',
  '  </g>',
  '</svg>',
].join('\n');

function renderInProviders(view: 'le-arterial-anterior' | 'neck-carotid' | 'le-anterior') {
  return render(
    <MantineProvider defaultColorScheme="dark">
      <TranslationProvider>
        <AnatomyView view={view} segments={{}} />
      </TranslationProvider>
    </MantineProvider>,
  );
}

describe('AnatomyView — dark-mode label colorize', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rewrites the side-labels fill to var(--emr-text-primary) so R/L letters track the theme', async () => {
    vi.spyOn(svgLoader, 'loadAnatomySvg').mockResolvedValue(SVG_WITH_LABELS_AND_DOTS);

    const { container } = renderInProviders('le-arterial-anterior');

    await waitFor(() => {
      const html = container.innerHTML;
      expect(html).toMatch(/<g id="side-labels"[^>]*fill="var\(--emr-text-primary\)"/);
    });

    // Negative assertion: the original light-mode hex must be gone from the
    // side-labels group attribute (it can still appear elsewhere in the SVG).
    const sideLabelsMatch = container.innerHTML.match(/<g id="side-labels"[^>]*>/);
    expect(sideLabelsMatch).not.toBeNull();
    expect(sideLabelsMatch?.[0]).not.toContain('#4a5568');
  });

  it('rewrites the junction-dots fill to var(--emr-text-secondary) so landmark dots stay visible on dark', async () => {
    vi.spyOn(svgLoader, 'loadAnatomySvg').mockResolvedValue(SVG_WITH_LABELS_AND_DOTS);

    const { container } = renderInProviders('neck-carotid');

    await waitFor(() => {
      const html = container.innerHTML;
      expect(html).toMatch(/<g id="junction-dots"[^>]*fill="var\(--emr-text-secondary\)"/);
    });

    const dotsMatch = container.innerHTML.match(/<g id="junction-dots"[^>]*>/);
    expect(dotsMatch).not.toBeNull();
    // The original deep-navy fill must NOT remain on the junction-dots group.
    expect(dotsMatch?.[0]).not.toMatch(/fill="#1a365d"/);
  });

  it('keeps the existing silhouette + pelvis-hint stroke rewrites working', async () => {
    vi.spyOn(svgLoader, 'loadAnatomySvg').mockResolvedValue(SVG_WITH_LABELS_AND_DOTS);

    const { container } = renderInProviders('le-anterior');

    await waitFor(() => {
      const html = container.innerHTML;
      expect(html).toMatch(/<g id="silhouette"[^>]*stroke="var\(--emr-text-primary\)"/);
      expect(html).toMatch(/<g id="pelvis-hint"[^>]*stroke="var\(--emr-text-primary\)"/);
    });
  });
});
