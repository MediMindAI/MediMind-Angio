// Diagnostic — drive a REAL mouse via Playwright's mouse API (not synthetic
// PointerEvents), so the browser's native pointer pipeline runs end-to-end
// just like a human user. Test with a viewport sized to mimic Opera with
// DevTools open on the right (≈ 1024 wide).
//
// Run:  node e2e/diag-realmouse.mjs
import { chromium } from 'playwright';

const URL = process.env.URL ?? 'http://localhost:3001';
const encounterId = 'realmouse-' + Date.now();
const seed = {
  schemaVersion: 2, encounterId,
  header: { patientName: 'V', patientId: '01001011116', patientBirthDate: '1980-05-12', patientGender: 'male', encounterDate: '2026-05-10' },
  selectedStudyTypes: ['venousLEBilateral'], studies: {},
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};

const VIEWPORT = { width: 1024, height: 768 };  // mimic devtools-open

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });  // HiDPI like Mac
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

// Pick red color so the stroke is visible against the line-art veins.
const red = page.locator('[data-testid="drawing-color-red"]');
if (await red.count()) await red.first().click();

// Scroll the anterior panel near the top of viewport.
await page.evaluate(() => {
  document.querySelector('[data-testid="anatomy-diagram-le-anterior"]')?.scrollIntoView({ block: 'start' });
});
await page.waitForTimeout(200);

// GSV vein path in viewBox coords (right leg) from public/anatomy/le-anterior.svg.
const GSV_RIGHT_VB = [
  [215, 295], [220, 360], [222, 410], [224, 420], [222, 440], [219, 460],
  [221, 490], [223, 520], [224, 560], [224, 600], [223, 640],
  [220, 700], [216, 740], [213, 760], [210, 780], [208, 800],
  [206, 820], [204, 845], [202, 870],
  [199, 920], [195, 1000], [194, 1080], [195, 1140], [192, 1210], [186, 1280],
];

// Convert to screen coords using the canvas's own getScreenCTM.
const screenPts = await page.evaluate((vbPts) => {
  const el = document.querySelector('[data-testid="drawing-canvas-le-anterior"]');
  const ctm = el.getScreenCTM();
  const pt = el.createSVGPoint();
  return vbPts.map(([x, y]) => {
    pt.x = x; pt.y = y;
    const s = pt.matrixTransform(ctm);
    return [s.x, s.y];
  });
}, GSV_RIGHT_VB);

console.log('viewport:', VIEWPORT, '  first screen pt:', screenPts[0], '  last:', screenPts.at(-1));
console.log('canvas getScreenCTM →', await page.evaluate(() => {
  const m = document.querySelector('[data-testid="drawing-canvas-le-anterior"]').getScreenCTM();
  return { a: m.a, d: m.d, e: m.e, f: m.f };
}));

// Drive a REAL mouse via Playwright (this generates native PointerEvents).
await page.mouse.move(screenPts[0][0], screenPts[0][1]);
await page.mouse.down();
for (let i = 1; i < screenPts.length; i++) {
  await page.mouse.move(screenPts[i][0], screenPts[i][1], { steps: 4 });
}
await page.mouse.up();

await page.waitForTimeout(150);

// Read the stroke's bbox and compare with the LAST screen point fed.
const result = await page.evaluate(() => {
  const path = document.querySelector('[data-testid="drawing-canvas-le-anterior"] [data-stroke-id]');
  if (!path) return { error: 'no stroke rendered' };
  const b = path.getBoundingClientRect();
  return { bbox: { x: b.x, y: b.y, w: b.width, h: b.height, right: b.right, bottom: b.bottom } };
});
console.log('stroke bbox:', result);

const expectedFirst = screenPts[0];
const expectedLast = screenPts.at(-1);
console.log('expected stroke spans roughly:', { x_min: Math.min(expectedFirst[0], expectedLast[0]), y_min: Math.min(expectedFirst[1], expectedLast[1]), x_max: Math.max(expectedFirst[0], expectedLast[0]), y_max: Math.max(expectedFirst[1], expectedLast[1]) });

// Save a cropped screenshot of the panel for visual inspection.
const clip = await page.evaluate(() => {
  const r = document.querySelector('[data-testid="anatomy-diagram-le-anterior"]').getBoundingClientRect();
  return { x: Math.max(0, r.x - 4), y: Math.max(0, r.y - 4), width: Math.min(r.width + 8, window.innerWidth - r.x + 4), height: Math.min(r.height + 8, window.innerHeight - r.y + 4) };
});
await page.screenshot({ path: 'e2e/diag-realmouse.png', clip });
console.log('Saved: e2e/diag-realmouse.png  clip=', clip);

await browser.close();
