// SPDX-License-Identifier: Apache-2.0
/**
 * Wave 4.9 — Part 10 MEDIUM (reflex-time / diameter implausibility gate).
 *
 * Covers:
 *   - Typing a reflux value > 10 s (input is in seconds) triggers a `window.confirm` and the
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

  it('rejects a reflux value > 10 s when the user cancels confirm()', () => {
    const onFindingChange = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderWith(SEED, onFindingChange);

    const input = screen.getByTestId(
      'num-cfv-left-refluxDurationMs',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '15' } });
    fireEvent.blur(input);

    expect(confirmSpy).toHaveBeenCalled();
    expect(onFindingChange).not.toHaveBeenCalled();
  });

  it('accepts a reflux value > 10 s when the user confirms', () => {
    const onFindingChange = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWith(SEED, onFindingChange);

    const input = screen.getByTestId(
      'num-cfv-left-refluxDurationMs',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '15' } });
    fireEvent.blur(input);

    expect(confirmSpy).toHaveBeenCalled();
    expect(onFindingChange).toHaveBeenCalledWith('cfv-left', { refluxDurationMs: 15000 });
  });

  it('does not prompt for typical reflux values (3.2 s) — soft warning still applies', () => {
    const onFindingChange = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWith(SEED, onFindingChange);

    const input = screen.getByTestId(
      'num-cfv-left-refluxDurationMs',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '3.2' } });
    fireEvent.blur(input);

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onFindingChange).toHaveBeenCalledWith('cfv-left', { refluxDurationMs: 3200 });
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

describe('ReflexTimeTable — headless rows keep their segment name (UX-ANGIO-004 L1)', () => {
  it('renders the segment name + side badge on every headless row', () => {
    const { container } = render(
      <MantineProvider>
        <TranslationProvider>
          <ReflexTimeTable
            findings={{}}
            onFindingChange={vi.fn() as never}
            showAllRows
            headless
            view="bilateral"
          />
        </TranslationProvider>
      </MantineProvider>,
    );
    const rows = Array.from(container.querySelectorAll('[role="row"]')).filter((r) =>
      r.querySelector('[data-testid^="num-"]'),
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const badge = row.querySelector('[data-side]');
      expect(badge?.textContent).toMatch(/^[LR]$/);
      // The name cell (hidden at lg+ by CSS, visible when the tables stack).
      expect(badge?.previousElementSibling?.textContent?.trim()).not.toBe('');
    }
    const gsv = screen.getByTestId('num-gsv-prox-thigh-right-refluxDurationMs').closest('[role="row"]');
    expect(gsv?.querySelector('[data-side="right"]')?.textContent).toBe('R');
  });
});

describe('ReflexTimeTable — section title is a real heading (UX-ANGIO-018)', () => {
  it('renders the card title as an h2', () => {
    renderWith(SEED, vi.fn());
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveAttribute('id', 'reflex-table-title');
  });
});
