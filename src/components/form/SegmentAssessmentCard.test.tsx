// SPDX-License-Identifier: Apache-2.0
/**
 * SegmentAssessmentCard — merged per-segment records (UX-ANGIO-026 L1),
 * single-leg lock (UX-ANGIO-012 L4), both-legs bulk label (UX-ANGIO-013),
 * h2 title (UX-ANGIO-018), and the reflux / diameter hard-reject gate that
 * the merged record carries over from ReflexTimeTable (Wave 4.9).
 *
 * jsdom's matchMedia stub reports `matches: false`, so records render in
 * their below-desktop (collapsible card) mode here.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { TranslationProvider } from '../../contexts/TranslationContext';
import { SegmentAssessmentCard, type SegmentAssessmentCardProps } from './SegmentAssessmentCard';
import { VENOUS_LE_SEGMENTS } from '../studies/venous-le/config';

function renderCard(overrides: Partial<SegmentAssessmentCardProps> = {}) {
  const props: SegmentAssessmentCardProps = {
    view: 'bilateral',
    onViewChange: vi.fn(),
    findings: {},
    onFindingChange: vi.fn(),
    highlightId: null,
    onHighlight: vi.fn(),
    onSetAllNormal: vi.fn(),
    onClearAll: vi.fn(),
    onCopySide: vi.fn(),
    onApplyTemplate: vi.fn(),
    onSaveCurrentAsTemplate: vi.fn(),
    customTemplates: [],
    recentTemplateIds: [],
    onDeleteCustomTemplate: vi.fn(),
    ...overrides,
  };
  render(
    <MantineProvider>
      <TranslationProvider>
        <SegmentAssessmentCard {...props} />
      </TranslationProvider>
    </MantineProvider>,
  );
  return props;
}

const rowIds = (): string[] =>
  screen.getAllByTestId(/^segment-row-/).map((el) => el.getAttribute('data-testid') ?? '');

describe('SegmentAssessmentCard — merged records', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders one record per segment × side, right leg first, every field in it', () => {
    renderCard();
    const ids = rowIds();
    expect(ids).toHaveLength(VENOUS_LE_SEGMENTS.length * 2);
    expect(ids[0]).toBe('segment-row-cfv-right');
    expect(ids[1]).toBe('segment-row-cfv-left');

    const row = screen.getByTestId('segment-row-gsv-prox-thigh-right');
    for (const field of ['compressibility', 'thrombosis', 'phasicity', 'competencyOverride']) {
      expect(within(row).getByTestId(`cell-gsv-prox-thigh-right-${field}`)).toBeInTheDocument();
    }
    for (const field of ['refluxDurationMs', 'apDiameterMm', 'depthMm']) {
      expect(within(row).getByTestId(`num-gsv-prox-thigh-right-${field}`)).toBeInTheDocument();
    }
  });

  it('keeps an empty card closed and opens an abnormal one by itself; the header toggles', () => {
    renderCard({
      findings: { 'gsv-prox-thigh-right': { refluxDurationMs: 1800 } },
    });
    expect(screen.getByTestId('segment-row-cfv-right')).toHaveAttribute('data-open', 'false');
    expect(screen.getByTestId('segment-row-gsv-prox-thigh-right')).toHaveAttribute(
      'data-open',
      'true',
    );

    const head = screen.getByTestId('segment-head-cfv-right');
    expect(head).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(head);
    expect(head).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('segment-row-cfv-right')).toHaveAttribute('data-open', 'true');
  });

  it('stores reflux typed in seconds as milliseconds', () => {
    const props = renderCard();
    const input = screen.getByTestId('num-cfv-left-refluxDurationMs');
    fireEvent.change(input, { target: { value: '1.8' } });
    fireEvent.blur(input);
    expect(props.onFindingChange).toHaveBeenCalledWith('cfv-left', { refluxDurationMs: 1800 });
  });

  it('rejects an implausible reflux (> 10 s) when confirm is cancelled', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const props = renderCard();
    const input = screen.getByTestId('num-cfv-left-refluxDurationMs');
    fireEvent.change(input, { target: { value: '15' } });
    fireEvent.blur(input);
    expect(confirmSpy).toHaveBeenCalled();
    expect(props.onFindingChange).not.toHaveBeenCalled();
  });

  it('rejects an implausible AP diameter (> 25 mm) when confirm is cancelled', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const props = renderCard();
    const input = screen.getByTestId('num-cfv-left-apDiameterMm');
    fireEvent.change(input, { target: { value: '40' } });
    fireEvent.blur(input);
    expect(confirmSpy).toHaveBeenCalled();
    expect(props.onFindingChange).not.toHaveBeenCalled();
  });

  it('renders the card title as an h2', () => {
    renderCard();
    expect(screen.getByRole('heading', { level: 2 })).toHaveAttribute(
      'id',
      'segment-assessment-title',
    );
  });

  it('keeps the legacy split tables behind layout="split"', () => {
    renderCard({ layout: 'split' });
    expect(screen.queryByTestId('segment-records')).not.toBeInTheDocument();
    expect(screen.getByTestId('cell-cfv-right-compressibility')).toBeInTheDocument();
    expect(screen.getByTestId('num-cfv-right-refluxDurationMs')).toBeInTheDocument();
  });
});

describe('SegmentAssessmentCard — both-legs bulk action (UX-ANGIO-013)', () => {
  it('says "both legs" in the bilateral view and fires the bulk action once', () => {
    const props = renderCard({ view: 'bilateral' });
    const button = screen.getByTestId('bulk-all-normal');
    // Label is composed from existing keys: "<all normal> · <bilateral tab>".
    expect(button.textContent).toContain('·');
    fireEvent.click(button);
    expect(props.onSetAllNormal).toHaveBeenCalledTimes(1);
  });

  it('keeps the plain per-leg label on a single-side tab', () => {
    renderCard({ view: 'right' });
    expect(screen.getByTestId('bulk-all-normal').textContent).not.toContain('·');
  });
});

describe('SegmentAssessmentCard — single-leg study (UX-ANGIO-012 L4)', () => {
  it('shows only the locked leg, no side tabs and no copy-side actions', () => {
    renderCard({ view: 'right', lockedSide: 'right' });
    const ids = rowIds();
    expect(ids).toHaveLength(VENOUS_LE_SEGMENTS.length);
    expect(ids.every((id) => id.endsWith('-right'))).toBe(true);
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bulk-copy-r-to-l')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bulk-copy-l-to-r')).not.toBeInTheDocument();
    expect(screen.getByTestId('bulk-all-normal')).toBeInTheDocument();
  });
});
