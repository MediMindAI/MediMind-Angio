// SPDX-License-Identifier: Apache-2.0
/**
 * UX-ANGIO-016 — a passive `rightSection` (summary chip) must not swallow the
 * header click; interactive controls in it still must not toggle.
 * UX-ANGIO-018 — the header sits inside a real heading (h2 / h3 when nested).
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { IconCategory2 } from '@tabler/icons-react';
import { EMRCollapsibleSection } from './EMRCollapsibleSection';

function header(): HTMLElement {
  return screen.getByTestId('sec').querySelector('[role="button"]') as HTMLElement;
}

describe('EMRCollapsibleSection', () => {
  it('toggles when a passive rightSection chip is clicked', () => {
    render(
      <MantineProvider>
        <EMRCollapsibleSection
          title="CEAP"
          icon={IconCategory2}
          defaultOpen={false}
          testId="sec"
          rightSection={<span>C0,En,An,Pn</span>}
        >
          body
        </EMRCollapsibleSection>
      </MantineProvider>,
    );
    expect(header()).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByText('C0,En,An,Pn'));
    expect(header()).toHaveAttribute('aria-expanded', 'true');
  });

  it('does not toggle when an interactive rightSection control is clicked', () => {
    const onAction = vi.fn();
    render(
      <MantineProvider>
        <EMRCollapsibleSection
          title="CEAP"
          icon={IconCategory2}
          defaultOpen={false}
          testId="sec"
          rightSection={
            <button type="button" onClick={onAction}>
              <span>act</span>
            </button>
          }
        >
          body
        </EMRCollapsibleSection>
      </MantineProvider>,
    );
    fireEvent.click(screen.getByText('act'));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(header()).toHaveAttribute('aria-expanded', 'false');
  });

  it('wraps the header in an h2 (top level) and h3 (soft / nested)', () => {
    const { rerender } = render(
      <MantineProvider>
        <EMRCollapsibleSection title="Top" icon={IconCategory2} testId="sec">
          body
        </EMRCollapsibleSection>
      </MantineProvider>,
    );
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Top');
    expect(screen.getByRole('heading', { level: 2 })).toContainElement(header());

    rerender(
      <MantineProvider>
        <EMRCollapsibleSection title="Nested" icon={IconCategory2} testId="sec" variant="soft">
          body
        </EMRCollapsibleSection>
      </MantineProvider>,
    );
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Nested');
  });
});
