// Pixel-level trace of le-reference.png. For each scan-row Y, find dark
// pixel runs (= printed line-art including leg silhouette + vein lines +
// label text), then group them per leg. Output the runs as JSON so I can
// see exactly where each printed vein sits.
//
// Run:  node scripts/trace-veins.mjs > scripts/trace-veins.json
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PNG = join(__dirname, '..', 'public', 'anatomy', 'le-reference.png');
const b64 = (await readFile(PNG)).toString('base64');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const data = await page.evaluate(async (b64) => {
  const img = new Image();
  img.src = `data:image/png;base64,${b64}`;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const W = c.width, H = c.height;
  const px = ctx.getImageData(0, 0, W, H).data;
  // A pixel is "ink" if it's opaque AND dark (RGB avg < 100) OR semi-opaque dark.
  const isInk = (i) => {
    const a = px[i + 3];
    if (a < 64) return false;
    const v = (px[i] + px[i + 1] + px[i + 2]) / 3;
    return v < 120;
  };

  const rows = [];
  // Sample every Y, but only keep rows that have ink.
  for (let y = 0; y < H; y += 1) {
    const runs = [];
    let runStart = -1;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (isInk(i)) { if (runStart < 0) runStart = x; }
      else if (runStart >= 0) {
        const len = x - runStart;
        if (len >= 1 && len <= 60) {
          runs.push({ x0: runStart, x1: x - 1, mid: Math.round((runStart + x - 1) / 2), len });
        }
        runStart = -1;
      }
    }
    if (runs.length) rows.push({ y, runs });
  }
  return { W, H, rowCount: rows.length, rows };
}, b64);

await browser.close();
process.stdout.write(JSON.stringify({ W: data.W, H: data.H, rowCount: data.rowCount }, null, 2));
process.stdout.write('\n');
// Also dump a compact CSV of (y, run-mids) so I can grep specific rows.
console.error('=== CSV: y -> mid_x (sorted) ===');
for (const r of data.rows) {
  if (r.y % 10 !== 0) continue;
  const mids = r.runs.map((rn) => rn.mid).sort((a, b) => a - b);
  console.error(`${r.y},${mids.join(',')}`);
}
