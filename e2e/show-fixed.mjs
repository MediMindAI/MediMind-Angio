// Open a HEADED Chromium with findings pre-seeded so the calibrated
// segment overlay paths are visible without any modal in the way.
//
// Run:  node e2e/show-fixed.mjs
import { chromium } from 'playwright';

const URL = process.env.URL ?? 'http://localhost:3001';
const encounterId = 'show-' + Date.now();

const allSegmentIds = [
  'cfv','sfj','pfv','fv-prox','fv-mid','fv-dist','pop-ak','pop-bk','ptv','per',
  'gsv-prox-thigh','gsv-mid-thigh','gsv-dist-thigh','gsv-knee','gsv-calf',
];
const findings = {};
for (const seg of allSegmentIds) {
  for (const side of ['right', 'left']) findings[`${seg}-${side}`] = { competency: 'normal' };
}

const seed = {
  schemaVersion: 2, encounterId,
  header: { patientName: 'V', patientId: '01001011116', patientBirthDate: '1980-05-12', patientGender: 'male', encounterDate: '2026-05-10' },
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

console.log('\n*** Browser open with all segments marked NORMAL ***');
console.log('*** All teal overlay strokes should sit on the printed veins. ***');
console.log('*** Compare this with le-reference.png to verify alignment. ***\n');

await new Promise((resolve) => {
  page.on('close', resolve);
  browser.on('disconnected', resolve);
});
