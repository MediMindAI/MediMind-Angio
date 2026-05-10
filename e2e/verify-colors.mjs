// Verify the new 5-state competency palette by seeding different
// states and screenshotting each result.
//   1. All normal     → expect every overlay to be sky-blue.
//   2. Acute DVT      → CFV/FV/POP on right leg should be red (occluded).
//   3. GSV reflux     → GSV chain on right should be amber (incompetent).
//   4. Inconclusive   → marked segment renders gray.
//
// Run:  node e2e/verify-colors.mjs
import { chromium } from 'playwright';

const URL = process.env.URL ?? 'http://localhost:3001';

const ANTERIOR_BASE = [
  'cfv','sfj','pfv','fv-prox','fv-mid','fv-dist',
  'gsv-prox-thigh','gsv-mid-thigh','gsv-dist-thigh','gsv-knee','gsv-calf',
  'pop-ak','pop-bk','ptv','per',
];

function seedWith(findings) {
  const id = 'col-' + Math.floor(Math.random() * 1e6);
  return {
    id,
    draft: {
      schemaVersion: 2, encounterId: id,
      header: { patientName: 'V', patientId: '01001011116', patientBirthDate: '1980-05-12', patientGender: 'male', encounterDate: '2026-05-10' },
      selectedStudyTypes: ['venousLEBilateral'],
      studies: {
        venousLEBilateral: {
          schemaVersion: 1, studyType: 'venousLEBilateral', studyDate: '2026-05-10', protocol: 'standard',
          findings, view: 'right',
          impression: '', impressionEdited: false,
          ceap: undefined, recommendations: [],
          sonographerComments: '', clinicianComments: '',
          drawings: [],
        },
      },
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
  };
}

const browser = await chromium.launch({ headless: true });

async function shoot(label, findings) {
  const { id, draft } = seedWith(findings);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.addInitScript(({ id, draft }) => {
    localStorage.setItem(`encounter-${id}`, JSON.stringify(draft));
  }, { id, draft });
  await page.goto(`${URL}/encounter/${id}/venousLEBilateral`);
  await page.waitForSelector('[data-testid="anatomy-diagram-le-anterior"]', { timeout: 15_000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelector('[data-testid="anatomy-diagram-le-anterior"]')?.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(200);
  const clip = await page.evaluate(() => {
    const r = document.querySelector('[data-testid="anatomy-diagram-le-anterior"]').getBoundingClientRect();
    return { x: Math.max(0, r.x - 4), y: Math.max(0, r.y - 4), width: Math.min(r.width + 8, 1280 - r.x + 4), height: Math.min(r.height + 8, 900 - r.y + 4) };
  });
  await page.screenshot({ path: `e2e/colors-${label}.png`, clip });
  console.log(`Saved e2e/colors-${label}.png`);
  await ctx.close();
}

// Test 1 — all-normal
{
  const f = {};
  for (const base of ANTERIOR_BASE) for (const side of ['right','left']) {
    f[`${base}-${side}`] = {};   // empty → deriveCompetency returns 'normal'
  }
  await shoot('all-normal', f);
}

// Test 2 — acute DVT on right CFV+FV+POP
{
  const f = {};
  for (const base of ANTERIOR_BASE) for (const side of ['right','left']) {
    f[`${base}-${side}`] = {};
  }
  for (const seg of ['cfv-right','fv-prox-right','fv-mid-right','fv-dist-right','pop-ak-right','pop-bk-right']) {
    f[seg] = { compressibility: 'non-compressible', thrombosis: 'acute' };
  }
  await shoot('dvt-right', f);
}

// Test 3 — GSV reflux bilateral
{
  const f = {};
  for (const base of ANTERIOR_BASE) for (const side of ['right','left']) {
    f[`${base}-${side}`] = {};
  }
  for (const side of ['right','left']) {
    for (const seg of ['gsv-prox-thigh','gsv-mid-thigh','gsv-dist-thigh','gsv-knee','gsv-calf']) {
      f[`${seg}-${side}`] = { refluxDurationMs: 950 };
    }
  }
  await shoot('reflux-bilateral', f);
}

// Test 4 — inconclusive on one segment
{
  const f = {};
  for (const base of ANTERIOR_BASE) for (const side of ['right','left']) {
    f[`${base}-${side}`] = {};
  }
  f['ptv-right'] = { competencyOverride: 'inconclusive' };
  await shoot('inconclusive', f);
}

await browser.close();
