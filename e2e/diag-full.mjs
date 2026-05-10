// End-to-end check: open the venous form, switch to draw mode, clear any
// stale drawings, then draw two GSV traces with real mouse events. Capture
// before/after screenshots so we can compare.
//
// Run:  node e2e/diag-full.mjs
import { chromium } from 'playwright';

const URL = process.env.URL ?? 'http://localhost:3001';
const encounterId = 'full-' + Date.now();
const seed = {
  schemaVersion: 2, encounterId,
  header: { patientName: 'V', patientId: '01001011116', patientBirthDate: '1980-05-12', patientGender: 'male', encounterDate: '2026-05-10' },
  selectedStudyTypes: ['venousLEBilateral'], studies: {},
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.addInitScript(({ id, draft }) => {
  window.localStorage.setItem(`encounter-${id}`, JSON.stringify(draft));
}, { id: encounterId, draft: seed });

await page.goto(`${URL}/encounter/${encounterId}/venousLEBilateral`);
await page.waitForSelector('[data-testid="anatomy-diagram-le-anterior"]', { timeout: 15_000 });
await page.waitForTimeout(800);

// 0) Switch to draw mode and pick red so strokes are visible.
await page.locator('[data-testid="drawing-mode-toggle"] input[value="draw"]').evaluate((el) => {
  el.click();
  el.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.waitForFunction(() =>
  document.querySelector('[data-testid="drawing-canvas-le-anterior"]')?.getAttribute('data-mode') === 'draw',
);
const red = page.locator('[data-testid="drawing-color-red"]');
if (await red.count()) await red.first().click();

// 1) Clear (in case any persistence carried over).
const clearBtn = page.locator('[data-testid="drawing-clear"]');
if (await clearBtn.count()) {
  try {
    await clearBtn.click();
    // If a confirm modal appears, accept it.
    const ok = page.locator('button:has-text("OK"), button:has-text("Yes"), button:has-text("Clear"), button:has-text("Confirm")').first();
    if (await ok.count()) await ok.click({ trial: false }).catch(() => {});
    await page.waitForTimeout(150);
  } catch {}
}

// Bring the anterior panel near the top of viewport.
await page.evaluate(() => {
  document.querySelector('[data-testid="anatomy-diagram-le-anterior"]')?.scrollIntoView({ block: 'start' });
});
await page.waitForTimeout(200);

// Take a "before" screenshot of the empty canvas (sanity).
{
  const clip = await page.evaluate(() => {
    const r = document.querySelector('[data-testid="anatomy-diagram-le-anterior"]').getBoundingClientRect();
    return { x: Math.max(0, r.x - 4), y: Math.max(0, r.y - 4), width: Math.min(r.width + 8, window.innerWidth - r.x + 4), height: Math.min(r.height + 8, window.innerHeight - r.y + 4) };
  });
  await page.screenshot({ path: 'e2e/diag-before.png', clip });
}

const strokeCountBefore = await page.locator('[data-testid="drawing-canvas-le-anterior"] [data-stroke-id]').count();
console.log('strokes before drawing:', strokeCountBefore);

// 2) Trace GSV right leg.
const GSV_RIGHT_VB = [
  [215, 295], [218, 320], [220, 360], [222, 400], [224, 420], [222, 440], [219, 460],
  [221, 490], [223, 530], [224, 580], [223, 640],
  [221, 690], [217, 740], [213, 760], [210, 780], [208, 800],
  [205, 835], [202, 870], [199, 920], [195, 1000], [194, 1080], [195, 1140], [192, 1210], [186, 1280],
];
const GSV_LEFT_VB = GSV_RIGHT_VB.map(([x, y]) => [600 - x, y]);

async function traceWithRealMouse(panel, vbPoints) {
  // Compute screen coords using the canvas's getScreenCTM at the time of capture.
  const screenPts = await page.evaluate(({ panel, vbPoints }) => {
    const el = document.querySelector(`[data-testid="${panel}"]`);
    const ctm = el.getScreenCTM();
    const pt = el.createSVGPoint();
    return vbPoints.map(([x, y]) => {
      pt.x = x; pt.y = y;
      const s = pt.matrixTransform(ctm);
      return [s.x, s.y];
    });
  }, { panel, vbPoints });

  await page.mouse.move(screenPts[0][0], screenPts[0][1]);
  await page.mouse.down();
  for (let i = 1; i < screenPts.length; i++) {
    await page.mouse.move(screenPts[i][0], screenPts[i][1], { steps: 4 });
  }
  await page.mouse.up();
  await page.waitForTimeout(80);
}

await traceWithRealMouse('drawing-canvas-le-anterior', GSV_RIGHT_VB);
await traceWithRealMouse('drawing-canvas-le-anterior', GSV_LEFT_VB);

const strokeCountAfter = await page.locator('[data-testid="drawing-canvas-le-anterior"] [data-stroke-id]').count();
console.log('strokes after drawing:', strokeCountAfter);

// 3) Take "after" screenshot of full panel.
{
  const clip = await page.evaluate(() => {
    const r = document.querySelector('[data-testid="anatomy-diagram-le-anterior"]').getBoundingClientRect();
    return { x: Math.max(0, r.x - 4), y: Math.max(0, r.y - 4), width: Math.min(r.width + 8, window.innerWidth - r.x + 4), height: Math.min(r.height + 8, window.innerHeight - r.y + 4) };
  });
  await page.screenshot({ path: 'e2e/diag-after.png', clip });
}

// 4) Detailed alignment audit: for each stroke point, compute screen<->viewBox<->screen
//    round-trip to see if there is any drift in the canvas's mapping.
const audit = await page.evaluate(({ vbPoints }) => {
  const el = document.querySelector('[data-testid="drawing-canvas-le-anterior"]');
  const ctm = el.getScreenCTM();
  const inv = ctm.inverse();
  const pt = el.createSVGPoint();
  return vbPoints.slice(0, 6).map(([vx, vy]) => {
    pt.x = vx; pt.y = vy;
    const s = pt.matrixTransform(ctm);   // VB → screen
    pt.x = s.x; pt.y = s.y;
    const back = pt.matrixTransform(inv); // screen → VB
    return { vb: [vx, vy], screen: [+s.x.toFixed(2), +s.y.toFixed(2)], roundtrip: [+back.x.toFixed(2), +back.y.toFixed(2)] };
  });
}, { vbPoints: GSV_RIGHT_VB });
console.log('roundtrip audit (viewBox → screen → viewBox; should match):');
for (const r of audit) console.log(' ', JSON.stringify(r));

await browser.close();
console.log('Saved: e2e/diag-before.png  e2e/diag-after.png');
