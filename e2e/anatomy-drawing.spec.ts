// SPDX-License-Identifier: Apache-2.0
import { expect, test, type Page } from '@playwright/test';
import { gotoVenousForm, seedVenousEncounter } from './helpers/seedEncounter';

/**
 * Mantine's SegmentedControl renders each option as a hidden `<input>`
 * paired with a clickable `<label>`. The label is what receives clicks,
 * but its accessible name maps to the input's value, so `getByLabel`
 * works reliably regardless of i18n.
 */
async function switchToDrawMode(page: Page): Promise<void> {
  // Mantine SegmentedControl writes the active value to the underlying
  // <input> element. Find the input whose value="draw" and click its label.
  const drawInput = page.getByTestId('drawing-mode-toggle').locator('input[value="draw"]');
  await drawInput.evaluate((el: HTMLInputElement) => {
    el.click();
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  // Verify the canvas reflects the new mode.
  await expect(page.getByTestId('drawing-canvas-le-anterior')).toHaveAttribute(
    'data-mode',
    'draw',
  );
}

/**
 * Programmatically draw a stroke on the named canvas. We dispatch
 * PointerEvents directly because Playwright's `mouse` driver dispatches
 * MouseEvents — React's `onPointerDown` listener requires PointerEvent.
 */
async function drawStroke(
  page: Page,
  canvasTestId: string,
  segments: ReadonlyArray<readonly [number, number]>,
): Promise<void> {
  await page.evaluate(
    ({ id, points }) => {
      const el = document.querySelector(`[data-testid="${id}"]`) as SVGSVGElement | null;
      if (!el) throw new Error(`canvas ${id} not found`);
      const rect = el.getBoundingClientRect();
      const dispatch = (type: string, [px, py]: readonly [number, number]) => {
        const ev = new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: 'mouse',
          clientX: rect.left + rect.width * px,
          clientY: rect.top + rect.height * py,
          pressure: type === 'pointerup' ? 0 : 0.5,
          isPrimary: true,
        });
        el.dispatchEvent(ev);
      };
      const first = points[0];
      if (!first) throw new Error('no points');
      dispatch('pointerdown', first);
      for (let i = 1; i < points.length; i++) {
        const p = points[i];
        if (p) dispatch('pointermove', p);
      }
      dispatch('pointerup', points[points.length - 1] ?? first);
    },
    { id: canvasTestId, points: segments },
  );
}

/**
 * Drives the freehand-drawing layer: switching modes, drawing strokes,
 * undoing, erasing, and reload-persistence.
 */
test.describe('Anatomy drawing layer', () => {
  test('shows toolbar with click + draw mode toggle', async ({ page }) => {
    const { encounterId } = await seedVenousEncounter(page);
    await gotoVenousForm(page, encounterId);
    await expect(page.getByTestId('drawing-mode-toggle')).toBeVisible();
  });

  test('canvas pointer-events are none in click mode', async ({ page }) => {
    const { encounterId } = await seedVenousEncounter(page);
    await gotoVenousForm(page, encounterId);

    const canvas = page.getByTestId('drawing-canvas-le-anterior');
    const pe = await canvas.evaluate((el) => getComputedStyle(el).pointerEvents);
    expect(pe).toBe('none');
  });

  test('can draw a stroke in draw mode and it appears in the canvas', async ({ page }) => {
    const { encounterId } = await seedVenousEncounter(page);
    await gotoVenousForm(page, encounterId);

    await switchToDrawMode(page);

    // 8 points along a curve from (0.3, 0.4) → (0.6, 0.45).
    const points: ReadonlyArray<readonly [number, number]> = Array.from({ length: 9 }, (_, i) => {
      const t = i / 8;
      return [0.3 + 0.3 * t, 0.4 + 0.05 * t] as const;
    });
    await drawStroke(page, 'drawing-canvas-le-anterior', points);

    await expect(
      page.locator('[data-testid="drawing-canvas-le-anterior"] [data-stroke-id]'),
    ).toHaveCount(1);
  });

  test('undo removes the most recent stroke', async ({ page }) => {
    const { encounterId } = await seedVenousEncounter(page);
    await gotoVenousForm(page, encounterId);

    await switchToDrawMode(page);

    for (let stroke = 0; stroke < 2; stroke++) {
      const yBase = 0.3 + stroke * 0.15;
      const points = Array.from({ length: 7 }, (_, i) => [0.3 + i * 0.05, yBase] as const);
      await drawStroke(page, 'drawing-canvas-le-anterior', points);
    }
    await expect(
      page.locator('[data-testid="drawing-canvas-le-anterior"] [data-stroke-id]'),
    ).toHaveCount(2);

    await page.getByTestId('drawing-undo').click();
    await expect(
      page.locator('[data-testid="drawing-canvas-le-anterior"] [data-stroke-id]'),
    ).toHaveCount(1);
  });

  test('drawings persist across reload', async ({ page }) => {
    const { encounterId } = await seedVenousEncounter(page);
    await gotoVenousForm(page, encounterId);

    await switchToDrawMode(page);
    const points = Array.from({ length: 7 }, (_, i) => [0.3 + i * 0.04, 0.4] as const);
    await drawStroke(page, 'drawing-canvas-le-anterior', points);
    await expect(
      page.locator('[data-testid="drawing-canvas-le-anterior"] [data-stroke-id]'),
    ).toHaveCount(1);

    // Wait for the encounter-store mirroring effect to flush before reload.
    await page.waitForTimeout(500);
    await page.reload();
    await page.waitForSelector('[data-testid="drawing-canvas-le-anterior"]', {
      timeout: 10_000,
    });
    await expect(
      page.locator('[data-testid="drawing-canvas-le-anterior"] [data-stroke-id]'),
    ).toHaveCount(1);
  });

  test('eraser deletes the clicked stroke', async ({ page }) => {
    const { encounterId } = await seedVenousEncounter(page);
    await gotoVenousForm(page, encounterId);

    await switchToDrawMode(page);
    const points = Array.from({ length: 7 }, (_, i) => [0.3 + i * 0.04, 0.4] as const);
    await drawStroke(page, 'drawing-canvas-le-anterior', points);
    await expect(
      page.locator('[data-testid="drawing-canvas-le-anterior"] [data-stroke-id]'),
    ).toHaveCount(1);

    await page.getByTestId('drawing-tool-eraser').click();
    await page
      .locator('[data-testid="drawing-canvas-le-anterior"] [data-stroke-id]')
      .first()
      .click({ force: true });

    await expect(
      page.locator('[data-testid="drawing-canvas-le-anterior"] [data-stroke-id]'),
    ).toHaveCount(0);
  });
});
