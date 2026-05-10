// Render le-reference.png (the printed anatomy) with:
//   - a coordinate grid every 50 viewBox units
//   - the current SVG segment <path d="..."> values drawn as red lines on top
// so I can see exactly where each path is vs the printed vein.
//
// Run:  node e2e/calib-overlay.mjs
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PNG_PATH = join(__dirname, '..', 'public', 'anatomy', 'le-reference.png');
const SVG_PATH = join(__dirname, '..', 'public', 'anatomy', 'le-anterior.svg');

const pngB64 = (await readFile(PNG_PATH)).toString('base64');
const svgText = (await readFile(SVG_PATH, 'utf8'));

// Extract <path id="..." d="..."> entries from the segments group.
const paths = [];
const re = /<path\s+id="([a-z0-9-]+)"[^>]*?\sd="([^"]+)"/g;
let m;
while ((m = re.exec(svgText)) !== null) paths.push({ id: m[1], d: m[2] });
console.log(`extracted ${paths.length} paths from le-anterior.svg`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 3000 }, deviceScaleFactor: 2 });
await page.setContent(`<!doctype html>
<html><head><style>
  body { margin: 0; background: #fafafa; font-family: -apple-system, system-ui, sans-serif; }
</style></head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="2906" viewBox="0 0 600 1453">
  <image href="data:image/png;base64,${pngB64}" x="0" y="0" width="600" height="1453" preserveAspectRatio="xMidYMid meet" />
  <!-- grid -->
  <g stroke="rgba(0, 0, 255, 0.2)" stroke-width="0.5" fill="none">
    ${Array.from({ length: 12 }, (_, i) => `<line x1="${(i + 1) * 50}" y1="0" x2="${(i + 1) * 50}" y2="1453"/>`).join('')}
    ${Array.from({ length: 29 }, (_, i) => `<line x1="0" y1="${(i + 1) * 50}" x2="600" y2="${(i + 1) * 50}"/>`).join('')}
  </g>
  <g font-size="9" fill="rgba(0,0,255,0.8)">
    ${Array.from({ length: 12 }, (_, i) => `<text x="${(i + 1) * 50 + 2}" y="10">${(i + 1) * 50}</text>`).join('')}
    ${Array.from({ length: 29 }, (_, i) => `<text x="2" y="${(i + 1) * 50 - 2}">${(i + 1) * 50}</text>`).join('')}
  </g>
  <!-- current SVG paths (in red) -->
  <g stroke="red" stroke-width="3" fill="none" opacity="0.6">
    ${paths.map((p) => `<path d="${p.d}"><title>${p.id}</title></path>`).join('\n')}
  </g>
</svg>
</body></html>`);
await page.waitForTimeout(300);

// Two screenshots — top half of leg (Y 0-727) and bottom half (Y 726-1453) — at 2x scale.
await page.screenshot({ path: 'e2e/calib-top.png', clip: { x: 0, y: 0, width: 1200, height: 1453 } });
await page.screenshot({ path: 'e2e/calib-bot.png', clip: { x: 0, y: 1453, width: 1200, height: 1453 } });
console.log('Saved: e2e/calib-top.png  e2e/calib-bot.png  (each 1200x1453 — top + bottom of leg)');

await browser.close();
