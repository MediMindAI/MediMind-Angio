// SPDX-License-Identifier: Apache-2.0
/**
 * IliacCavalTable — IVC + LRV / RIGHT / LEFT layout, AP diameter on every row,
 * thrombosis option, and the occluded contradiction lock (audit M3).
 */

/// <reference types="@testing-library/jest-dom" />

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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
  it('renders IVC + LRV + RIGHT + LEFT rows (no ovarian rows), AP diameter on every row', () => {
    render(
      <Wrap>
        <IliacCavalTable findings={{}} onChange={vi.fn()} />
      </Wrap>,
    );
    expect(screen.getByTestId('iliac-caval-row-ivc-mid')).toBeInTheDocument();
    expect(screen.getByTestId('iliac-caval-row-lrv')).toBeInTheDocument();
    expect(screen.getByTestId('iliac-caval-row-civ-prox-right')).toBeInTheDocument();
    expect(screen.queryByTestId('iliac-caval-row-ov-left')).toBeNull();
    expect(screen.queryByTestId('iliac-caval-row-ov-right')).toBeNull();
    expect(screen.getByTestId('iliac-cfv-left-ap-diameter')).toBeInTheDocument();
    expect(screen.getByTestId('iliac-iiv-left-ap-diameter')).toBeInTheDocument();
    expect(screen.getByTestId('iliac-ivc-mid-ap-diameter')).toBeInTheDocument();
    expect(screen.getByTestId('iliac-lrv-ap-diameter')).toBeInTheDocument();
    expect(screen.getByTestId('iliac-iiv-left-pv')).toBeInTheDocument();
  });

  it('LRV sits right after the IVC rows in the IVC section', () => {
    render(
      <Wrap>
        <IliacCavalTable findings={{}} onChange={vi.fn()} />
      </Wrap>,
    );
    const ivcDist = screen.getByTestId('iliac-caval-row-ivc-dist');
    expect(ivcDist.nextElementSibling).toBe(screen.getByTestId('iliac-caval-row-lrv'));
    expect(screen.getByTestId('iliac-caval-row-lrv').querySelector('[data-side]')).toBeNull();
  });

  it('a thrombosis row keeps its flow columns editable (only occluded locks)', () => {
    render(
      <Wrap>
        <IliacCavalTable findings={{ 'cfv-right': { patency: 'thrombosis' } }} onChange={vi.fn()} />
      </Wrap>,
    );
    expect(screen.getByTestId('iliac-cfv-right-filling')).not.toBeDisabled();
    expect(screen.getByTestId('iliac-cfv-right-pv')).not.toBeDisabled();
  });

  it('puts the side in each RIGHT/LEFT card title, not in IVC rows (UX-ANGIO-004 L3)', () => {
    render(
      <Wrap>
        <IliacCavalTable findings={{}} onChange={vi.fn()} />
      </Wrap>,
    );
    const right = screen.getByTestId('iliac-caval-row-civ-prox-right');
    const left = screen.getByTestId('iliac-caval-row-civ-prox-left');
    expect(right.querySelector('[data-side="right"]')).toBeInTheDocument();
    expect(left.querySelector('[data-side="left"]')).toBeInTheDocument();
    // Same segment, different side → the two card titles must differ.
    expect(right.firstElementChild?.textContent).not.toEqual(left.firstElementChild?.textContent);
    expect(screen.getByTestId('iliac-caval-row-ivc-mid').querySelector('[data-side]')).toBeNull();
  });

  it('disables flow columns on an occluded row (M3 lock)', () => {
    const findings: IliacCavalFindings = { 'cfv-right': { patency: 'occluded' } };
    render(
      <Wrap>
        <IliacCavalTable findings={findings} onChange={vi.fn()} />
      </Wrap>,
    );
    // EMRSelect renders the testid on its input element.
    expect(screen.getByTestId('iliac-cfv-right-filling')).toBeDisabled();
    expect(screen.getByTestId('iliac-cfv-right-competency')).toBeDisabled();
    expect(screen.getByTestId('iliac-cfv-right-pv')).toBeDisabled();
    expect(screen.getByTestId('iliac-cfv-left-pv')).not.toBeDisabled();
  });

  it('shows the all-normal button only when a callback is given, and calls it (UX-ANGIO-011)', () => {
    const onSetAllNormal = vi.fn();
    const { rerender } = render(
      <Wrap>
        <IliacCavalTable findings={{}} onChange={vi.fn()} />
      </Wrap>,
    );
    expect(screen.queryByTestId('iliac-bulk-set-all-normal')).toBeNull();
    rerender(
      <Wrap>
        <IliacCavalTable findings={{}} onChange={vi.fn()} onSetAllNormal={onSetAllNormal} />
      </Wrap>,
    );
    fireEvent.click(screen.getByTestId('iliac-bulk-set-all-normal'));
    expect(onSetAllNormal).toHaveBeenCalledTimes(1);
  });

  it('renders side headers as h3 headings', () => {
    render(
      <Wrap>
        <IliacCavalTable findings={{}} onChange={vi.fn()} />
      </Wrap>,
    );
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3);
  });

  describe('below desktop (UX-ANGIO-026 L4)', () => {
    function mockCompact(): void {
      vi.spyOn(window, 'matchMedia').mockImplementation(
        (query: string) =>
          ({
            matches: query === '(max-width: 992px)',
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
          }) as MediaQueryList,
      );
    }

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('keeps an empty row to one line and opens it on tap', () => {
      mockCompact();
      render(
        <Wrap>
          <IliacCavalTable findings={{}} onChange={vi.fn()} />
        </Wrap>,
      );
      const toggle = screen.getByTestId('iliac-caval-toggle-civ-prox-right');
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(toggle.querySelector('[data-side="right"]')).toBeInTheDocument();
      expect(screen.queryByTestId('iliac-civ-prox-right-patency')).toBeNull();
      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByTestId('iliac-civ-prox-right-patency')).toBeInTheDocument();
    });

    it('shows a populated row in full', () => {
      mockCompact();
      render(
        <Wrap>
          <IliacCavalTable findings={{ 'cfv-left': { patency: 'patent' } }} onChange={vi.fn()} />
        </Wrap>,
      );
      expect(screen.getByTestId('iliac-caval-toggle-cfv-left')).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByTestId('iliac-cfv-left-patency')).toBeInTheDocument();
      expect(screen.queryByTestId('iliac-cfv-right-patency')).toBeNull();
    });
  });
});
