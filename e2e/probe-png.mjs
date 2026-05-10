// Read le-reference.png pixel-by-pixel via a headless Canvas, sample
// horizontal cross-sections at chosen Y values, and report the X coords
// of the dark pixels (= the printed vein centerlines) per leg.
//
// This data is then used to recalibrate the SVG segment <path d="..."> values.
//
// Run:  node e2e/probe-png.mjs > e2e/png-probe.json
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PNG = join(__dirname, '..', 'public', 'anatomy', 'le-reference.png');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pngBytes = await readFile(PNG);
const b64 = pngBytes.toString('base64');

const data = await page.evaluate(async (b64) => {
  const img = new Image();
  img.src = `data:image/png;base64,${b64}`;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const W = c.width, H = c.height;
  const id = ctx.getImageData(0, 0, W, H).data;
  // Sample histogram + a few row examples to find the right threshold.
  const sampleHist = new Array(8).fill(0);
  for (let i = 0; i < id.length; i += 4) {
    const a = id[i + 3];
    if (a < 128) continue;
    const v = (id[i] + id[i + 1] + id[i + 2]) / 3;
    const bucket = Math.min(7, Math.floor(v / 32));
    sampleHist[bucket]++;
  }
  const sampleRows = {};
  for (const y of [120, 200, 300, 500, 800, 1100, 1300]) {
    const row = [];
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const v = (id[i] + id[i + 1] + id[i + 2]) / 3;
      const a = id[i + 3];
      if (a > 200 && v < 200) row.push({ x, v: Math.round(v) });
    }
    sampleRows[y] = row;
  }
  return { W, H, sampleHist, sampleRows };
}, b64);

await browser.close();

console.log(JSON.stringify(data, null, 2));
