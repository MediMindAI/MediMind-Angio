// SPDX-License-Identifier: Apache-2.0
/** UX-ANGIO-018 — the section title is a real h2 heading (same look). */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { EMRContentSection } from './EMRContentSection';

describe('EMRContentSection', () => {
  it('renders the title as an h2 heading', () => {
    render(
      <MantineProvider>
        <EMRContentSection title="დიაგრამა">body</EMRContentSection>
      </MantineProvider>,
    );
    const heading = screen.getByRole('heading', { level: 2, name: 'დიაგრამა' });
    expect(heading).toHaveAttribute('data-testid', 'emr-content-section-title');
  });
});
