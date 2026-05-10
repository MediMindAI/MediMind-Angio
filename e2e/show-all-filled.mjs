// HEADED Chromium with EVERY remaining segment marked as 'normal' so all
// teal overlays render at once — letting you spot any per-vein
// misalignment immediately.
//
// Soleal was removed entirely. Segments seeded here are the complete
// surviving set (after the merge into a single combined view).
import { chromium } from 'playwright';

const URL = process.env.URL ?? 'http://localhost:3001';
const encounterId = 'all-' + Date.now();

const SIDES = ['right', 'left'];
const SEGMENTS_ANTERIOR = [
  'cfv','sfj','pfv',
  'fv-prox','fv-mid','fv-dist',
  'gsv-prox-thigh','gsv-mid-thigh','gsv-dist-thigh','gsv-knee','gsv-calf',
  'pop-ak','pop-bk',
  'ptv','per',
];
// Posterior-only segments that now live in the merged anterior SVG.
const SEGMENTS_POSTERIOR_ONLY = ['spj', 'ssv', 'gastroc'];
const ALL = [...SEGMENTS_ANTERIOR, ...SEGMENTS_POSTERIOR_ONLY];

const findings = {};
for (const seg of ALL) for (const side of SIDES) {
  findings[`${seg}-${side}`] = { competency: 'normal' };
}

const seed = {
  schemaVersion: 2, encounterId,
  header: { patientName: 'All-Veins', patientId: '01001011116', patientBirthDate: '1980-05-12', patientGender: 'male', encounterDate: '2026-05-10' },
  selectedStudyTypes: ['venousLEBilateral'],
  studies: {
    venousLEBilateral: {
      schemaVersion: 1,
      studyType: 'venousLEBilateral',
      studyDate: '2026-05-10',
      protocol: 'standard',
      findings,
      view: 'right',
      impression: '',
      impressionEdited: false,
      ceap: undefined,
      recommendations: [],
      sonographerComments: '',
      clinicianComments: '',
      drawings: [],
    },
  },
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
await page.evaluate(() => document.querySelector('[data-testid="anatomy-diagram-le-anterior"]')?.scrollIntoView({ block: 'start' }));

console.log('\n*** Browser open ***');
console.log(`*** ${Object.keys(findings).length} segments marked as 'normal'. ***`);
console.log('*** Every overlay should sit on the printed vein it represents. ***');
console.log('*** Tell me which vein drifts and I will fine-tune just that one. ***\n');

await new Promise((resolve) => {
  page.on('close', resolve);
  browser.on('disconnected', resolve);
});
