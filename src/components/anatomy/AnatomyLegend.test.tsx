// SPDX-License-Identifier: Apache-2.0
/** UX-ANGIO-022 — every legend swatch carries a theme hairline ring so the
 *  near-black occlusion swatch stays visible on a dark card. */

import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { TranslationProvider } from '../../contexts/TranslationContext';
import { AnatomyLegend } from './AnatomyLegend';

describe('AnatomyLegend', () => {
  it('rings every swatch with the theme hairline token', () => {
    const { container } = render(
      <MantineProvider>
        <TranslationProvider>
          <AnatomyLegend />
        </TranslationProvider>
      </MantineProvider>,
    );
    const swatches = container.querySelectorAll<HTMLElement>('span[aria-hidden="true"]');
    expect(swatches.length).toBe(5);
    swatches.forEach((s) => {
      expect(s.style.boxShadow).toContain('var(--emr-border-secondary)');
    });
  });
});
