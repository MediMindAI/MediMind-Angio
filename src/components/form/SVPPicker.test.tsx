// SPDX-License-Identifier: Apache-2.0
/**
 * SVPPicker — S/V "none" exclusivity + repeatable P-row behaviour.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { TranslationProvider } from '../../contexts/TranslationContext';
import { SVPPicker } from './SVPPicker';
import type { SvpClassification } from '../../types/svp';

function Wrap({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <MantineProvider>
      <TranslationProvider>{children}</TranslationProvider>
    </MantineProvider>
  );
}

function openSection(): void {
  const section = screen.getByTestId('svp-section');
  const toggle = section.querySelector('[role="button"]') as HTMLElement;
  fireEvent.click(toggle);
}

const EMPTY: SvpClassification = { s: ['S0'], v: ['V0'], p: [] };

describe('SVPPicker — S/V exclusivity', () => {
  it('selecting a real S code drops S0', () => {
    const onChange = vi.fn();
    render(
      <Wrap>
        <SVPPicker value={EMPTY} onChange={onChange} />
      </Wrap>,
    );
    openSection();
    fireEvent.click(screen.getByTestId('svp-s-S2'));
    const last = onChange.mock.calls.at(-1)![0] as SvpClassification;
    expect(last.s).toContain('S2');
    expect(last.s).not.toContain('S0');
  });

  it('selecting S0 clears other S codes', () => {
    const onChange = vi.fn();
    render(
      <Wrap>
        <SVPPicker value={{ s: ['S2'], v: ['V0'], p: [] }} onChange={onChange} />
      </Wrap>,
    );
    openSection();
    fireEvent.click(screen.getByTestId('svp-s-S0'));
    const last = onChange.mock.calls.at(-1)![0] as SvpClassification;
    expect(last.s).toEqual(['S0']);
  });
});

describe('SVPPicker — repeatable P rows', () => {
  it('Add segment appends a P row with a stable id (audit M5)', () => {
    const onChange = vi.fn();
    render(
      <Wrap>
        <SVPPicker value={EMPTY} onChange={onChange} />
      </Wrap>,
    );
    openSection();
    fireEvent.click(screen.getByTestId('svp-p-add'));
    const last = onChange.mock.calls.at(-1)![0] as SvpClassification;
    expect(last.p).toHaveLength(1);
    expect(last.p[0]?.segment).toBe('CIV');
    expect(typeof last.p[0]?.id).toBe('string');
    expect(last.p[0]?.id).toBeTruthy();
  });

  it('removing a middle row keeps the correct remaining rows', () => {
    const onChange = vi.fn();
    const value: SvpClassification = {
      s: ['S0'],
      v: ['V0'],
      p: [
        { id: 'a', segment: 'IVC', hemodynamics: ['O'], etiology: 'NT' },
        { id: 'b', segment: 'CIV', laterality: 'L', hemodynamics: ['R'], etiology: 'T' },
        { id: 'c', segment: 'EIV', laterality: 'R', hemodynamics: ['O'], etiology: 'NT' },
      ],
    };
    render(
      <Wrap>
        <SVPPicker value={value} onChange={onChange} />
      </Wrap>,
    );
    openSection();
    // Remove the middle row (index 1).
    fireEvent.click(screen.getByTestId('svp-p-remove-1'));
    const last = onChange.mock.calls.at(-1)![0] as SvpClassification;
    expect(last.p.map((r) => r.id)).toEqual(['a', 'c']);
  });
});
