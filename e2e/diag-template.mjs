// Apply a template, then capture how the colored segment overlay paths
// align with the printed PNG vein lines. This is what the user sees when
// they click "Apply template" — colored teal/red strokes drawn over the
// SVG that should sit ON the printed veins.
//
// Run:  node e2e/diag-template.mjs
import { chromium } from 'playwright';

const URL = process.env.URL ?? 'http://localhost:3001';
const encounterId = 'tpl-' + Date.now();
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

// Use the anatomy-debug query so the wide hit-zone paths are visible too.
await page.goto(`${URL}/encounter/${encounterId}/venousLEBilateral`);
await page.waitForSelector('[data-testid="anatomy-diagram-le-anterior"]', { timeout: 15_000 });
await page.waitForTimeout(800);

// Dismiss any onboarding / first-load tooltip popups before opening template gallery.
await page.keyboard.press('Escape').catch(() => {});
await page.waitForTimeout(150);

// Apply the "normal-bilateral" template via the gallery.
const templateButton = page.locator('[data-testid="open-template-gallery"], button:has-text("Templates"), button:has-text("შაბლონები")').first();
if (await templateButton.count()) {
  await templateButton.click();
  await page.waitForTimeout(400);
}

const tplId = 'normal-bilateral';
const apply = page.locator(`[data-testid="template-apply-${tplId}"]`).first();
if (await apply.count()) {
  await apply.click();
  await page.waitForTimeout(400);
}

// Confirm modal — find any prominent "primary" button in an open modal.
// ConfirmDialog doesn't have a testid, so click the right-most filled
// button in the dialog's footer.
for (let i = 0; i < 3; i++) {
  const primary = page.locator('[role="dialog"] button').last();
  if (await primary.count()) {
    try { await primary.click({ timeout: 800 }); break; } catch {}
  }
  // fallback: press Enter on focused dialog
  await page.keyboard.press('Enter').catch(() => {});
  await page.waitForTimeout(200);
}

// Wait for segments to repaint with overlay color.
await page.waitForTimeout(800);

// Belt-and-braces — seed competency directly into the venous-LE study state
// in case template UI flow failed (e.g. dialog never opened on this build).
await page.evaluate(() => {
  const allSegmentIds = [
    'cfv','sfj','pfv','fv-prox','fv-mid','fv-dist','pop-ak','pop-bk','ptv','per',
    'gsv-prox-thigh','gsv-mid-thigh','gsv-dist-thigh','gsv-knee','gsv-calf',
  ];
  const findings = {};
  for (const seg of allSegmentIds) {
    for (const side of ['right', 'left']) {
      findings[`${seg}-${side}`] = { competency: 'normal' };
    }
  }
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith('encounter-')) {
      try {
        const obj = JSON.parse(localStorage.getItem(k));
        obj.studies = obj.studies ?? {};
        obj.studies.venousLEBilateral = obj.studies.venousLEBilateral ?? { schemaVersion: 1, studyType: 'venousLEBilateral' };
        obj.studies.venousLEBilateral.findings = findings;
        localStorage.setItem(k, JSON.stringify(obj));
      } catch {}
    }
  }
});
await page.reload();
await page.waitForSelector('[data-testid="anatomy-diagram-le-anterior"]', { timeout: 15_000 });
await page.waitForTimeout(800);

// Bring the anterior panel into view and screenshot just it.
await page.evaluate(() => {
  document.querySelector('[data-testid="anatomy-diagram-le-anterior"]')?.scrollIntoView({ block: 'start' });
});
await page.waitForTimeout(300);

const clip = await page.evaluate(() => {
  const r = document.querySelector('[data-testid="anatomy-diagram-le-anterior"]').getBoundingClientRect();
  return { x: Math.max(0, r.x - 4), y: Math.max(0, r.y - 4), width: Math.min(r.width + 8, window.innerWidth - r.x + 4), height: Math.min(r.height + 8, window.innerHeight - r.y + 4) };
});
await page.screenshot({ path: 'e2e/diag-template-prod.png', clip });
console.log('Saved: e2e/diag-template-prod.png');

// Also capture below the fold (the lower half of the panel).
await page.evaluate(() => {
  const stage = document.querySelector('[data-testid="anatomy-diagram-le-anterior"]');
  stage.scrollIntoView({ block: 'end' });
});
await page.waitForTimeout(300);
const clip2 = await page.evaluate(() => {
  const r = document.querySelector('[data-testid="anatomy-diagram-le-anterior"]').getBoundingClientRect();
  return { x: Math.max(0, r.x - 4), y: Math.max(0, r.y - 4), width: Math.min(r.width + 8, window.innerWidth - r.x + 4), height: Math.min(r.height + 8, window.innerHeight - r.y + 4) };
});
await page.screenshot({ path: 'e2e/diag-template-prod-bottom.png', clip: clip2 });
console.log('Saved: e2e/diag-template-prod-bottom.png');

await browser.close();
