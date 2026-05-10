// Verify in the live browser that:
//   1. AnatomyView's wrapper div is position:absolute (overlay mode fix applied)
//   2. The inline <svg> has width=100% height=100% attributes (colorizeSvg fix)
//   3. Anatomy + canvas SVGs have identical bounding rects (the alignment goal)
import { chromium } from 'playwright';

const URL = process.env.URL ?? 'http://localhost:3001';
const encounterId = 'verify-' + Date.now();
const seed = {
  schemaVersion: 2, encounterId,
  header: { patientName: 'V', patientId: '01001011116', patientBirthDate: '1980-05-12', patientGender: 'male', encounterDate: '2026-05-10' },
  selectedStudyTypes: ['venousLEBilateral'], studies: {},
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.addInitScript(({ id, draft }) => {
  window.localStorage.setItem(`encounter-${id}`, JSON.stringify(draft));
}, { id: encounterId, draft: seed });

await page.goto(`${URL}/encounter/${encounterId}/venousLEBilateral`);
await page.waitForSelector('[data-testid="anatomy-diagram-le-anterior"]', { timeout: 15_000 });
await page.waitForTimeout(1000);

const audit = await page.evaluate(() => {
  const stage = document.querySelector('[data-testid="anatomy-diagram-le-anterior"]');
  // The first child div of stage is the AnatomyView outer wrapper
  const wrapper = stage.querySelector(':scope > div');
  const canvas = stage.querySelector('[data-testid="drawing-canvas-le-anterior"]');
  // The anatomy <svg> is inside wrapper (sibling div hosts dangerouslySetInnerHTML)
  const anatomySvg = wrapper?.querySelector('svg');
  const wcs = wrapper ? getComputedStyle(wrapper) : null;
  const ccs = canvas ? getComputedStyle(canvas) : null;
  const acs = anatomySvg ? getComputedStyle(anatomySvg) : null;
  return {
    wrapperPosition: wcs?.position,
    wrapperInset: `${wcs?.top}/${wcs?.right}/${wcs?.bottom}/${wcs?.left}`,
    canvasPosition: ccs?.position,
    anatomySvgWidthAttr: anatomySvg?.getAttribute('width'),
    anatomySvgHeightAttr: anatomySvg?.getAttribute('height'),
    anatomySvgComputed: { width: acs?.width, height: acs?.height },
    canvasComputed: { width: ccs?.width, height: ccs?.height },
    anatomyRect: anatomySvg?.getBoundingClientRect(),
    canvasRect: canvas?.getBoundingClientRect(),
  };
});
console.log(JSON.stringify(audit, null, 2));

const ax = audit.anatomyRect, cx = audit.canvasRect;
if (ax && cx) {
  const same = Math.abs(ax.x - cx.x) < 1 && Math.abs(ax.y - cx.y) < 1
    && Math.abs(ax.width - cx.width) < 2 && Math.abs(ax.height - cx.height) < 4;
  console.log(same ? 'PASS: anatomy and canvas rects coincide' : 'FAIL: rects differ');
}

await browser.close();
