// SPDX-License-Identifier: Apache-2.0
/**
 * NASCETPicker — Georgian labels only (U-1006 / UX-ANGIO-020 L3).
 *
 * Before: every option carried an always-English code chip ('Normal',
 * 'Near-occlusion', 'Occluded') next to the Georgian label, and the header
 * preview read 'R: Normal · L: —' in the Georgian UI.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { TranslationProvider } from '../../../contexts/TranslationContext';
import { STORAGE_KEYS } from '../../../constants/storage-keys';
import { NASCETPicker } from './NASCETPicker';
import type { CarotidFindings } from './config';

function renderKa(): void {
  render(
    <MantineProvider>
      <TranslationProvider>
        <NASCETPicker
          findings={{} as CarotidFindings}
          value={{ right: 'normal', left: 'near-occlusion' }}
          onChange={vi.fn()}
        />
      </TranslationProvider>
    </MantineProvider>,
  );
}

describe('NASCETPicker — Georgian UI', () => {
  beforeEach(() => {
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, 'ka');
  });

  it('shows no English category words in the options', async () => {
    renderKa();
    const nearOcclusion = await screen.findByTestId('nascet-right-near-occlusion');
    await screen.findByText('სუბოკლუზია', { selector: '[data-testid="nascet-right-near-occlusion"] *' }, { timeout: 20_000 });
    expect(nearOcclusion.textContent).toBe('სუბოკლუზია');
    expect(screen.getByTestId('nascet-right-normal').textContent).toBe('ნორმა');
    expect(screen.getByTestId('nascet-right-occluded').textContent).toBe('ოკლუზია');
    // Percent ranges print once, not twice (code chip + identical label).
    expect(screen.getByTestId('nascet-right-lt50').textContent).toBe('< 50 %');
  });

  it('translates the category in the header preview', async () => {
    renderKa();
    expect(await screen.findByText('R: ნორმა · L: სუბოკლუზია', {}, { timeout: 20_000 })).toBeTruthy();
    expect(screen.queryByText(/Normal|Near-occlusion|Occluded/)).toBeNull();
  });
});
