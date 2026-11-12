// SPDX-License-Identifier: Apache-2.0
/**
 * SegmentalPressureTable — Right side first (UX-ANGIO-004 L4 / U-1023), matching
 * every other side control and the PDF pressure table.
 */

/// <reference types="@testing-library/jest-dom" />

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { TranslationProvider } from '../../../contexts/TranslationContext';
import { SegmentalPressureTable } from './SegmentalPressureTable';

function Wrap({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <MantineProvider>
      <TranslationProvider>{children}</TranslationProvider>
    </MantineProvider>
  );
}

describe('SegmentalPressureTable', () => {
  it('lists the Right column before the Left column', () => {
    render(
      <Wrap>
        <SegmentalPressureTable pressures={{}} onChange={vi.fn()} />
      </Wrap>,
    );
    const sides = screen
      .getAllByRole('columnheader')
      .map((el) => el.getAttribute('data-side'))
      .filter((s) => s !== null);
    expect(sides).toEqual(['right', 'left']);

    const right = screen.getByTestId('pressure-brachial-R');
    const left = screen.getByTestId('pressure-brachial-L');
    // DOCUMENT_POSITION_FOLLOWING: the Left input comes after the Right one.
    expect(right.compareDocumentPosition(left) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
