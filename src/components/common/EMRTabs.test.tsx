// SPDX-License-Identifier: Apache-2.0
/**
 * Wave 3.9 — Tap-target hardening (Pattern D).
 *
 * EMRTabs default size is `md`. CLAUDE.md mandates a 44×44 tap-target floor
 * for any always-visible interactive control (gloved iPad clinicians on duty
 * shifts cannot reliably hit a 42px target). These tests pin the height so
 * any future regression that drops below 44 fails CI immediately.
 */

/// <reference types="@testing-library/jest-dom" />
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { EMRTabs, SIZE_CONFIG } from './EMRTabs';

function Wrap({ children }: { children: React.ReactNode }): React.ReactElement {
  return <MantineProvider>{children}</MantineProvider>;
}

describe('EMRTabs — tap-target floor (Wave 3.9 / Pattern D)', () => {
  it('default md size meets the 44×44 tap-target floor', () => {
    expect(SIZE_CONFIG.md.height).toBeGreaterThanOrEqual(44);
  });

  it('lg size also meets the 44×44 tap-target floor', () => {
    expect(SIZE_CONFIG.lg.height).toBeGreaterThanOrEqual(44);
  });

  it('renders default tab with inline height ≥ 44px', () => {
    const { container } = render(
      <Wrap>
        <EMRTabs value="a" onChange={() => {}}>
          <EMRTabs.List>
            <EMRTabs.Tab value="a">Tab A</EMRTabs.Tab>
          </EMRTabs.List>
        </EMRTabs>
      </Wrap>,
    );
    const tab = container.querySelector('[role="tab"]') as HTMLElement | null;
    expect(tab).not.toBeNull();
    // Inline style is applied directly via `style={{ height: config.height }}`.
    const height = parseInt(tab!.style.height, 10);
    expect(height).toBeGreaterThanOrEqual(44);
  });
});
