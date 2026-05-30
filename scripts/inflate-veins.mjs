// inflate-veins.mjs — build smooth, connected, carotid-style FILLED venous
// vessels from the user's hand-calibrated centerlines.
//
// Key idea (why this looks clean, not like disjoint sticks): veins are grouped
// into anatomical CHAINS (e.g. common-femoral -> femoral -> popliteal -> tibial,
// or the whole great saphenous). Each chain is concatenated into ONE centerline,
// smoothed as a whole, and given ONE tapering width profile. It's then sliced
// back into the named sub-segments, where adjacent slices SHARE the identical
// boundary cross-section -> no gaps, no width steps, no junction protrusions.
// Rounded caps appear only at true free ends; internal joins are flat & shared.
//
// Run:  node scripts/inflate-veins.mjs

import { Potrace } from 'potrace';
import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ANATOMY = join(ROOT, 'public', 'anatomy');

// Per-y leg-outline bounds (sampled from the silhouette via the browser; see
// scripts/leg-bounds.json). Used to keep vessels INSIDE the leg by bending the
// centerline to follow the taper instead of clipping it off.
const LEG_BOUNDS = JSON.parse(readFileSync(join(__dirname, 'leg-bounds.json'), 'utf8'));
function spanForSide(spans, side) {
  if (spans.length >= 2) return side === 'left' ? spans[1] : spans[0];
  return spans[0]; // pelvis region: single span shared by both sides
}
function legBoundsAt(y, side) {
  const b = LEG_BOUNDS;
  if (y <= b[0].y) return spanForSide(b[0].spans, side);
  if (y >= b[b.length - 1].y) return spanForSide(b[b.length - 1].spans, side);
  for (let i = 0; i < b.length - 1; i++) {
    if (y >= b[i].y && y <= b[i + 1].y) {
      const t = (y - b[i].y) / ((b[i + 1].y - b[i].y) || 1);
      const s0 = spanForSide(b[i].spans, side);
      const s1 = spanForSide(b[i + 1].spans, side);
      return [s0[0] + (s1[0] - s0[0]) * t, s0[1] + (s1[1] - s0[1]) * t];
    }
  }
  return spanForSide(b[b.length - 1].spans, side);
}
// Pull each centerline point inward so the vessel (center ± half-width) stays
// within the leg outline at that height. `halfAt(i)` gives the half-width.
function clampToLeg(points, halfAt, side) {
  return points.map((p, i) => {
    const [lo, hi] = legBoundsAt(p[1], side);
    const m = halfAt(i) + 2.5;
    const lo2 = lo + m, hi2 = hi - m;
    let x = p[0];
    if (lo2 < hi2) x = Math.min(Math.max(x, lo2), hi2);
    else x = (lo + hi) / 2;
    return [x, p[1]];
  });
}

// Per-segment caliber (full vessel width, viewBox units).
const CALIBER = {
  cfv: 19, sfj: 11, pfv: 13,
  'fv-prox': 16, 'fv-mid': 14, 'fv-dist': 12,
  'gsv-prox-thigh': 11, 'gsv-mid-thigh': 10, 'gsv-dist-thigh': 9, 'gsv-knee': 8, 'gsv-calf': 8,
  'pop-ak': 14, 'pop-bk': 13, ptv: 7, per: 7,
  ssv: 9, spj: 9, gastroc: 7, soleal: 7,
};
const DEFAULT_CALIBER = 9;

// Anatomical vessel chains (continuous vessels). Sub-segments in the same chain
// are joined seamlessly. Templates are per-side; `-left`/`-right` substituted.
// Continuous trunks. The GSV chain starts at the saphenofemoral junction (sfj)
// so the great saphenous flows out of the common femoral instead of leaving a
// separate junction stub.
const ANTERIOR_CHAINS = [
  ['cfv', 'fv-prox', 'fv-mid', 'fv-dist', 'pop-ak', 'pop-bk', 'ptv'],
  ['sfj', 'gsv-prox-thigh', 'gsv-mid-thigh', 'gsv-dist-thigh', 'gsv-knee', 'gsv-calf'],
];
// Branches that originate ON a trunk: flat root buried under the trunk.
const ANTERIOR_TRUNK_BRANCHES = ['pfv', 'per', 'gastroc'];
// Superficial veins not on the deep axis: clean rounded floaters.
const ANTERIOR_FLOATERS = ['spj', 'ssv'];

const POSTERIOR_CHAINS = [
  ['pop-ak', 'pop-bk', 'ptv'],
];
const POSTERIOR_TRUNK_BRANCHES = ['per', 'gastroc', 'soleal'];
const POSTERIOR_FLOATERS = ['ssv', 'spj', 'gsv-calf'];

// Soleal veins (posterior/muscular) — not in the committed SVGs.
const EXTRA_POSTERIOR = {
  'soleal-right': 'M 168,905 L 165,1010 L 163,1118',
  'soleal-left': 'M 432,905 L 435,1010 L 437,1118',
};

// Clean, anatomically-ordered centerlines (defined for the RIGHT leg; the left
// leg is mirrored x -> 600-x). These REPLACE the noisy hand-traced calibration
// so vessels are smooth, connect within their chain, and sit in correct
// medial->lateral order with clear separation (GSV > PTV > PER > SSV by x).
// Chains share endpoints exactly so sub-segments join seamlessly.
const CLEAN_R = {
  // ---- deep axis (CFV angles in from the pelvis, then vertical down center) ----
  cfv: 'M 248,286 L 214,346 L 190,402',
  'fv-prox': 'M 190,402 L 184,462',
  'fv-mid': 'M 184,462 L 176,560 L 172,650',
  'fv-dist': 'M 172,650 L 166,740 L 164,812',
  'pop-ak': 'M 164,812 L 162,852',
  'pop-bk': 'M 162,852 L 160,900',
  ptv: 'M 160,900 L 174,1000 L 172,1140 L 154,1300 L 142,1400',
  // ---- great saphenous: small SFJ hook joining the trunk, then medial course ----
  sfj: 'M 198,398 L 216,402 L 230,410',
  'gsv-prox-thigh': 'M 230,410 L 234,470',
  'gsv-mid-thigh': 'M 234,470 L 237,560 L 237,650',
  'gsv-dist-thigh': 'M 237,650 L 233,740 L 229,812 L 226,864',
  'gsv-knee': 'M 226,864 L 218,924',
  'gsv-calf': 'M 218,924 L 208,1010 L 198,1140 L 180,1300 L 166,1400',
  // ---- branches. Calf veins fan into clearly separated medial->lateral lanes:
  //      GSV(208) > PTV(174) > gastroc(154) > SSV(132) > soleal(108) > PER(78) at y~1000.
  pfv: 'M 190,400 L 162,470 L 144,560 L 134,642',        // profunda — lateral deep thigh
  per: 'M 160,900 L 78,1000 L 70,1140 L 76,1300 L 82,1400',  // peroneal — lateral deep (with fibula)
  ssv: 'M 162,905 L 132,1000 L 128,1140 L 118,1300 L 112,1390', // small saphenous — posterior midline
  gastroc: 'M 158,902 L 154,995 L 154,1100',             // gastrocnemius — central muscular, short
  soleal: 'M 156,902 L 108,990 L 106,1095',              // soleal — lateral muscular, short
  spj: 'M 160,906 L 166,922',                            // saphenopopliteal junction (stub)
};

// Decorative iliac confluence (inverted-V) at the top center, matching the
// reference image. Static (no id) — not clickable, not recolored; rendered in
// the idle-vessel grey so it blends with the tree.
const ILIAC_LIMBS = [
  // single inverted-V confluence: right CFV top -> apex -> left CFV top
  'M 248,286 L 274,268 L 300,256 L 326,268 L 352,286',
];
const ILIAC_WIDTH = 15;

const baseId = (id) => id.replace(/-(left|right)$/, '');
const sideOf = (id) => (id.endsWith('-left') ? 'left' : 'right');
const cal = (id) => CALIBER[baseId(id)] ?? DEFAULT_CALIBER;
const LABELS = {};

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------
function parsePoints(d) {
  const toks = d.match(/[MLQC]|-?\d*\.?\d+/g) || [];
  const pts = [];
  let i = 0;
  let cur = [0, 0];
  const read = () => [parseFloat(toks[i++]), parseFloat(toks[i++])];
  const bez = (p0, ctrls, n = 8) => {
    for (let s = 1; s <= n; s++) {
      const t = s / n, mt = 1 - t;
      if (ctrls.length === 2) {
        const [c1, p1] = ctrls;
        pts.push([
          mt * mt * p0[0] + 2 * mt * t * c1[0] + t * t * p1[0],
          mt * mt * p0[1] + 2 * mt * t * c1[1] + t * t * p1[1],
        ]);
      } else {
        const [c1, c2, p1] = ctrls;
        pts.push([
          mt ** 3 * p0[0] + 3 * mt * mt * t * c1[0] + 3 * mt * t * t * c2[0] + t ** 3 * p1[0],
          mt ** 3 * p0[1] + 3 * mt * mt * t * c1[1] + 3 * mt * t * t * c2[1] + t ** 3 * p1[1],
        ]);
      }
    }
  };
  while (i < toks.length) {
    const cmd = toks[i++];
    if (cmd === 'M' || cmd === 'L') { cur = read(); pts.push(cur); }
    else if (cmd === 'Q') { const c1 = read(), p1 = read(); bez(cur, [c1, p1]); cur = p1; }
    else if (cmd === 'C') { const c1 = read(), c2 = read(), p1 = read(); bez(cur, [c1, c2, p1]); cur = p1; }
    else throw new Error(`bad cmd ${cmd} in ${d}`);
  }
  return pts;
}

function rdp(points, eps) {
  if (points.length < 3) return points.slice();
  const a = points[0], b = points[points.length - 1];
  let idx = -1, max = 0;
  for (let k = 1; k < points.length - 1; k++) {
    const d = perp(points[k], a, b);
    if (d > max) { max = d; idx = k; }
  }
  if (max > eps) return rdp(points.slice(0, idx + 1), eps).slice(0, -1).concat(rdp(points.slice(idx), eps));
  return [a, b];
}
function perp(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1e-9;
  return Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / len;
}

// Catmull-Rom resample, tracking where each input point lands in the output.
function smooth(master, step = 4) {
  if (master.length < 2) return { pts: master.slice(), at: master.map((_, i) => i) };
  if (master.length === 2) {
    const out = [], at = [0];
    const n = Math.max(2, Math.round(dist(master[0], master[1]) / step));
    for (let s = 0; s < n; s++) out.push(lerp(master[0], master[1], s / n));
    at.push(out.length);
    out.push(master[1]);
    return { pts: out, at };
  }
  const pad = [master[0], ...master, master[master.length - 1]];
  const out = [];
  const at = [];
  for (let k = 1; k < pad.length - 2; k++) {
    at.push(out.length);
    const p0 = pad[k - 1], p1 = pad[k], p2 = pad[k + 1], p3 = pad[k + 2];
    const n = Math.max(2, Math.round(dist(p1, p2) / step));
    for (let s = 0; s < n; s++) {
      const t = s / n, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  at.push(out.length);
  out.push(master[master.length - 1]);
  return { pts: out, at };
}
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const arcLen = (pts) => pts.reduce((s, p, i) => (i ? s + dist(pts[i - 1], p) : 0), 0);

// Moving-average low-pass that rounds sharp bends (so offset ribbons don't
// self-intersect into loops). Endpoints fixed. Mutates a copy in place.
function denseSmooth(pts, iters = 3) {
  let p = pts.map((q) => q.slice());
  for (let it = 0; it < iters; it++) {
    const next = p.map((q) => q.slice());
    for (let i = 1; i < p.length - 1; i++) {
      next[i][0] = 0.25 * p[i - 1][0] + 0.5 * p[i][0] + 0.25 * p[i + 1][0];
      next[i][1] = 0.25 * p[i - 1][1] + 0.5 * p[i][1] + 0.25 * p[i + 1][1];
    }
    p = next;
  }
  return p;
}

function normalsFor(pts) {
  const n = pts.length;
  return pts.map((p, k) => {
    const a = pts[Math.max(0, k - 1)], b = pts[Math.min(n - 1, k + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const len = Math.hypot(tx, ty) || 1e-9;
    return [-ty / len, tx / len];
  });
}

const F = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;

// Outward rounded cap: semicircle of radius hw around C, from `fromPt` to its
// antipode `toPt`, bulging along `outward`.
function capPoints(C, fromPt, outward, hw, k = 8) {
  const aFrom = Math.atan2(fromPt[1] - C[1], fromPt[0] - C[0]);
  const aMid = Math.atan2(outward[1], outward[0]);
  let dir = aMid - aFrom;
  while (dir > Math.PI) dir -= 2 * Math.PI;
  while (dir < -Math.PI) dir += 2 * Math.PI;
  const sign = dir >= 0 ? 1 : -1;
  const out = [];
  for (let s = 1; s <= k; s++) {
    const a = aFrom + sign * Math.PI * (s / k);
    out.push([C[0] + hw * Math.cos(a), C[1] + hw * Math.sin(a)]);
  }
  return out; // last point is the antipode (== toPt)
}

// Build a closed ribbon `d` for a slice of an already-smoothed chain.
// pts/normals: the slice; widthAt(i): full width at slice index i.
// roundStart/roundEnd: whether the free end gets a rounded cap.
function ribbon(pts, normals, widthAt, roundStart, roundEnd) {
  const n = pts.length;
  if (n < 2) return null;
  const hw = (i) => widthAt(i) / 2;
  const left = pts.map((p, i) => [p[0] + normals[i][0] * hw(i), p[1] + normals[i][1] * hw(i)]);
  const right = pts.map((p, i) => [p[0] - normals[i][0] * hw(i), p[1] - normals[i][1] * hw(i)]);
  let d = `M ${F(left[0])}`;
  for (let i = 1; i < n; i++) d += ` L ${F(left[i])}`;
  if (roundEnd) {
    const outward = [pts[n - 1][0] - pts[n - 2][0], pts[n - 1][1] - pts[n - 2][1]];
    for (const p of capPoints(pts[n - 1], left[n - 1], outward, hw(n - 1))) d += ` L ${F(p)}`;
  } else {
    d += ` L ${F(right[n - 1])}`;
  }
  for (let i = n - 2; i >= 0; i--) d += ` L ${F(right[i])}`;
  if (roundStart) {
    const outward = [pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]];
    for (const p of capPoints(pts[0], right[0], outward, hw(0))) d += ` L ${F(p)}`;
  }
  return d + ' Z';
}

// ---------------------------------------------------------------------------
// Chain processing
// ---------------------------------------------------------------------------
function centerline(id, map) {
  const base = baseId(id);
  if (CLEAN_R[base]) {
    let pts = parsePoints(CLEAN_R[base]);
    if (sideOf(id) === 'left') pts = pts.map((p) => [600 - p[0], p[1]]);
    return pts;
  }
  return parsePoints(map[id]);
}

// Process one chain (array of ids) -> { id: ribbonD }.
function processChain(ids, map) {
  const segPts = ids.map((id) => {
    const p = rdp(centerline(id, map), 4);
    return p;
  });
  // Concatenate into one master polyline, recording boundary indices.
  const master = [];
  const bounds = [0];
  segPts.forEach((p, si) => {
    let start = 0;
    if (master.length && dist(master[master.length - 1], p[0]) < 4) start = 1; // dedup shared node
    for (let k = start; k < p.length; k++) master.push(p[k]);
    bounds.push(master.length - 1);
  });
  // Smooth whole chain; map boundary master-indices -> output indices.
  const { pts: S0, at } = smooth(master, 4);
  let S = denseSmooth(S0, 3); // round sharp bends -> no self-intersecting offsets
  const outIdx = bounds.map((mi) => Math.min(S.length - 1, at[mi] ?? (mi === 0 ? 0 : S.length - 1)));
  // Node widths (shared at boundaries so neighbors match exactly).
  const nodeW = ids.map((id) => cal(id));
  const widthAtNode = (nodeIndex) => {
    // boundary between seg (nodeIndex-1) and seg (nodeIndex)
    if (nodeIndex <= 0) return nodeW[0];
    if (nodeIndex >= ids.length) return nodeW[ids.length - 1];
    return (nodeW[nodeIndex - 1] + nodeW[nodeIndex]) / 2;
  };
  // Half-width at any S index (interpolated along the chain), for clamping.
  const halfAtS = (i) => {
    for (let k = 0; k < ids.length; k++) {
      if (i <= outIdx[k + 1] || k === ids.length - 1) {
        const a = outIdx[k], b = outIdx[k + 1];
        const t = b > a ? Math.min(Math.max((i - a) / (b - a), 0), 1) : 0;
        return (widthAtNode(k) + (widthAtNode(k + 1) - widthAtNode(k)) * t) / 2;
      }
    }
    return cal(ids[ids.length - 1]) / 2;
  };
  // Bend the centerline to follow the leg taper (stay inside the silhouette).
  S = denseSmooth(clampToLeg(S, halfAtS, sideOf(ids[0])), 1);
  const normals = normalsFor(S);
  const out = {};
  ids.forEach((id, si) => {
    const a = outIdx[si], b = outIdx[si + 1];
    const lo = Math.min(a, b), hi = Math.max(a, b);
    const slice = S.slice(lo, hi + 1);
    const sliceN = normals.slice(lo, hi + 1);
    if (slice.length < 2) { out[id] = null; return; }
    const wStart = widthAtNode(si), wEnd = widthAtNode(si + 1);
    const widthAt = (i) => wStart + (wEnd - wStart) * (i / (slice.length - 1));
    out[id] = ribbon(slice, sliceN, widthAt, si === 0, si === ids.length - 1);
  });
  return out;
}

// Floater: standalone smooth tube, rounded both ends (no stubs).
function processFloater(id, map) {
  const p = rdp(centerline(id, map), 4);
  let { pts: S } = smooth(p, 4);
  if (S.length < 2) return { [id]: null };
  // Tiny junction stubs (e.g. SPJ) -> clean straight capsule, no curve artifacts.
  if (arcLen(S) < 26) S = [S[0], S[S.length - 1]];
  else S = denseSmooth(S, 3);
  const w = cal(id);
  S = denseSmooth(clampToLeg(S, () => w / 2, sideOf(id)), 1);
  const normals = normalsFor(S);
  return { [id]: ribbon(S, normals, () => w, true, true) };
}

// Trunk branch: originates on a trunk. Flat root extended backward so it buries
// under the trunk (painted on top); rounded distal end.
function processTrunkBranch(id, map) {
  let p = rdp(centerline(id, map), 4);
  if (p.length >= 2) {
    const dx = p[0][0] - p[1][0], dy = p[0][1] - p[1][1];
    const len = Math.hypot(dx, dy) || 1e-9;
    p = [[p[0][0] + (dx / len) * 12, p[0][1] + (dy / len) * 12], ...p];
  }
  const { pts: S0 } = smooth(p, 4);
  if (S0.length < 2) return { [id]: null };
  const w = cal(id);
  const S = denseSmooth(clampToLeg(denseSmooth(S0, 3), () => w / 2, sideOf(id)), 1);
  const normals = normalsFor(S);
  return { [id]: ribbon(S, normals, () => w, false, true) };
}

// Build all vessel paths for a view.
function buildSegments(map, chains, trunkBranches, floaters, sides = ['right', 'left']) {
  const out = {};
  // Paint order (later = on top): floaters & trunk-branch roots first (bottom),
  // then chains in reverse so the deep trunk paints LAST and covers every root.
  for (const side of sides) {
    for (const b of floaters) {
      const id = `${b}-${side}`;
      if (map[id]) Object.assign(out, processFloater(id, map));
    }
    for (const b of trunkBranches) {
      const id = `${b}-${side}`;
      if (map[id]) Object.assign(out, processTrunkBranch(id, map));
    }
  }
  for (const side of sides) {
    for (const tpl of [...chains].reverse()) {
      const ids = tpl.map((b) => `${b}-${side}`).filter((id) => map[id]);
      if (ids.length) Object.assign(out, processChain(ids, map));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// SVG assembly
// ---------------------------------------------------------------------------
// Build a static (no-id) filled ribbon for a centerline, in the idle-vessel grey.
function staticRibbon(d, width) {
  const { pts: S } = smooth(rdp(parsePoints(d), 4), 4);
  if (S.length < 2) return '';
  const ribD = ribbon(denseSmooth(S, 3), normalsFor(denseSmooth(S, 3)), () => width, true, true);
  return `    <path d="${ribD}" fill="#94a3b8" stroke="#475569" stroke-width="2" />`;
}

function buildSvg(name, titleText, descText, silhouetteD, segs) {
  // Iliac confluence: decorative, painted FIRST so the CFVs overlap it cleanly.
  const iliac = ILIAC_LIMBS.map((d) => staticRibbon(d, ILIAC_WIDTH)).join('\n');
  const paths = Object.entries(segs)
    .filter(([, d]) => d)
    .map(([id, d]) => {
      const label = LABELS[id] ?? id;
      return `    <path id="${id}" d="${d}" data-label="${label}"><title>${label}</title></path>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 1453" role="img" aria-labelledby="title-${name}">
  <title id="title-${name}">${titleText}</title>
  <desc>${descText}</desc>
  <defs>
    <clipPath id="leg-clip"><path d="${silhouetteD}" /></clipPath>
  </defs>
  <g id="silhouette" fill="#f7fafc" stroke="transparent" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">
    <path d="${silhouetteD}" />
  </g>
  <g id="pelvis-hint" fill="none" stroke="transparent" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></g>
  <g id="side-labels" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="34" font-weight="600" fill="#4a5568" text-anchor="middle">
    <text x="150" y="180">R</text>
    <text x="450" y="180">L</text>
  </g>
  <g id="segments" clip-path="url(#leg-clip)" fill="transparent" stroke="transparent" stroke-linejoin="round" stroke-linecap="round" pointer-events="all">
${iliac}
${paths}
  </g>
  <g id="junction-dots" fill="#1a365d" stroke="none">
    <circle cx="190" cy="392" r="5" />
    <circle cx="410" cy="392" r="5" />
  </g>
</svg>
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function gitHead(p) { return execSync(`git show HEAD:${p}`, { cwd: ROOT, encoding: 'utf8' }); }
function extractSegments(svg) {
  const out = {};
  const re = /<path\s+id="([a-z0-9-]+)"[^>]*\sd="([^"]+)"[^>]*?(?:\/>|>[\s\S]*?<\/path>)/g;
  let m;
  while ((m = re.exec(svg))) out[m[1]] = m[2];
  return out;
}
function loadLabels(svg) {
  const re = /<path\s+id="([a-z0-9-]+)"[^>]*\sdata-label="([^"]+)"/g;
  let m;
  while ((m = re.exec(svg))) LABELS[m[1]] = m[2];
}
function traceSilhouette() {
  return new Promise((resolve, reject) => {
    const t = new Potrace({ turdSize: 100, optCurve: true, optTolerance: 0.4, alphaMax: 1.0, threshold: 128, turnPolicy: 'minority' });
    t.loadImage(join(ANATOMY, 'lower-body-silhouette-filled.png'), (err) => {
      if (err) return reject(err);
      const ds = [...t.getSVG().matchAll(/ d="([^"]+)"/g)].map((m) => m[1]);
      ds.length ? resolve(ds.join(' ')) : reject(new Error('no silhouette path'));
    });
  });
}

const antSrc = gitHead('public/anatomy/le-anterior.svg');
const postSrc = gitHead('public/anatomy/le-posterior.svg');
loadLabels(antSrc);
loadLabels(postSrc);
LABELS['soleal-right'] = 'Soleal vein (right)';
LABELS['soleal-left'] = 'Soleal vein (left)';

const silhouetteD = await traceSilhouette();

const antMap = extractSegments(antSrc);
const postMap = { ...extractSegments(postSrc), ...EXTRA_POSTERIOR };

const antSegs = buildSegments(antMap, ANTERIOR_CHAINS, ANTERIOR_TRUNK_BRANCHES, ANTERIOR_FLOATERS);
const postSegs = buildSegments(postMap, POSTERIOR_CHAINS, POSTERIOR_TRUNK_BRANCHES, POSTERIOR_FLOATERS);

writeFileSync(join(ANATOMY, 'le-anterior.svg'), buildSvg(
  'le-anterior',
  'Lower-extremity venous system — anterior view',
  'Pure-vector filled-vessel diagram of the anterior lower-extremity venous tree on a traced leg silhouette. Vessels are smoothed per anatomical chain from hand-calibrated centerlines; each carries a canonical IAC/SVU id and fills by competency.',
  silhouetteD, antSegs,
));
writeFileSync(join(ANATOMY, 'le-posterior.svg'), buildSvg(
  'le-posterior',
  'Lower-extremity venous system — posterior view',
  'Pure-vector filled-vessel diagram of the posterior-visible lower-extremity venous tree (popliteal, SSV, gastrocnemius, soleal, tibial/peroneal, GSV calf) on the shared leg silhouette.',
  silhouetteD, postSegs,
));
const cnt = (o) => Object.values(o).filter(Boolean).length;
console.log(`wrote le-anterior.svg (${cnt(antSegs)} vessels), le-posterior.svg (${cnt(postSegs)} vessels)`);
