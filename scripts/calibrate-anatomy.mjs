// One-shot calibration — replace each <path id="..." d="..."> in the
// anatomy SVGs with coordinates measured pixel-level from le-reference.png
// (see scripts/trace-veins.csv for the row-by-row probe).
//
// Right leg axes (measured at Y=500-700 mid-thigh):
//   FV    X = 205   (range 197-211)
//   GSV   X = 222   (range 219-226)
//   PFV   X = 148   (lateral; visible at Y=480+)
// Left leg mirrors (X' = 600 - X):
//   FV    X = 395
//   GSV   X = 378
//   PFV   X = 452
//
// Y landmarks read from CSV:
//   CFV indicator visible from Y=200, vein clear from Y=270
//   SFJ junction at Y=380-400
//   POP knee at Y=890-940
//   PTV/PER fork at Y=940
//   Veins fade out around Y=1280-1300
//
// Run:  node scripts/calibrate-anatomy.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ANT = join(__dirname, '..', 'public', 'anatomy', 'le-anterior.svg');
const POST = join(__dirname, '..', 'public', 'anatomy', 'le-posterior.svg');

const ANTERIOR = {
  // CFV: tracks medial-to-central (X=222 at Y=210 → X=205 at Y=275)
  'cfv-right':            'M 222,210 C 219,235 213,255 205,275',
  'sfj-right':            'M 222,275 Q 213,280 205,283',
  // PFV branches off and runs lateral, descends to X≈148 by Y≈480
  'pfv-right':            'M 205,290 Q 175,360 152,470',
  // FV: vertical line at X≈205 from SFJ down to popliteal
  'fv-prox-right':        'M 205,283 C 205,340 205,400 205,470',
  'fv-mid-right':         'M 205,470 C 207,540 207,610 207,680',
  'fv-dist-right':        'M 207,680 C 206,750 205,800 205,830',
  'pop-ak-right':         'M 205,830 L 200,895',
  'pop-bk-right':         'M 200,895 Q 198,920 198,940',
  // PTV/PER fork at Y=940; PTV slightly medial, PER lateral
  'ptv-right':            'M 198,940 Q 196,1140 192,1280',
  'per-right':            'M 198,940 Q 178,1140 168,1280',
  // GSV: vertical at X≈222, curves slightly lateral toward knee
  'gsv-prox-thigh-right': 'M 222,278 C 224,340 225,400 225,470',
  'gsv-mid-thigh-right':  'M 225,470 C 225,540 224,610 222,680',
  'gsv-dist-thigh-right': 'M 222,680 C 218,750 215,810 213,895',
  'gsv-knee-right':       'M 213,895 Q 210,920 207,940',
  'gsv-calf-right':       'M 207,940 Q 195,1100 185,1280',
  // Left leg = mirror via X' = 600 - X
  'cfv-left':             'M 378,210 C 381,235 387,255 395,275',
  'sfj-left':             'M 378,275 Q 387,280 395,283',
  'pfv-left':             'M 395,290 Q 425,360 448,470',
  'fv-prox-left':         'M 395,283 C 395,340 395,400 395,470',
  'fv-mid-left':          'M 395,470 C 393,540 393,610 393,680',
  'fv-dist-left':         'M 393,680 C 394,750 395,800 395,830',
  'pop-ak-left':          'M 395,830 L 400,895',
  'pop-bk-left':          'M 400,895 Q 402,920 402,940',
  'ptv-left':             'M 402,940 Q 404,1140 408,1280',
  'per-left':             'M 402,940 Q 422,1140 432,1280',
  'gsv-prox-thigh-left':  'M 378,278 C 376,340 375,400 375,470',
  'gsv-mid-thigh-left':   'M 375,470 C 375,540 376,610 378,680',
  'gsv-dist-thigh-left':  'M 378,680 C 382,750 385,810 387,895',
  'gsv-knee-left':        'M 387,895 Q 390,920 393,940',
  'gsv-calf-left':        'M 393,940 Q 405,1100 415,1280',
};

const POSTERIOR = {
  'pop-ak-right':    'M 205,830 L 200,895',
  'pop-bk-right':    'M 200,895 Q 198,920 198,940',
  'spj-right':       'M 222,895 Q 213,895 205,895',
  'ssv-right':       'M 222,895 Q 207,1100 195,1280',
  'gastroc-right':   'M 188,990 Q 175,1060 180,1140',
  'soleal-right':    'M 222,990 Q 226,1110 220,1240',
  'ptv-right':       'M 198,940 Q 196,1140 192,1280',
  'per-right':       'M 198,940 Q 178,1140 168,1280',
  'gsv-calf-right':  'M 207,940 Q 195,1100 185,1280',
  'pop-ak-left':     'M 395,830 L 400,895',
  'pop-bk-left':     'M 400,895 Q 402,920 402,940',
  'spj-left':        'M 378,895 Q 387,895 395,895',
  'ssv-left':        'M 378,895 Q 393,1100 405,1280',
  'gastroc-left':    'M 412,990 Q 425,1060 420,1140',
  'soleal-left':     'M 378,990 Q 374,1110 380,1240',
  'ptv-left':        'M 402,940 Q 404,1140 408,1280',
  'per-left':        'M 402,940 Q 422,1140 432,1280',
  'gsv-calf-left':   'M 393,940 Q 405,1100 415,1280',
};

async function applyCalibration(filepath, table) {
  const original = await readFile(filepath, 'utf8');
  let out = original;
  let updated = 0, missing = [];
  for (const [id, newD] of Object.entries(table)) {
    const re = new RegExp(`(<path\\s+id="${id}"[^>]*?\\sd=")[^"]+(")`);
    if (re.test(out)) { out = out.replace(re, `$1${newD}$2`); updated++; }
    else missing.push(id);
  }
  if (missing.length) console.log(`  WARN missing in ${filepath}: ${missing.join(', ')}`);
  if (out !== original) {
    await writeFile(filepath, out, 'utf8');
    console.log(`  ${filepath}: updated ${updated} paths`);
  } else console.log(`  ${filepath}: no changes`);
}

console.log('Calibrating anatomy SVG paths from pixel-traced PNG data:');
await applyCalibration(ANT, ANTERIOR);
await applyCalibration(POST, POSTERIOR);
console.log('Done.');
