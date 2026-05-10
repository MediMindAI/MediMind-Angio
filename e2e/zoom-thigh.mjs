// Zoom into the upper-thigh region of le-reference.png at 4x with the
// CURRENT (post-calibration) paths from le-anterior.svg overlaid in
// green — so I can see pixel-level whether the green sits ON the
// printed black vein lines.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PNG = join(__dirname, '..', 'public', 'anatomy', 'le-reference.png');
const SVG = join(__dirname, '..', 'public', 'anatomy', 'le-anterior.svg');
const pngB64 = (await readFile(PNG)).toString('base64');
const svgText = (await readFile(SVG, 'utf8'));

const paths = [];
const re = /<path\s+id="([a-z0-9-]+)"[^>]*?\sd="([^"]+)"/g;
let m; while ((m = re.exec(svgText)) !== null) paths.push({ id: m[1], d: m[2] });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 2400, height: 1800 }, deviceScaleFactor: 2 });

// Show 4x zoom of viewBox region 0..600 X 200..800 Y (upper thigh).
await page.setContent(`<!doctype html><body style="margin:0;background:#fff">
<svg width="2400" height="1800" viewBox="0 200 600 600"
     xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <image href="data:image/png;base64,${pngB64}" x="0" y="0" width="600" height="1453"/>
  <!-- grid every 25 -->
  <g stroke="rgba(0,0,255,0.18)" stroke-width="0.4" fill="none">
    ${Array.from({ length: 24 }, (_, i) => `<line x1="${(i + 1) * 25}" y1="0" x2="${(i + 1) * 25}" y2="1453"/>`).join('')}
    ${Array.from({ length: 58 }, (_, i) => `<line x1="0" y1="${(i + 1) * 25}" x2="600" y2="${(i + 1) * 25}"/>`).join('')}
  </g>
  <g font-size="6" fill="rgba(0,0,255,0.85)">
    ${Array.from({ length: 24 }, (_, i) => `<text x="${(i + 1) * 25 + 1}" y="207">${(i + 1) * 25}</text>`).join('')}
    ${Array.from({ length: 28 }, (_, i) => `<text x="2" y="${200 + (i + 1) * 25 - 1}">${200 + (i + 1) * 25}</text>`).join('')}
  </g>
  <!-- paths in green -->
  <g stroke="#0a0" stroke-width="2" fill="none" opacity="0.9">
    ${paths.map((p) => `<path d="${p.d}"><title>${p.id}</title></path>`).join('\n')}
  </g>
</svg></body>`);
await page.waitForTimeout(300);
await page.screenshot({ path: 'e2e/zoom-thigh.png', clip: { x: 0, y: 0, width: 2400, height: 1800 } });
console.log('Saved e2e/zoom-thigh.png');
await browser.close();
