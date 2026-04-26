// SPDX-License-Identifier: Apache-2.0
/**
 * Wave 4.5 — Area 02 MEDIUM (ImpressionBlock auto-fill no-op).
 *
 * The auto-fill effect must compare `autoText` against the actual stored
 * `value`, not its own internal `lastAutoRef`. Previously, a parent re-render
 * that produced an identical auto-narrative still triggered an extra
 * onChange because the ref was reset on first run. After the fix, identical
 * autoText vs identical value should produce zero onChange calls.
 */

import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { TranslationProvider } from '../../contexts/TranslationContext';
import { ImpressionBlock } from './ImpressionBlock';
import type { VenousSegmentFindings } from '../studies/venous-le/config';

// Stub narrative service so we get a deterministic, stable auto-narrative.
vi.mock('../../services/narrativeService', () => ({
  buildLocalizedNarrative: (_findings: unknown, _t: unknown) => ({
    rightFindings: 'rf',
    leftFindings: 'lf',
    conclusions: ['c1'],
  }),
}));

function Wrap({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <MantineProvider>
      <TranslationProvider>{children}</TranslationProvider>
    </MantineProvider>
  );
}

describe('ImpressionBlock — auto-fill is a no-op when value already matches autoText', () => {
  it('does not fire onChange on parent re-render when autoText === value (Wave 4.5)', () => {
    const onChange = vi.fn();
    const findings: VenousSegmentFindings = {};

    // ImpressionBlock passes a default-value to t() for each heading, so
    // before translations load the auto-narrative uses the English defaults.
    const expected = [
      'Right lower extremity — findings\nrf',
      'Left lower extremity — findings\nlf',
      'Conclusions\n• c1',
    ].join('\n\n');

    const { rerender } = render(
      <Wrap>
        <ImpressionBlock
          findings={findings}
          value={expected}
          edited={false}
          onChange={onChange}
          onRegenerate={() => {}}
        />
      </Wrap>,
    );

    // Trigger a parent re-render with the SAME inputs — pre-fix this fired
    // an extraneous onChange because lastAutoRef was reset to autoText on
    // the first render and then "differed" on the second.
    rerender(
      <Wrap>
        <ImpressionBlock
          findings={findings}
          value={expected}
          edited={false}
          onChange={onChange}
          onRegenerate={() => {}}
        />
      </Wrap>,
    );

    expect(onChange).not.toHaveBeenCalled();
  });
});
