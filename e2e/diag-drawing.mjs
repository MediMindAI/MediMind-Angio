// Multi-point alignment diagnostic for the anatomy drawing layer.
// Fires synthesized PointerEvents at known canvas-relative positions
// (corners + center + 50% deep targets) on BOTH panels and reports
// the screen-space delta between cursor and rendered stroke center.
//
// Run:  node e2e/diag-drawing.mjs
import { chromium } from 'playwright';

const URL = process.env.URL ?? 'http://localhost:3001';
const encounterId = 'diag-' + Date.now();
const seed = {
  schemaVersion: 2,
  encounterId,
  header: {
    patientName: 'Diag Patient',
    patientId: '01001011116',
    patientBirthDate: '1980-05-12',
    patientGender: 'male',
    encounterDate: new Date().toISOString().slice(0, 10),
  },
  selectedStudyTypes: ['venousLEBilateral'],
  studies: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.addInitScript(({ id, draft }) => {
  window.localStorage.setItem(`encounter-${id}`, JSON.stringify(draft));
}, { id: encounterId, draft: seed });

await page.goto(`${URL}/encounter/${encounterId}/venousLEBilateral`);
await page.waitForSelector('[data-testid="anatomy-diagram-le-anterior"]', { timeout: 15_000 });
await page.waitForTimeout(800);

// Switch to draw mode
await page.locator('[data-testid="drawing-mode-toggle"] input[value="draw"]').evaluate((el) => {
  el.click();
  el.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.waitForFunction(() =>
  document.querySelector('[data-testid="drawing-canvas-le-anterior"]')?.getAttribute('data-mode') === 'draw',
);

// Test grid: (fx, fy) fractional positions inside the stage rect.
const targets = [
  { name: 'top-left',     fx: 0.15, fy: 0.10 },
  { name: 'top-right',    fx: 0.85, fy: 0.10 },
  { name: 'mid-center',   fx: 0.50, fy: 0.50 },
  { name: 'mid-left',     fx: 0.20, fy: 0.50 },
  { name: 'bottom-left',  fx: 0.20, fy: 0.90 },
  { name: 'bottom-right', fx: 0.80, fy: 0.90 },
];

const panels = ['drawing-canvas-le-anterior', 'drawing-canvas-le-posterior'];

const results = [];
for (const panel of panels) {
  const stageId = panel.replace('drawing-canvas-', 'anatomy-diagram-');
  for (const t of targets) {
    // Scroll the stage into view, then read its rect.
    const target = await page.evaluate(({ stageId, fx, fy }) => {
      const stage = document.querySelector(`[data-testid="${stageId}"]`);
      stage.scrollIntoView({ block: 'center', inline: 'center' });
      const r = stage.getBoundingClientRect();
      return { cx: r.left + r.width * fx, cy: r.top + r.height * fy };
    }, { stageId, fx: t.fx, fy: t.fy });

    await page.waitForTimeout(120);

    // Re-measure after scroll settled (rect may have shifted).
    const target2 = await page.evaluate(({ stageId, fx, fy }) => {
      const stage = document.querySelector(`[data-testid="${stageId}"]`);
      const r = stage.getBoundingClientRect();
      return { cx: r.left + r.width * fx, cy: r.top + r.height * fy };
    }, { stageId, fx: t.fx, fy: t.fy });

    // Fire a small 10×10 stroke from (cx, cy) to (cx+10, cy+10).
    await page.evaluate(({ panel, cx, cy }) => {
      const el = document.querySelector(`[data-testid="${panel}"]`);
      const fire = (type, x, y) => el.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true,
        pointerId: 1, pointerType: 'mouse',
        clientX: x, clientY: y, pressure: type === 'pointerup' ? 0 : 0.5, isPrimary: true,
      }));
      fire('pointerdown', cx, cy);
      for (let i = 1; i <= 10; i++) fire('pointermove', cx + i, cy + i);
      fire('pointerup', cx + 10, cy + 10);
    }, { panel, cx: target2.cx, cy: target2.cy });

    await page.waitForTimeout(80);

    // Read the LATEST rendered stroke's bbox center.
    const strokeRect = await page.evaluate(({ panel }) => {
      const paths = document.querySelectorAll(`[data-testid="${panel}"] [data-stroke-id]`);
      const path = paths[paths.length - 1];
      if (!path) return null;
      const b = path.getBoundingClientRect();
      return { cx: b.x + b.width / 2, cy: b.y + b.height / 2, w: b.width, h: b.height };
    }, { panel });

    const expected = { cx: target2.cx + 5, cy: target2.cy + 5 };
    const delta = strokeRect
      ? { dx: +(strokeRect.cx - expected.cx).toFixed(2), dy: +(strokeRect.cy - expected.cy).toFixed(2) }
      : null;
    results.push({ panel: panel.replace('drawing-canvas-', ''), target: t.name, target2, strokeRect, delta });
  }
}

console.log('panel,target,cursorX,cursorY,strokeCx,strokeCy,deltaX,deltaY');
for (const r of results) {
  console.log([
    r.panel, r.target,
    r.target2.cx.toFixed(1), r.target2.cy.toFixed(1),
    r.strokeRect?.cx.toFixed(1) ?? '-',
    r.strokeRect?.cy.toFixed(1) ?? '-',
    r.delta?.dx ?? '-',
    r.delta?.dy ?? '-',
  ].join(','));
}

const maxAbs = results
  .map((r) => Math.max(Math.abs(r.delta?.dx ?? 0), Math.abs(r.delta?.dy ?? 0)))
  .reduce((a, b) => Math.max(a, b), 0);
console.log(`MAX |delta| = ${maxAbs.toFixed(2)} px  (target: < 1.0 px)`);

await page.evaluate(() => document.querySelector('[data-testid="anatomy-diagram-le-anterior"]')?.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(200);
await page.screenshot({ path: 'e2e/diag-anterior.png', fullPage: false });

await page.evaluate(() => document.querySelector('[data-testid="anatomy-diagram-le-posterior"]')?.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(200);
await page.screenshot({ path: 'e2e/diag-posterior.png', fullPage: false });

await browser.close();
console.log('Screenshots: e2e/diag-anterior.png, e2e/diag-posterior.png');
