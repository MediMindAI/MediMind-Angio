// Calibration sandbox — render the PNG with PROPOSED path coords (not the
// current ones in le-anterior.svg) overlaid in green, plus the current ones
// in red, so I can see whether the proposed coords match the printed veins
// before committing them to the SVG file.
//
// Run:  node e2e/calib-test.mjs
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PNG_PATH = join(__dirname, '..', 'public', 'anatomy', 'le-reference.png');
const SVG_PATH = join(__dirname, '..', 'public', 'anatomy', 'le-anterior.svg');
const pngB64 = (await readFile(PNG_PATH)).toString('base64');
const svgText = (await readFile(SVG_PATH, 'utf8'));

const currentPaths = [];
const re = /<path\s+id="([a-z0-9-]+)"[^>]*?\sd="([^"]+)"/g;
let m;
while ((m = re.exec(svgText)) !== null) currentPaths.push({ id: m[1], d: m[2] });

// PROPOSED coordinates — derived from visual inspection of calib-top.png
// where the printed PNG has labels at known Y positions (CFV ~Y=280,
// PFV ~Y=345, SFJ ~Y=370, FV ~Y=465, GSV ~Y=555, POP ~Y=940, SSV ~Y=1180).
//
// Right leg X column: lateral=160, FV-axis=220, medial=235.
// Left leg mirrors with X' = 600 - X (lateral=440, FV-axis=380, medial=365).
const proposed = {
  'cfv-right':            'M 215,260 L 215,310',
  'sfj-right':            'M 235,335 Q 225,320 215,315',
  'pfv-right':            'M 215,315 Q 195,360 170,450',
  'fv-prox-right':        'M 215,315 C 217,400 219,470 220,540',
  'fv-mid-right':         'M 220,540 C 220,610 219,680 217,750',
  'fv-dist-right':        'M 217,750 C 216,790 215,815 215,830',
  'pop-ak-right':         'M 215,830 L 215,895',
  'pop-bk-right':         'M 215,895 Q 215,920 215,940',
  'ptv-right':            'M 215,940 Q 218,1140 220,1330',
  'per-right':            'M 215,940 Q 200,1140 195,1330',
  'gsv-prox-thigh-right': 'M 235,335 C 240,410 242,490 238,560',
  'gsv-mid-thigh-right':  'M 238,560 C 235,630 232,700 230,770',
  'gsv-dist-thigh-right': 'M 230,770 C 228,820 224,860 220,895',
  'gsv-knee-right':       'M 220,895 Q 218,920 215,940',
  'gsv-calf-right':       'M 215,940 C 210,1050 207,1180 202,1300',
  'cfv-left':             'M 385,260 L 385,310',
  'sfj-left':             'M 365,335 Q 375,320 385,315',
  'pfv-left':             'M 385,315 Q 405,360 430,450',
  'fv-prox-left':         'M 385,315 C 383,400 381,470 380,540',
  'fv-mid-left':          'M 380,540 C 380,610 381,680 383,750',
  'fv-dist-left':         'M 383,750 C 384,790 385,815 385,830',
  'pop-ak-left':          'M 385,830 L 385,895',
  'pop-bk-left':          'M 385,895 Q 385,920 385,940',
  'ptv-left':             'M 385,940 Q 382,1140 380,1330',
  'per-left':             'M 385,940 Q 400,1140 405,1330',
  'gsv-prox-thigh-left':  'M 365,335 C 360,410 358,490 362,560',
  'gsv-mid-thigh-left':   'M 362,560 C 365,630 368,700 370,770',
  'gsv-dist-thigh-left':  'M 370,770 C 372,820 376,860 380,895',
  'gsv-knee-left':        'M 380,895 Q 382,920 385,940',
  'gsv-calf-left':        'M 385,940 C 390,1050 393,1180 398,1300',
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 3000 }, deviceScaleFactor: 2 });
await page.setContent(`<!doctype html><html><head><style>body{margin:0;background:#fff}</style></head><body>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="2906" viewBox="0 0 600 1453">
  <image href="data:image/png;base64,${pngB64}" x="0" y="0" width="600" height="1453" preserveAspectRatio="xMidYMid meet" />
  <g stroke="rgba(0,0,255,0.2)" stroke-width="0.5" fill="none">
    ${Array.from({ length: 12 }, (_, i) => `<line x1="${(i + 1) * 50}" y1="0" x2="${(i + 1) * 50}" y2="1453"/>`).join('')}
    ${Array.from({ length: 29 }, (_, i) => `<line x1="0" y1="${(i + 1) * 50}" x2="600" y2="${(i + 1) * 50}"/>`).join('')}
  </g>
  <g font-size="10" fill="rgba(0,0,255,0.8)">
    ${Array.from({ length: 12 }, (_, i) => `<text x="${(i + 1) * 50 + 2}" y="11">${(i + 1) * 50}</text>`).join('')}
    ${Array.from({ length: 29 }, (_, i) => `<text x="2" y="${(i + 1) * 50 - 2}">${(i + 1) * 50}</text>`).join('')}
  </g>
  <!-- CURRENT paths in red, half-opacity -->
  <g stroke="red" stroke-width="2.5" fill="none" opacity="0.4">
    ${currentPaths.map((p) => `<path d="${p.d}"/>`).join('\n')}
  </g>
  <!-- PROPOSED paths in green -->
  <g stroke="#0a0" stroke-width="3" fill="none" opacity="0.85">
    ${Object.values(proposed).map((d) => `<path d="${d}"/>`).join('\n')}
  </g>
</svg>
</body></html>`);
await page.waitForTimeout(300);
await page.screenshot({ path: 'e2e/calib-test-top.png', clip: { x: 0, y: 0, width: 1200, height: 1453 } });
await page.screenshot({ path: 'e2e/calib-test-bot.png', clip: { x: 0, y: 1453, width: 1200, height: 1453 } });
console.log('Saved: e2e/calib-test-top.png  e2e/calib-test-bot.png');
console.log(`Current paths: ${currentPaths.length},  Proposed: ${Object.keys(proposed).length}`);
await browser.close();
