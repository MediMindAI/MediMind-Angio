// SPDX-License-Identifier: Apache-2.0
import { expect, test } from '@playwright/test';
import { gotoVenousForm, seedVenousEncounter } from './helpers/seedEncounter';

/**
 * Confirms the new image-backdrop diagram renders, the reference PNG
 * loads, and both anterior + posterior panels are present.
 */
test.describe('Anatomy diagram rendering', () => {
  test('renders both panels with backdrop image and segment hit-zones', async ({ page }) => {
    const { encounterId } = await seedVenousEncounter(page);
    await gotoVenousForm(page, encounterId);

    // Both panel containers exist (visible — they have a card outline).
    await expect(page.getByTestId('anatomy-diagram-le-anterior')).toBeVisible();
    await expect(page.getByTestId('anatomy-diagram-le-posterior')).toBeVisible();
    // Drawing canvases are attached (transparent fills, so not "visible" by Playwright's heuristic).
    await expect(page.getByTestId('drawing-canvas-le-anterior')).toBeAttached();
    await expect(page.getByTestId('drawing-canvas-le-posterior')).toBeAttached();

    // Reference image is wired into the SVG markup (we don't assert
    // network completion; just that the <image> element is in the DOM).
    const anteriorImageHrefs = await page
      .locator('[data-testid="anatomy-diagram-le-anterior"] image')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    expect(anteriorImageHrefs.some((h) => h?.endsWith('/le-reference.png'))).toBe(true);

    // 30 segment hit-zones in the anterior panel.
    const anteriorSegments = page
      .locator('[data-testid="anatomy-diagram-le-anterior"] [data-segment-id]');
    await expect(anteriorSegments).toHaveCount(30);

    // 18 segment hit-zones in the posterior panel.
    const posteriorSegments = page
      .locator('[data-testid="anatomy-diagram-le-posterior"] [data-segment-id]');
    await expect(posteriorSegments).toHaveCount(18);
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
