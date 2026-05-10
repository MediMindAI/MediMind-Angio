// Visual diagnostic — trace the actual GSV vein in viewBox coordinates,
// dispatch the corresponding screen-space pointer events, then crop a
// screenshot tightly to the panel so we can SEE whether the stroke
// follows the printed vein or drifts away from it.
//
// Run:  node e2e/diag-trace.mjs
import { chromium } from 'playwright';

const URL = process.env.URL ?? 'http://localhost:3001';
const encounterId = 'trace-' + Date.now();
const seed = {
  schemaVersion: 2, encounterId,
  header: { patientName: 'V', patientId: '01001011116', patientBirthDate: '1980-05-12', patientGender: 'male', encounterDate: '2026-05-10' },
  selectedStudyTypes: ['venousLEBilateral'], studies: {},
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};

// 30 viewBox-space (x,y) points along the right-leg GSV path,
// pulled from public/anatomy/le-anterior.svg (gsv-prox-thigh through gsv-calf).
const GSV_RIGHT = [
  [215, 295], [218, 320], [220, 360], [222, 395], [224, 420], [222, 440], [219, 460],
  [221, 480], [223, 510], [224, 540], [224, 580], [224, 610], [223, 640],
  [222, 670], [220, 700], [217, 730], [213, 760], [210, 780], [208, 800],
  [206, 820], [205, 835], [203, 850], [202, 870],
  [199, 920], [194, 1000], [193, 1080], [195, 1140], [192, 1210], [186, 1280],
];
// And the left-leg GSV (mirror-X on a 600-wide viewBox: x' = 600 - x).
const GSV_LEFT = GSV_RIGHT.map(([x, y]) => [600 - x, y]);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1400 } });
const page = await ctx.newPage();
await page.addInitScript(({ id, draft }) => {
  window.localStorage.setItem(`encounter-${id}`, JSON.stringify(draft));
}, { id: encounterId, draft: seed });

await page.goto(`${URL}/encounter/${encounterId}/venousLEBilateral`);
await page.waitForSelector('[data-testid="anatomy-diagram-le-anterior"]', { timeout: 15_000 });
await page.waitForTimeout(800);

await page.locator('[data-testid="drawing-mode-toggle"] input[value="draw"]').evaluate((el) => {
  el.click();
  el.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.waitForFunction(() =>
  document.querySelector('[data-testid="drawing-canvas-le-anterior"]')?.getAttribute('data-mode') === 'draw',
);

// Pick the red color so the stroke is visible against the line-art veins.
const red = page.locator('[data-testid="drawing-color-red"]');
if (await red.count()) await red.first().click();

// Bring the anterior panel near the top of the viewport so the screenshot
// captures the panel without 1700px of scroll above.
await page.evaluate(() => {
  document.querySelector('[data-testid="anatomy-diagram-le-anterior"]')?.scrollIntoView({ block: 'start' });
});
await page.waitForTimeout(200);

// Convert viewBox coords to screen coords using the canvas's own CTM,
// then dispatch as PointerEvents (React's onPointerDown listens for those).
async function tracePath(panel, vbPoints) {
  await page.evaluate(({ panel, vbPoints }) => {
    const el = document.querySelector(`[data-testid="${panel}"]`);
    const ctm = el.getScreenCTM();
    const pt = el.createSVGPoint();
    const screenPts = vbPoints.map(([vx, vy]) => {
      pt.x = vx; pt.y = vy;
      const s = pt.matrixTransform(ctm); // viewBox → screen
      return [s.x, s.y];
    });
    const fire = (type, [x, y]) => el.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true,
      pointerId: 1, pointerType: 'mouse',
      clientX: x, clientY: y, pressure: type === 'pointerup' ? 0 : 0.5, isPrimary: true,
    }));
    fire('pointerdown', screenPts[0]);
    for (let i = 1; i < screenPts.length; i++) fire('pointermove', screenPts[i]);
    fire('pointerup', screenPts[screenPts.length - 1]);
  }, { panel, vbPoints });
  await page.waitForTimeout(60);
}

await tracePath('drawing-canvas-le-anterior', GSV_RIGHT);
await tracePath('drawing-canvas-le-anterior', GSV_LEFT);

// Crop the screenshot to the panel rect so we can read the result.
const clip = await page.evaluate(() => {
  const r = document.querySelector('[data-testid="anatomy-diagram-le-anterior"]').getBoundingClientRect();
  return { x: Math.max(0, r.x - 4), y: Math.max(0, r.y - 4), width: r.width + 8, height: r.height + 8 };
});
await page.screenshot({ path: 'e2e/diag-trace.png', clip });
console.log('Saved: e2e/diag-trace.png  (clip:', clip, ')');

await browser.close();
