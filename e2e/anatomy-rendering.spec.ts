// SPDX-License-Identifier: Apache-2.0
import { expect, test } from '@playwright/test';
import { gotoVenousForm, seedVenousEncounter } from './helpers/seedEncounter';

/**
 * Confirms the venous diagram renders: one combined vector view (anterior +
 * posterior segments share one picture), its drawing canvas, and every
 * segment hit-zone for both legs.
 */
test.describe('Anatomy diagram rendering', () => {
  test('renders the combined panel with segment hit-zones for both legs', async ({ page }) => {
    const { encounterId } = await seedVenousEncounter(page);
    await gotoVenousForm(page, encounterId);

    await expect(page.getByTestId('anatomy-diagram-le-anterior')).toBeVisible();
    // Drawing canvas is attached (transparent fill, so not "visible" by Playwright's heuristic).
    await expect(page.getByTestId('drawing-canvas-le-anterior')).toBeAttached();

    // 18 segments per leg (deep, GSV and the posterior SSV/gastrocnemius set) = 36.
    const segments = page.locator('[data-testid="anatomy-diagram-le-anterior"] [data-segment-id]');
    await expect(segments).toHaveCount(36);
    await expect(segments.locator('xpath=self::*[@data-segment-id="ssv-left"]')).toHaveCount(1);
  });

  test('CFV-right hit-zone is clickable and the segment table responds', async ({ page }) => {
    const { encounterId } = await seedVenousEncounter(page);
    await gotoVenousForm(page, encounterId);

    // Click the CFV-right segment in the anterior panel.
    const cfvRight = page
      .locator('[data-testid="anatomy-diagram-le-anterior"] [data-segment-id="cfv-right"]')
      .first();
    await cfvRight.click({ force: true });

    // The segment table should switch to the right side and highlight cfv-right.
    await expect(
      page.locator('[data-testid="segment-row-cfv-right"]'),
    ).toBeVisible({ timeout: 5_000 });
  });
});
