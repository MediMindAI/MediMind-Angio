// inflate-arteries.mjs — build smooth, connected, carotid-style FILLED
// lower-extremity ARTERIAL vessels on the SAME traced leg silhouette + bounds
// as the venous diagram (scripts/inflate-veins.mjs). The geometry engine here is
// copied verbatim from inflate-veins.mjs (kept deliberately separate so the
// just-regenerated venous SVGs are never disturbed); only the DATA differs —
// arterial centerlines, calibers and anatomical chains.
//
// Arteries run with their paired veins (the femoral artery sits in the same
// sheath as the femoral vein), so the arterial main trunk is seeded from the
// venous deep-axis corridor — those centerlines are already calibrated to stay
// inside this silhouette. We simply re-segment that corridor into the arterial
// tree: common/external iliac above the groin, the SFA split prox/mid/distal
// through the thigh, popliteal AK/BK, the tibioperoneal trunk, and the tibial /
// peroneal / dorsalis-pedis run-off below the knee.
//
// Run:  node scripts/inflate-arteries.mjs   (or: npm run anatomy:arteries)

import { Potrace } from 'potrace';
import { writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ANATOMY = join(ROOT, 'public', 'anatomy');

// Per-y leg-outline bounds (shared with the venous build; sampled from the
// silhouette via scripts/leg-bounds.json). Keeps vessels INSIDE the leg.
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

// ---------------------------------------------------------------------------
// Arterial DATA (the only difference from inflate-veins.mjs)
// ---------------------------------------------------------------------------
// Per-segment caliber (full vessel width, viewBox units). Arteries taper
// proximal -> distal; iliac/femoral are the widest.
const CALIBER = {
  cia: 18, eia: 15, cfa: 16, pfa: 11,
  'sfa-prox': 13, 'sfa-mid': 12, 'sfa-dist': 11,
  'pop-ak': 12, 'pop-bk': 11, tpt: 9,
  ata: 7, pta: 7, per: 7, dp: 5,
};
const DEFAULT_CALIBER = 9;

// Clean, anatomically-ordered centerlines (RIGHT leg; left mirrored x -> 600-x).
// The deep axis follows the venous deep corridor (pre-calibrated to the leg).
// Chain segments share endpoints EXACTLY so they join seamlessly with no gaps.
const CLEAN_R = {
  // ---- main axis: aortic bifurcation -> iliac -> femoral -> popliteal -> PTA ----
  cia: 'M 296,206 L 274,246 L 250,286',          // common iliac (from bifurcation toward groin)
  eia: 'M 250,286 L 226,344 L 206,402',          // external iliac (down the groin)
  cfa: 'M 206,402 L 200,452',                    // common femoral (short, groin crease)
  'sfa-prox': 'M 200,452 L 192,540',             // superficial femoral — proximal
  'sfa-mid': 'M 192,540 L 182,650',              // superficial femoral — mid
  'sfa-dist': 'M 182,650 L 170,760 L 164,812',   // superficial femoral — distal (adductor canal)
  'pop-ak': 'M 164,812 L 162,852',               // popliteal above knee
  'pop-bk': 'M 162,852 L 160,900',               // popliteal below knee
  tpt: 'M 160,900 L 158,948',                    // tibioperoneal trunk (short, below knee)
  pta: 'M 158,948 L 172,1060 L 170,1200 L 156,1320 L 146,1410', // posterior tibial — medial run-off
  // ---- branches ----
  pfa: 'M 204,420 L 178,500 L 158,600 L 150,690',               // profunda femoris — lateral deep thigh
  ata: 'M 158,950 L 124,1052 L 120,1200 L 126,1330 L 132,1408', // anterior tibial — lateral run-off
  per: 'M 158,952 L 98,1044 L 92,1184 L 98,1312 L 102,1400',    // peroneal — far-lateral (along fibula)
  // ---- dorsalis pedis: distal continuation of the ATA onto the foot dorsum ----
  dp: 'M 132,1408 L 140,1430 L 152,1437',
};

// Anatomical vessel chains (continuous trunks). Sub-segments in the same chain
// are joined seamlessly. Templates are per-side; `-left`/`-right` substituted.
const ARTERIAL_CHAINS = [
  ['cia', 'eia', 'cfa', 'sfa-prox', 'sfa-mid', 'sfa-dist', 'pop-ak', 'pop-bk', 'tpt', 'pta'],
];
// Branches that originate ON a trunk: flat root buried under the trunk.
const ARTERIAL_TRUNK_BRANCHES = ['pfa', 'ata', 'per'];
// Vessels not on the deep axis: clean rounded floaters.
const ARTERIAL_FLOATERS = ['dp'];

// Decorative distal-aorta stub above the bifurcation. Static (no id) — not
// clickable, not recolored; rendered in the idle-vessel grey so it blends in.
const AORTA_LIMBS = ['M 300,150 L 300,206'];
const AORTA_WIDTH = 19;

// Canonical clinical labels (-> data-label + <title> tooltip, mirrors venous).
const LABELS = {
  'cia-right': 'Common iliac artery (right)', 'cia-left': 'Common iliac artery (left)',
  'eia-right': 'External iliac artery (right)', 'eia-left': 'External iliac artery (left)',
  'cfa-right': 'Common femoral artery (right)', 'cfa-left': 'Common femoral artery (left)',
  'pfa-right': 'Profunda femoris artery (right)', 'pfa-left': 'Profunda femoris artery (left)',
  'sfa-prox-right': 'Superficial femoral artery — proximal (right)', 'sfa-prox-left': 'Superficial femoral artery — proximal (left)',
  'sfa-mid-right': 'Superficial femoral artery — mid (right)', 'sfa-mid-left': 'Superficial femoral artery — mid (left)',
  'sfa-dist-right': 'Superficial femoral artery — distal (right)', 'sfa-dist-left': 'Superficial femoral artery — distal (left)',
  'pop-ak-right': 'Popliteal artery — above knee (right)', 'pop-ak-left': 'Popliteal artery — above knee (left)',
  'pop-bk-right': 'Popliteal artery — below knee (right)', 'pop-bk-left': 'Popliteal artery — below knee (left)',
  'tpt-right': 'Tibioperoneal trunk (right)', 'tpt-left': 'Tibioperoneal trunk (left)',
  'ata-right': 'Anterior tibial artery (right)', 'ata-left': 'Anterior tibial artery (left)',
  'pta-right': 'Posterior tibial artery (right)', 'pta-left': 'Posterior tibial artery (left)',
  'per-right': 'Peroneal artery (right)', 'per-left': 'Peroneal artery (left)',
  'dp-right': 'Dorsalis pedis artery (right)', 'dp-left': 'Dorsalis pedis artery (left)',
};

const baseId = (id) => id.replace(/-(left|right)$/, '');
const sideOf = (id) => (id.endsWith('-left') ? 'left' : 'right');
const cal = (id) => CALIBER[baseId(id)] ?? DEFAULT_CALIBER;

// ---------------------------------------------------------------------------
// Geometry helpers (copied verbatim from inflate-veins.mjs)
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
// Chain processing (copied verbatim from inflate-veins.mjs)
// ---------------------------------------------------------------------------
function centerline(id) {
  const base = baseId(id);
  let pts = parsePoints(CLEAN_R[base]);
  if (sideOf(id) === 'left') pts = pts.map((p) => [600 - p[0], p[1]]);
  return pts;
}

function processChain(ids) {
  const segPts = ids.map((id) => rdp(centerline(id), 4));
  const master = [];
  const bounds = [0];
  segPts.forEach((p) => {
    let start = 0;
    if (master.length && dist(master[master.length - 1], p[0]) < 4) start = 1; // dedup shared node
    for (let k = start; k < p.length; k++) master.push(p[k]);
    bounds.push(master.length - 1);
  });
  const { pts: S0, at } = smooth(master, 4);
  let S = denseSmooth(S0, 3);
  const outIdx = bounds.map((mi) => Math.min(S.length - 1, at[mi] ?? (mi === 0 ? 0 : S.length - 1)));
  const nodeW = ids.map((id) => cal(id));
  const widthAtNode = (nodeIndex) => {
    if (nodeIndex <= 0) return nodeW[0];
    if (nodeIndex >= ids.length) return nodeW[ids.length - 1];
    return (nodeW[nodeIndex - 1] + nodeW[nodeIndex]) / 2;
  };
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

function processFloater(id) {
  const p = rdp(centerline(id), 4);
  let { pts: S } = smooth(p, 4);
  if (S.length < 2) return { [id]: null };
  if (arcLen(S) < 26) S = [S[0], S[S.length - 1]];
  else S = denseSmooth(S, 3);
  const w = cal(id);
  S = denseSmooth(clampToLeg(S, () => w / 2, sideOf(id)), 1);
  const normals = normalsFor(S);
  return { [id]: ribbon(S, normals, () => w, true, true) };
}

function processTrunkBranch(id) {
  let p = rdp(centerline(id), 4);
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

function buildSegments(chains, trunkBranches, floaters, sides = ['right', 'left']) {
  const out = {};
  // Paint order (later = on top): floaters & branch roots first (bottom), then
  // chains in reverse so the deep trunk paints LAST and covers every root.
  for (const side of sides) {
    for (const b of floaters) Object.assign(out, processFloater(`${b}-${side}`));
    for (const b of trunkBranches) Object.assign(out, processTrunkBranch(`${b}-${side}`));
  }
  for (const side of sides) {
    for (const tpl of [...chains].reverse()) {
      const ids = tpl.map((b) => `${b}-${side}`);
      Object.assign(out, processChain(ids));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// SVG assembly
// ---------------------------------------------------------------------------
function staticRibbon(d, width) {
  const { pts: S } = smooth(rdp(parsePoints(d), 4), 4);
  if (S.length < 2) return '';
  const ribD = ribbon(denseSmooth(S, 3), normalsFor(denseSmooth(S, 3)), () => width, true, true);
  return `    <path d="${ribD}" fill="#94a3b8" stroke="#475569" stroke-width="2" />`;
}

function buildSvg(name, titleText, descText, silhouetteD, segs) {
  // Distal-aorta stub: decorative, painted FIRST so the iliacs overlap it cleanly.
  const aorta = AORTA_LIMBS.map((d) => staticRibbon(d, AORTA_WIDTH)).join('\n');
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
${aorta}
${paths}
  </g>
  <g id="junction-dots" fill="#1a365d" stroke="none">
    <circle cx="206" cy="402" r="5" />
    <circle cx="394" cy="402" r="5" />
    <circle cx="160" cy="900" r="5" />
    <circle cx="440" cy="900" r="5" />
  </g>
</svg>
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
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

const silhouetteD = await traceSilhouette();
const segs = buildSegments(ARTERIAL_CHAINS, ARTERIAL_TRUNK_BRANCHES, ARTERIAL_FLOATERS);

writeFileSync(join(ANATOMY, 'le-arterial-anterior.svg'), buildSvg(
  'le-arterial-anterior',
  'Lower-extremity arterial system — anterior view',
  'Pure-vector filled-vessel diagram of the anterior lower-extremity arterial tree on the shared traced leg silhouette. Vessels are smoothed per anatomical chain (iliac → femoral → popliteal → tibioperoneal run-off); each carries a canonical IAC/ESVS id and fills by stenosis severity.',
  silhouetteD, segs,
));
const cnt = (o) => Object.values(o).filter(Boolean).length;
console.log(`wrote le-arterial-anterior.svg (${cnt(segs)} vessels)`);
