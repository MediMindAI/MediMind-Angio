// SPDX-License-Identifier: Apache-2.0
/**
 * Wave 4.9 — Part 10 MEDIUM (reflex-time / diameter implausibility gate).
 *
 * Covers:
 *   - Typing a reflux value > 3000 ms triggers a `window.confirm` and the
 *     value is REJECTED if the user cancels — the existing pathological
 *     warning (yellow icon) remains the soft signal; this is the hard one.
 *   - Typing an AP-diameter value > 25 mm triggers the same confirmation.
 *   - Confirmed values flow through to `onFindingChange`.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { ReflexTimeTable } from './ReflexTimeTable';
import { TranslationProvider } from '../../contexts/TranslationContext';
import type { VenousSegmentFindings } from '../studies/venous-le/config';

function renderWith(
  findings: VenousSegmentFindings,
  onFindingChange: (id: string, patch: object) => void,
): void {
  render(
    <MantineProvider>
      <TranslationProvider>
        <ReflexTimeTable
          findings={findings}
          onFindingChange={onFindingChange as never}
          showAllRows
          view="bilateral"
        />
      </TranslationProvider>
    </MantineProvider>,
  );
}

const SEED: VenousSegmentFindings = {
  'cfv-left': { compressibility: 'normal' },
};

describe('ReflexTimeTable — implausibility hard-reject gate (Wave 4.9)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects a reflux value > 3000 ms when the user cancels confirm()', () => {
    const onFindingChange = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderWith(SEED, onFindingChange);

    const input = screen.getByTestId(
      'num-cfv-left-refluxDurationMs',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '5000' } });
    fireEvent.blur(input);

    expect(confirmSpy).toHaveBeenCalled();
    expect(onFindingChange).not.toHaveBeenCalled();
  });

  it('accepts a reflux value > 3000 ms when the user confirms', () => {
    const onFindingChange = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWith(SEED, onFindingChange);

    const input = screen.getByTestId(
      'num-cfv-left-refluxDurationMs',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '5000' } });
    fireEvent.blur(input);

    expect(confirmSpy).toHaveBeenCalled();
    expect(onFindingChange).toHaveBeenCalledWith('cfv-left', { refluxDurationMs: 5000 });
  });

  it('does not prompt for typical reflux values (1500 ms) — soft warning still applies', () => {
    const onFindingChange = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWith(SEED, onFindingChange);

    const input = screen.getByTestId(
      'num-cfv-left-refluxDurationMs',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1500' } });
    fireEvent.blur(input);

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onFindingChange).toHaveBeenCalledWith('cfv-left', { refluxDurationMs: 1500 });
  });

  it('prompts confirm for AP diameter > 25 mm and rejects on cancel', () => {
    const onFindingChange = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderWith(SEED, onFindingChange);

    const input = screen.getByTestId(
      'num-cfv-left-apDiameterMm',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '40' } });
    fireEvent.blur(input);

    expect(confirmSpy).toHaveBeenCalled();
    expect(onFindingChange).not.toHaveBeenCalled();
  });
});
