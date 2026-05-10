// Iterative verification loop. Opens Playwright, applies a template,
// captures the panel, and overlays it side-by-side with the bare PNG so
// I can see whether each printed vein has a teal stroke ON it.
//
// Run:  node e2e/verify-loop.mjs
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const URL = process.env.URL ?? 'http://localhost:3001';
const PNG = join(__dirname, '..', 'public', 'anatomy', 'le-reference.png');
const pngB64 = (await readFile(PNG)).toString('base64');

const encounterId = 'verify-' + Date.now();
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

// Open template gallery and pick "normal-bilateral".
const tplBtn = page.locator('[data-testid="open-template-gallery"], button:has-text("Templates"), button:has-text("შაბლონები")').first();
if (await tplBtn.count()) { await tplBtn.click(); await page.waitForTimeout(300); }
const card = page.locator(`[data-testid="template-card-normal-bilateral"]`);
await card.waitFor({ timeout: 5000 }).catch(() => {});
if (await card.count()) {
  const apply = page.locator(`[data-testid="template-apply-normal-bilateral"]`);
  if (await apply.count()) await apply.first().click();
  else await card.first().click();
  const confirm = page.locator('button:has-text("Apply"), button:has-text("გამოყენება"), button:has-text("Confirm")').last();
  if (await confirm.count()) await confirm.click({ trial: false }).catch(() => {});
  await page.waitForTimeout(700);
}

// Bring the anterior panel near the top of viewport, screenshot at 2x.
await page.evaluate(() => document.querySelector('[data-testid="anatomy-diagram-le-anterior"]')?.scrollIntoView({ block: 'start' }));
await page.waitForTimeout(300);

const stageRect = await page.evaluate(() => {
  const r = document.querySelector('[data-testid="anatomy-diagram-le-anterior"]').getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
console.log('Anterior stage rect:', stageRect);

await page.screenshot({ path: 'e2e/verify-rendered.png', clip: {
  x: Math.max(0, stageRect.x - 4),
  y: Math.max(0, stageRect.y - 4),
  width: Math.min(stageRect.w + 8, 1280 - stageRect.x + 4),
  height: Math.min(stageRect.h + 8, 900 - stageRect.y + 4),
} });

// Generate a side-by-side reference: bare PNG (no overlay) at the same
// aspect ratio, so I can A/B compare in two screenshots.
await page.setContent(`<!doctype html><body style="margin:0;background:#fff">
<svg width="${stageRect.w * 2}" height="${stageRect.h * 2}" viewBox="0 0 600 1453"
     xmlns="http://www.w3.org/2000/svg">
  <image href="data:image/png;base64,${pngB64}" x="0" y="0" width="600" height="1453"/>
</svg></body>`);
await page.waitForTimeout(200);
await page.screenshot({ path: 'e2e/verify-reference.png', clip: { x: 0, y: 0, width: stageRect.w * 2, height: stageRect.h * 2 } });

console.log('Saved: e2e/verify-rendered.png (with template overlay)');
console.log('Saved: e2e/verify-reference.png (bare PNG, same scale)');

await browser.close();
