// Trace the SSV vein on the POSTERIOR panel using real mouse events.
import { chromium } from 'playwright';

const URL = process.env.URL ?? 'http://localhost:3001';
const encounterId = 'post-' + Date.now();
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
await page.waitForSelector('[data-testid="anatomy-diagram-le-posterior"]', { timeout: 15_000 });
await page.waitForTimeout(800);

await page.locator('[data-testid="drawing-mode-toggle"] input[value="draw"]').evaluate((el) => {
  el.click(); el.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.waitForFunction(() =>
  document.querySelector('[data-testid="drawing-canvas-le-posterior"]')?.getAttribute('data-mode') === 'draw',
);
const red = page.locator('[data-testid="drawing-color-red"]');
if (await red.count()) await red.first().click();

await page.evaluate(() => {
  document.querySelector('[data-testid="anatomy-diagram-le-posterior"]')?.scrollIntoView({ block: 'start' });
});
await page.waitForTimeout(200);

// SSV path right leg (posterior view): "M 215,890 Q 200,1140 188,1330"
const SSV_RIGHT_VB = [
  [215, 890], [212, 940], [209, 990], [205, 1040], [202, 1090],
  [200, 1140], [197, 1190], [194, 1240], [191, 1280], [188, 1330],
];
const SSV_LEFT_VB = SSV_RIGHT_VB.map(([x, y]) => [600 - x, y]);

async function trace(panel, vbPoints) {
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

await trace('drawing-canvas-le-posterior', SSV_RIGHT_VB);
await trace('drawing-canvas-le-posterior', SSV_LEFT_VB);

const clip = await page.evaluate(() => {
  const r = document.querySelector('[data-testid="anatomy-diagram-le-posterior"]').getBoundingClientRect();
  return { x: Math.max(0, r.x - 4), y: Math.max(0, r.y - 4), width: Math.min(r.width + 8, window.innerWidth - r.x + 4), height: Math.min(r.height + 8, window.innerHeight - r.y + 4) };
});
await page.screenshot({ path: 'e2e/diag-posterior.png', clip });
console.log('Saved: e2e/diag-posterior.png  clip=', clip);
await browser.close();
