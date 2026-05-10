// Apply hand-traced vein paths from public/anatomy/calibrate.html to the
// real SVG files (le-anterior.svg + le-posterior.svg).
//
// Input JSON shape (consolidated major vessels, point arrays):
//   {
//     "CFV-right":     [[x,y],[x,y],…],
//     "SFJ-right":     [[x,y],…],
//     "PFV-right":     [[x,y],…],
//     "FV-right":      [[x,y],…],   // split → fv-prox / fv-mid / fv-dist
//     "GSV-right":     [[x,y],…],   // split → gsv-prox-thigh / mid / dist / knee / calf
//     "POP-right":     [[x,y],…],   // split → pop-ak / pop-bk
//     "Tibial-right":  [[x,y],…],   // → ptv (duplicated to per for now)
//     "SSV-right":     [[x,y],…],   // posterior only
//     …same with -left
//   }
//
// Run:  node scripts/apply-calibration-json.mjs [<path-to-json>]
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

let jsonPath = process.argv[2] ?? join(homedir(), 'Downloads', 'anatomy-calibration.json');
if (!existsSync(jsonPath)) {
  for (const f of [join(process.cwd(), 'anatomy-calibration.json'), join(homedir(), 'Desktop', 'anatomy-calibration.json')]) {
    if (existsSync(f)) { jsonPath = f; break; }
  }
}
if (!existsSync(jsonPath)) {
  console.error(`ERROR: calibration JSON not found at ${jsonPath}`);
  process.exit(1);
}

const raw = JSON.parse(await readFile(jsonPath, 'utf8'));
console.log(`Reading ${jsonPath}`);
console.log(`  traces: ${Object.keys(raw).join(', ')}`);

// ---------- helpers ----------
function pointsToD(pts) {
  if (pts.length < 2) return '';
  return 'M ' + pts.map(([x, y]) => `${Math.round(x)},${Math.round(y)}`).join(' L ');
}

// Slice a trace into Y-range buckets. Each bucket is a [yMin, yMax) range.
// Bucket assignment uses the point's Y. Adjacent points in the same bucket
// stay together. Boundaries between buckets get duplicated as the last
// point of one + first point of the next so the rendered segments meet.
function splitByY(points, buckets) {
  const out = buckets.map(() => []);
  let lastBucketIdx = -1;
  for (const pt of points) {
    const y = pt[1];
    const idx = buckets.findIndex(([lo, hi]) => y >= lo && y < hi);
    if (idx === -1) continue;
    // Boundary stitching: if we changed buckets, duplicate the prior point
    // into the new bucket so the path segments visually connect.
    if (idx !== lastBucketIdx && lastBucketIdx >= 0 && out[lastBucketIdx].length > 0) {
      out[idx].push(out[lastBucketIdx][out[lastBucketIdx].length - 1]);
    }
    out[idx].push(pt);
    lastBucketIdx = idx;
  }
  return out;
}

// Express each split result as either a path-d string or empty if too short.
function bucketsToD(bucketArrays) {
  return bucketArrays.map((pts) => (pts.length >= 2 ? pointsToD(pts) : null));
}

// ---------- expansion rules ----------
// For each consolidated id from the calibration tool, produce a map of
// { svgPathId: d-attribute } that the SVG editor below will write.
function expand(id, points) {
  const side = id.endsWith('-right') ? 'right' : 'left';

  if (id.startsWith('CFV-'))  return { [`cfv-${side}`]: pointsToD(points) };
  if (id.startsWith('SFJ-'))  return { [`sfj-${side}`]: pointsToD(points) };
  if (id.startsWith('PFV-'))  return { [`pfv-${side}`]: pointsToD(points) };
  if (id.startsWith('SSV-'))  return { [`ssv-${side}`]: pointsToD(points) };

  if (id.startsWith('FV-')) {
    // Split into prox / mid / dist by Y.
    const [prox, mid, dist] = bucketsToD(splitByY(points, [[0, 470], [470, 680], [680, 1453]]));
    const map = {};
    if (prox) map[`fv-prox-${side}`] = prox;
    if (mid)  map[`fv-mid-${side}`]  = mid;
    if (dist) map[`fv-dist-${side}`] = dist;
    return map;
  }
  if (id.startsWith('GSV-')) {
    // 5 sub-segments along the GSV.
    const buckets = [[0, 470], [470, 680], [680, 895], [895, 940], [940, 1453]];
    const ids = [`gsv-prox-thigh-${side}`, `gsv-mid-thigh-${side}`, `gsv-dist-thigh-${side}`, `gsv-knee-${side}`, `gsv-calf-${side}`];
    const ds = bucketsToD(splitByY(points, buckets));
    const map = {};
    for (let i = 0; i < ids.length; i++) if (ds[i]) map[ids[i]] = ds[i];
    return map;
  }
  if (id.startsWith('POP-')) {
    const [ak, bk] = bucketsToD(splitByY(points, [[0, 895], [895, 1453]]));
    const map = {};
    if (ak) map[`pop-ak-${side}`] = ak;
    if (bk) map[`pop-bk-${side}`] = bk;
    return map;
  }
  if (id.startsWith('Tibial-')) {
    // The PNG illustrates a single tibial trace; assign it to both PTV
    // and PER (clinical: PTV is the principal posterior-tibial vein
    // observed on duplex; PER follows the same channel below the
    // tibial-peroneal trunk). Adjust manually if more granularity is
    // needed later.
    const d = pointsToD(points);
    return { [`ptv-${side}`]: d, [`per-${side}`]: d };
  }
  console.warn(`  Unknown consolidated id: ${id} — skipped`);
  return {};
}

// Expand every consolidated trace into SVG path edits.
const edits = {};
for (const [id, points] of Object.entries(raw)) {
  if (!Array.isArray(points) || points.length < 2) continue;
  for (const [svgId, d] of Object.entries(expand(id, points))) edits[svgId] = d;
}
console.log(`  expanded to ${Object.keys(edits).length} SVG path edits`);

// ---------- write to both SVG files (paths only appear in whichever file owns them) ----------
async function applyTo(filepath) {
  const original = await readFile(filepath, 'utf8');
  let out = original;
  let updated = 0;
  for (const [id, d] of Object.entries(edits)) {
    const re = new RegExp(`(<path\\s+id="${id}"[^>]*?\\sd=")[^"]+(")`);
    if (re.test(out)) { out = out.replace(re, `$1${d}$2`); updated++; }
  }
  if (out !== original) {
    await writeFile(filepath, out, 'utf8');
    console.log(`  ${filepath}: updated ${updated} paths`);
  } else {
    console.log(`  ${filepath}: no matching paths`);
  }
}

await applyTo(join(ROOT, 'public', 'anatomy', 'le-anterior.svg'));
await applyTo(join(ROOT, 'public', 'anatomy', 'le-posterior.svg'));
console.log('\nDone. Hard-reload the app and re-apply your template to verify.');
