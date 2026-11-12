// SPDX-License-Identifier: Apache-2.0
/**
 * UX-ANGIO-027 — an empty Recommendations deck is one quiet header row
 * (no body, no dashed placeholder); the row trash button is named "delete".
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { TranslationProvider } from '../../contexts/TranslationContext';
import { RecommendationsBlock } from './RecommendationsBlock';
import type { Recommendation } from '../../types/form';

function renderBlock(items: ReadonlyArray<Recommendation>, onChange = vi.fn()) {
  return render(
    <MantineProvider>
      <TranslationProvider>
        <RecommendationsBlock items={items} onChange={onChange} />
      </TranslationProvider>
    </MantineProvider>,
  );
}

describe('RecommendationsBlock', () => {
  it('collapses the empty state to the header row with a muted line', () => {
    const { container } = renderBlock([]);
    const section = container.querySelector('section') as HTMLElement;
    expect(section).toHaveAttribute('data-empty', 'true');
    expect(screen.getByTestId('recommendations-empty')).toBeInTheDocument();
    // Header only: no body container below it.
    expect(section.children).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 2 })).toHaveAttribute('id', 'recs-title');
  });

  it('adds a recommendation from the header button (capability unchanged)', () => {
    const onChange = vi.fn();
    renderBlock([], onChange);
    fireEvent.click(screen.getByTestId('add-recommendation'));
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0]![0] as ReadonlyArray<Recommendation>;
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ text: '', priority: 'routine' });
  });

  it('names the row trash button "delete", not "close"', () => {
    const items: Recommendation[] = [{ id: 'r1', text: 'Follow-up', priority: 'routine' }];
    const { container } = renderBlock(items);
    expect(container.querySelector('section')).not.toHaveAttribute('data-empty');
    const trash = screen.getByTestId('remove-recommendation-r1');
    expect(trash.getAttribute('aria-label')).not.toMatch(/close|დახურვა|Закрыть/i);
    expect(trash.getAttribute('aria-label')).toBeTruthy();
  });
});
