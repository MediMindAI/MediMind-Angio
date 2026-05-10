// HEADED Playwright run — opens a visible Chromium window on your screen,
// navigates to the venous form, draws a stroke, and pauses with the
// browser open so you can interact / inspect it yourself.
//
// Run:  node e2e/diag-headed.mjs
import { chromium } from 'playwright';

const URL = process.env.URL ?? 'http://localhost:3001';
const encounterId = 'headed-' + Date.now();
const seed = {
  schemaVersion: 2, encounterId,
  header: { patientName: 'V', patientId: '01001011116', patientBirthDate: '1980-05-12', patientGender: 'male', encounterDate: '2026-05-10' },
  selectedStudyTypes: ['venousLEBilateral'], studies: {},
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};

const browser = await chromium.launch({ headless: false, slowMo: 200 });   // <-- visible, slowed down
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await page.addInitScript(({ id, draft }) => {
  window.localStorage.setItem(`encounter-${id}`, JSON.stringify(draft));
}, { id: encounterId, draft: seed });

await page.goto(`${URL}/encounter/${encounterId}/venousLEBilateral`);
await page.waitForSelector('[data-testid="anatomy-diagram-le-anterior"]', { timeout: 15_000 });
await page.waitForTimeout(800);

await page.locator('[data-testid="drawing-mode-toggle"] input[value="draw"]').evaluate((el) => {
  el.click(); el.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.waitForFunction(() =>
  document.querySelector('[data-testid="drawing-canvas-le-anterior"]')?.getAttribute('data-mode') === 'draw',
);
const red = page.locator('[data-testid="drawing-color-red"]');
if (await red.count()) await red.first().click();

await page.evaluate(() => {
  document.querySelector('[data-testid="anatomy-diagram-le-anterior"]')?.scrollIntoView({ block: 'start' });
});
await page.waitForTimeout(400);

// Trace right-leg GSV with REAL mouse movements you can watch.
const GSV_RIGHT_VB = [
  [215, 295], [220, 360], [222, 410], [224, 420], [222, 440], [219, 460],
  [221, 490], [223, 530], [224, 580], [223, 640],
  [221, 690], [217, 740], [213, 760], [210, 780], [208, 800],
  [205, 835], [202, 870], [199, 920], [195, 1000], [194, 1080], [192, 1210], [186, 1280],
];

const screenPts = await page.evaluate((vbPts) => {
  const el = document.querySelector('[data-testid="drawing-canvas-le-anterior"]');
  const ctm = el.getScreenCTM(); const pt = el.createSVGPoint();
  return vbPts.map(([x, y]) => { pt.x = x; pt.y = y; const s = pt.matrixTransform(ctm); return [s.x, s.y]; });
}, GSV_RIGHT_VB);

console.log('Drawing GSV trace…');
await page.mouse.move(screenPts[0][0], screenPts[0][1]);
await page.mouse.down();
for (let i = 1; i < screenPts.length; i++) {
  await page.mouse.move(screenPts[i][0], screenPts[i][1], { steps: 8 });
}
await page.mouse.up();

console.log('\n*** Browser is left OPEN. Try drawing yourself with the mouse. ***');
console.log('*** Close the browser window when done — script will exit then. ***\n');

// Wait until the user closes the browser window.
await new Promise((resolve) => {
  page.on('close', resolve);
  browser.on('disconnected', resolve);
});
