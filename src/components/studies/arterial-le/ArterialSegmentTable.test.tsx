// SPDX-License-Identifier: Apache-2.0
/**
 * ArterialSegmentTable — screen-reader names in Georgian (UX-ANGIO-020).
 *
 * Before: every control's accessible name ended in an English word
 * ('… R waveform', '… L occluded'), even in the Georgian UI. The names now
 * reuse the column-header keys; clinical abbreviations (CFA, PSV, R/L) stay.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { TranslationProvider } from '../../../contexts/TranslationContext';
import { STORAGE_KEYS } from '../../../constants/storage-keys';
import { ArterialSegmentTable } from './ArterialSegmentTable';
import type { ArterialSegmentTableProps } from './ArterialSegmentTable';

describe('ArterialSegmentTable — Georgian accessible names', () => {
  beforeEach(() => {
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, 'ka');
  });

  it('names controls with Georgian field words, not English', async () => {
    render(
      <MantineProvider>
        <TranslationProvider>
          <ArterialSegmentTable
            findings={{} as ArterialSegmentTableProps['findings']}
            view="right"
            onFindingChange={vi.fn()}
          />
        </TranslationProvider>
      </MantineProvider>,
    );
    await screen.findByText('სეგმენტური შეფასება', {}, { timeout: 20_000 });
    const names = [...document.querySelectorAll('[aria-label]')].map(
      (el) => el.getAttribute('aria-label') ?? '',
    );
    expect(names.some((n) => n.endsWith('ტალღური ფორმა'))).toBe(true);
    expect(names.some((n) => n.endsWith('ოკლ.'))).toBe(true);
    expect(names.filter((n) => /waveform|stenosis|plaque|occluded/.test(n))).toEqual([]);
  });

  it('renders its section title as a level-2 heading (UX-ANGIO-018 carry-over)', async () => {
    render(
      <MantineProvider>
        <TranslationProvider>
          <ArterialSegmentTable
            findings={{} as ArterialSegmentTableProps['findings']}
            view="bilateral"
            onFindingChange={vi.fn()}
          />
        </TranslationProvider>
      </MantineProvider>,
    );
    const heading = await screen.findByRole(
      'heading',
      { level: 2, name: 'სეგმენტური შეფასება' },
      { timeout: 20_000 },
    );
    expect(heading.id).toBe('arterial-segment-title');
  });
});
