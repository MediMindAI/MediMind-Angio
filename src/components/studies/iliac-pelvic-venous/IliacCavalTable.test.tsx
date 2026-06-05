// SPDX-License-Identifier: Apache-2.0
/**
 * IliacCavalTable — view toggle + contradiction locks (audit H2 layout / M3).
 * Uses the narrow 'right' view (IVC + 4 right segments) to keep the Mantine
 * tree light per the test-runner caveats in CLAUDE.md.
 */

/// <reference types="@testing-library/jest-dom" />

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { TranslationProvider } from '../../../contexts/TranslationContext';
import { IliacCavalTable } from './IliacCavalTable';
import type { IliacCavalFindings } from './config';

function Wrap({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <MantineProvider>
      <TranslationProvider>{children}</TranslationProvider>
    </MantineProvider>
  );
}

describe('IliacCavalTable', () => {
  it("shows only the selected side's rows in 'right' view", () => {
    render(
      <Wrap>
        <IliacCavalTable findings={{}} view="right" onViewChange={vi.fn()} onChange={vi.fn()} />
      </Wrap>,
    );
    expect(screen.getByTestId('iliac-caval-row-cfv-right')).toBeInTheDocument();
    expect(screen.queryByTestId('iliac-caval-row-cfv-left')).not.toBeInTheDocument();
    expect(screen.getByTestId('iliac-caval-row-ivc')).toBeInTheDocument();
  });

  it('disables velocity/stenosis inputs on an occluded segment (M3 lock)', () => {
    const findings: IliacCavalFindings = { 'cfv-right': { patency: 'occluded' } };
    render(
      <Wrap>
        <IliacCavalTable findings={findings} view="right" onViewChange={vi.fn()} onChange={vi.fn()} />
      </Wrap>,
    );
    expect(screen.getByTestId('iliac-cfv-right-velocity-ratio')).toBeDisabled();
    expect(screen.getByTestId('iliac-cfv-right-stenosis')).toBeDisabled();
  });

  it('disables thrombus chronicity on a fully compressible segment (M3 lock)', () => {
    const findings: IliacCavalFindings = { 'cfv-right': { compressibility: 'full' } };
    render(
      <Wrap>
        <IliacCavalTable findings={findings} view="right" onViewChange={vi.fn()} onChange={vi.fn()} />
      </Wrap>,
    );
    // EMRSelect renders the testid on its input element.
    expect(screen.getByTestId('iliac-cfv-right-thrombus')).toBeDisabled();
  });
});
