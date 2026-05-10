// HEADED iterative verification — opens a visible Chromium window,
// applies the "normal-bilateral" template (handles the confirm modal),
// screenshots the panel, and returns the rendered PNG path.
// The browser stays open so I can visually inspect.
//
// Run:  node e2e/verify-headed.mjs
import { chromium } from 'playwright';

const URL = process.env.URL ?? 'http://localhost:3001';
const encounterId = 'verify-' + Date.now();
const seed = {
  schemaVersion: 2, encounterId,
  header: { patientName: 'V', patientId: '01001011116', patientBirthDate: '1980-05-12', patientGender: 'male', encounterDate: '2026-05-10' },
  selectedStudyTypes: ['venousLEBilateral'], studies: {},
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};

const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
const page = await ctx.newPage();
await page.addInitScript(({ id, draft }) => {
  window.localStorage.setItem(`encounter-${id}`, JSON.stringify(draft));
}, { id: encounterId, draft: seed });

await page.goto(`${URL}/encounter/${encounterId}/venousLEBilateral`);
await page.waitForSelector('[data-testid="anatomy-diagram-le-anterior"]', { timeout: 15_000 });
await page.waitForTimeout(800);

// Open template gallery
const tplBtn = page.locator('[data-testid="open-template-gallery"], button:has-text("Templates"), button:has-text("შაბლონები")').first();
if (await tplBtn.count()) {
  await tplBtn.click();
  await page.waitForTimeout(400);
}

// Click apply on normal-bilateral
const apply = page.locator('[data-testid="template-apply-normal-bilateral"]').first();
if (await apply.count()) {
  await apply.click();
  await page.waitForTimeout(400);
}

// Confirm whatever modal appears
const confirms = [
  '[data-testid="confirm-apply-template"]',
  'button:has-text("Apply")',
  'button:has-text("გამოყენება")',
  'button:has-text("გადაწერა")',
  'button:has-text("Yes")',
  'button:has-text("Confirm")',
];
for (const sel of confirms) {
  const btn = page.locator(sel).last();
  if (await btn.count()) {
    try {
      await btn.click({ timeout: 1500 });
      await page.waitForTimeout(300);
      break;
    } catch {}
  }
}

// Wait for any modal to close
await page.waitForTimeout(800);
await page.evaluate(() => document.querySelector('[data-testid="anatomy-diagram-le-anterior"]')?.scrollIntoView({ block: 'start' }));
await page.waitForTimeout(400);

// Screenshot just the panel (no modal in the way)
const r = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="anatomy-diagram-le-anterior"]');
  const b = el.getBoundingClientRect();
  return { x: b.x, y: b.y, w: b.width, h: b.height };
});
console.log('Stage rect:', r);
await page.screenshot({ path: 'e2e/verify-rendered.png', clip: {
  x: Math.max(0, r.x - 4), y: Math.max(0, r.y - 4),
  width: Math.min(r.w + 8, 1400 - r.x + 4),
  height: Math.min(r.h + 8, 1000 - r.y + 4),
} });

console.log('\n*** Browser window is OPEN. Take a look. ***');
console.log('*** Close the browser window to end the script. ***\n');
await new Promise((resolve) => {
  page.on('close', resolve);
  browser.on('disconnected', resolve);
});
