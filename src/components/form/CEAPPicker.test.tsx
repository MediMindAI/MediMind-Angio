// SPDX-License-Identifier: Apache-2.0
/**
 * Wave 4.5 — Area 02 MEDIUM (CEAP modifier rules).
 *
 * Verifies CEAP 2020 invariants:
 *   - `s` (symptomatic) and `a` (asymptomatic) are mutually exclusive
 *   - `n` is disabled when any of c/e/a/p has an active finding
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { TranslationProvider } from '../../contexts/TranslationContext';
import { CEAPPicker } from './CEAPPicker';
import type { CeapClassification } from '../../types/ceap';

function Wrap({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <MantineProvider>
      <TranslationProvider>{children}</TranslationProvider>
    </MantineProvider>
  );
}

function openSection(): void {
  // EMRCollapsibleSection mounts its toggle as a role="button" inside the
  // outer paper that carries `data-testid="ceap-section"`.
  const section = screen.getByTestId('ceap-section');
  const toggle = section.querySelector('[role="button"]') as HTMLElement;
  fireEvent.click(toggle);
}

describe('CEAPPicker — modifier mutual exclusion (Wave 4.5)', () => {
  it('removes `s` when `a` is checked', () => {
    const onChange = vi.fn();
    const value: CeapClassification = {
      c: 'C0', e: 'En', a: 'An', p: 'Pn',
      modifiers: ['s'],
    };
    render(
      <Wrap>
        <CEAPPicker value={value} onChange={onChange} />
      </Wrap>,
    );
    openSection();

    const aInput = screen.getByTestId('ceap-modifier-a') as HTMLInputElement;
    fireEvent.click(aInput);

    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1]![0] as CeapClassification;
    expect(lastCall.modifiers).toContain('a');
    expect(lastCall.modifiers).not.toContain('s');
  });

  it('removes `a` when `s` is checked', () => {
    const onChange = vi.fn();
    const value: CeapClassification = {
      c: 'C0', e: 'En', a: 'An', p: 'Pn',
      modifiers: ['a'],
    };
    render(
      <Wrap>
        <CEAPPicker value={value} onChange={onChange} />
      </Wrap>,
    );
    openSection();

    const sInput = screen.getByTestId('ceap-modifier-s') as HTMLInputElement;
    fireEvent.click(sInput);

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1]![0] as CeapClassification;
    expect(lastCall.modifiers).toContain('s');
    expect(lastCall.modifiers).not.toContain('a');
  });
});

describe('CEAPPicker — `n` modifier gating (Wave 4.5)', () => {
  it('disables `n` when c is non-baseline (e.g. C2)', () => {
    const onChange = vi.fn();
    const value: CeapClassification = {
      c: 'C2', e: 'En', a: 'An', p: 'Pn',
      modifiers: [],
    };
    render(
      <Wrap>
        <CEAPPicker value={value} onChange={onChange} />
      </Wrap>,
    );
    openSection();

    const nInput = screen.getByTestId('ceap-modifier-n') as HTMLInputElement;
    expect(nInput.disabled).toBe(true);
  });

  it('enables `n` when all axes are baseline (C0/En/An/Pn)', () => {
    const onChange = vi.fn();
    const value: CeapClassification = {
      c: 'C0', e: 'En', a: 'An', p: 'Pn',
      modifiers: [],
    };
    render(
      <Wrap>
        <CEAPPicker value={value} onChange={onChange} />
      </Wrap>,
    );
    openSection();

    const nInput = screen.getByTestId('ceap-modifier-n') as HTMLInputElement;
    expect(nInput.disabled).toBe(false);
  });
});
