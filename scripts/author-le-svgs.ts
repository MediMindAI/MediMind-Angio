/**
 * Programmatic authoring of lower-extremity venous SVGs.
 *
 * We build anatomically-approximate line-art for both legs on a single
 * 600x900 viewBox. Each vein segment is a `<path>` with a canonical `id`
 * from `segment-catalog.ts`. These SVGs are rendered by both the React
 * web viewer and `@react-pdf/renderer`'s `<Svg>` primitive, so we stick to
 * a conservative subset of SVG (no filters, no gradients, no CSS, no foreignObject).
 *
 * Coordinate system:
 * - viewBox 0 0 600 900  (600 wide, 900 tall)
 * - right leg centered at x=200, left leg centered at x=400
 *   (patient-anatomic "left" sits on the viewer's right — we follow that convention
 *    so the rendered image matches how a clinician sees the patient)
 * - y=60  pelvis/iliacs
 * - y=120 saphenofemoral junction
 * - y=430 knee / popliteal fossa
 * - y=840 ankle
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { expectedIdsForView, segmentLabel, type Side } from './segment-catalog.js';

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/**
 * Patient-anatomic left leg is drawn on the VIEWER'S right (clinician convention).
 * Patient-anatomic right leg is drawn on the VIEWER'S left.
 */
interface LegAxis {
  /** centerline x at the top (pelvis) */
  topX: number;
  /** centerline x at the ankle */
  ankleX: number;
  /** sign: +1 for patient-left (medial = toward midline 300), -1 for patient-right */
  medialSign: number;
}

const LEGS: Record<Side, LegAxis> = {
  // Patient-right = viewer's left half
  right: { topX: 200, ankleX: 215, medialSign: +1 },
  // Patient-left = viewer's right half
  left: { topX: 400, ankleX: 385, medialSign: -1 },
};

const Y = {
  pelvisTop: 60,
  iliacMid: 95,
  sfj: 130,
  cfvBottom: 165,
  fvProxStart: 165,
  fvProxEnd: 240,
  fvMidEnd: 330,
  fvDistEnd: 405,
  popAkTop: 405,
  popFossa: 440,
  popBkBottom: 490,
  calfTop: 490,
  calfMid: 625,
  ankle: 840,
} as const;

/** Simple cubic bezier between two points with a medial bow (+sign pulls toward midline). */
function bowPath(x1: number, y1: number, x2: number, y2: number, bow: number): string {
  const mx = (x1 + x2) / 2 + bow;
  return `M ${x1},${y1} Q ${mx},${(y1 + y2) / 2} ${x2},${y2}`;
}

function straight(x1: number, y1: number, x2: number, y2: number): string {
  return `M ${x1},${y1} L ${x2},${y2}`;
}

// ---------------------------------------------------------------------------
// Segment builders — each returns `d` attribute, an approximate bbox, and label
// ---------------------------------------------------------------------------

interface SegmentDef {
  id: string;
  d: string;
  bbox: [number, number, number, number]; // x, y, w, h
  label: string;
}

/** Given a list of points, compute a loose bbox. */
function bboxOf(points: Array<[number, number]>, pad = 6): [number, number, number, number] {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  const w = Math.max(...xs) - Math.min(...xs) + pad * 2;
  const h = Math.max(...ys) - Math.min(...ys) + pad * 2;
  return [Math.round(x), Math.round(y), Math.round(w), Math.round(h)];
}

// ---------------------------------------------------------------------------
// ANTERIOR VIEW — builds all segments expected by le-anterior
// ---------------------------------------------------------------------------

function buildAnteriorSegments(side: Side): SegmentDef[] {
  const leg = LEGS[side];
  const m = leg.medialSign; // +1 for patient-left, -1 for patient-right
  const cx = leg.topX;

  // Trunk x positions (deep system follows the centerline; GSV runs medial)
  const deepX = cx; // femoral + popliteal trunk
  const gsvX = cx + m * 30; // GSV sits ~30px medial to femoral
  const pfvX = cx - m * 25; // profunda branches laterally from CFV

  const segs: SegmentDef[] = [];

  // External iliac vein — short segment above CFV
  {
    const x1 = cx + m * 20;
    const y1 = Y.pelvisTop;
    const x2 = deepX;
    const y2 = Y.iliacMid;
    segs.push({
      id: `eiv-${side}`,
      d: bowPath(x1, y1, x2, y2, -m * 10),
      bbox: bboxOf([
        [x1, y1],
        [x2, y2],
      ]),
      label: segmentLabel('eiv', side),
    });
  }

  // Common femoral vein — from iliac to profunda branch
  {
    const x1 = deepX;
    const y1 = Y.iliacMid;
    const x2 = deepX;
    const y2 = Y.cfvBottom;
    segs.push({
      id: `cfv-${side}`,
      d: straight(x1, y1, x2, y2),
      bbox: bboxOf([
        [x1, y1],
        [x2, y2],
      ]),
      label: segmentLabel('cfv', side),
    });
  }

  // Saphenofemoral junction — small arc connecting GSV to CFV at y=sfj
  {
    const x1 = gsvX;
    const y1 = Y.sfj;
    const x2 = deepX;
    const y2 = Y.sfj - 5;
    segs.push({
      id: `sfj-${side}`,
      d: `M ${x1},${y1} Q ${(x1 + x2) / 2},${y1 - 8} ${x2},${y2}`,
      bbox: bboxOf([
        [x1, y1 - 10],
        [x2, y2],
      ]),
      label: segmentLabel('sfj', side),
    });
  }

  // Profunda femoris — branches laterally and down
  {
    const x1 = deepX;
    const y1 = Y.cfvBottom;
    const x2 = pfvX;
    const y2 = Y.fvProxEnd;
    segs.push({
      id: `pfv-${side}`,
      d: bowPath(x1, y1, x2, y2, -m * 8),
      bbox: bboxOf([
        [x1, y1],
        [x2, y2],
      ]),
      label: segmentLabel('pfv', side),
    });
  }

  // Femoral vein — proximal / mid / distal segments
  {
    const x1 = deepX;
    segs.push({
      id: `fv-prox-${side}`,
      d: straight(x1, Y.fvProxStart, x1, Y.fvProxEnd),
      bbox: bboxOf([
        [x1, Y.fvProxStart],
        [x1, Y.fvProxEnd],
      ]),
      label: segmentLabel('fv-prox', side),
    });
    segs.push({
      id: `fv-mid-${side}`,
      d: straight(x1, Y.fvProxEnd, x1, Y.fvMidEnd),
      bbox: bboxOf([
        [x1, Y.fvProxEnd],
        [x1, Y.fvMidEnd],
      ]),
      label: segmentLabel('fv-mid', side),
    });
    segs.push({
      id: `fv-dist-${side}`,
      d: straight(x1, Y.fvMidEnd, x1, Y.fvDistEnd),
      bbox: bboxOf([
        [x1, Y.fvMidEnd],
        [x1, Y.fvDistEnd],
      ]),
      label: segmentLabel('fv-dist', side),
    });
  }

  // Popliteal above-knee + below-knee (anterior view — render contiguous,
  // no visible gap; the fossa is a posterior-only concern).
  {
    const x1 = deepX;
    segs.push({
      id: `pop-ak-${side}`,
      d: straight(x1, Y.popAkTop, x1, Y.popFossa),
      bbox: bboxOf([
        [x1, Y.popAkTop],
        [x1, Y.popFossa],
      ]),
      label: segmentLabel('pop-ak', side),
    });
    segs.push({
      id: `pop-bk-${side}`,
      d: straight(x1, Y.popFossa, x1, Y.popBkBottom),
      bbox: bboxOf([
        [x1, Y.popFossa],
        [x1, Y.popBkBottom],
      ]),
      label: segmentLabel('pop-bk', side),
    });
  }

  // PTV + Peroneal — calf deep veins, diverge below popliteal
  {
    const x1 = deepX;
    const y1 = Y.calfTop;
    const ptvEndX = deepX + m * 14;
    const perEndX = deepX - m * 14;
    segs.push({
      id: `ptv-${side}`,
      d: bowPath(x1, y1, ptvEndX, Y.ankle - 20, m * 6),
      bbox: bboxOf([
        [x1, y1],
        [ptvEndX, Y.ankle - 20],
      ]),
      label: segmentLabel('ptv', side),
    });
    segs.push({
      id: `per-${side}`,
      d: bowPath(x1, y1, perEndX, Y.ankle - 40, -m * 6),
      bbox: bboxOf([
        [x1, y1],
        [perEndX, Y.ankle - 40],
      ]),
      label: segmentLabel('per', side),
    });
  }

  // GSV segments — medial course from SFJ, arcing clearly medial on the thigh
  // then running down the medial calf to just anterior of the medial malleolus.
  // All offsets are big enough to keep the GSV visibly separate from the deep trunk.
  {
    const sfjX = gsvX;
    // Medial-side x positions — m is +1 for patient-left (push right toward midline x=300)
    // and -1 for patient-right (push left toward midline). All values below move
    // well medial of the deep trunk so the GSV is visually distinct.
    const thighMedX = cx + m * 60; // widest medial bulge mid-thigh (inside silhouette at this level ~ ±64)
    const kneeMedX = cx + m * 44;
    const calfMedProxX = cx + m * 46;
    const calfMedMidX = cx + m * 36;
    const calfMedDistX = cx + m * 22;

    // GSV above-knee: bows medially mid-thigh then comes back toward knee
    segs.push({
      id: `gsv-ak-${side}`,
      d: `M ${sfjX},${Y.sfj} C ${thighMedX},${Y.fvProxEnd} ${thighMedX},${Y.fvMidEnd} ${kneeMedX},${Y.popFossa - 10}`,
      bbox: bboxOf([
        [sfjX, Y.sfj],
        [thighMedX, Y.popFossa - 10],
      ]),
      label: segmentLabel('gsv-ak', side),
    });
    segs.push({
      id: `gsv-prox-calf-${side}`,
      d: `M ${kneeMedX},${Y.popFossa - 10} C ${calfMedProxX + m * 4},${Y.calfTop + 30} ${calfMedProxX},${Y.calfMid - 90} ${calfMedProxX},${Y.calfMid - 60}`,
      bbox: bboxOf([
        [kneeMedX, Y.popFossa - 10],
        [calfMedProxX, Y.calfMid - 60],
      ]),
      label: segmentLabel('gsv-prox-calf', side),
    });
    segs.push({
      id: `gsv-mid-calf-${side}`,
      d: `M ${calfMedProxX},${Y.calfMid - 60} C ${calfMedProxX},${Y.calfMid} ${calfMedMidX},${Y.calfMid + 20} ${calfMedMidX},${Y.calfMid + 60}`,
      bbox: bboxOf([
        [calfMedProxX, Y.calfMid - 60],
        [calfMedMidX, Y.calfMid + 60],
      ]),
      label: segmentLabel('gsv-mid-calf', side),
    });
    segs.push({
      id: `gsv-dist-calf-${side}`,
      d: `M ${calfMedMidX},${Y.calfMid + 60} C ${calfMedMidX - m * 2},${Y.calfMid + 120} ${calfMedDistX},${Y.ankle - 50} ${calfMedDistX},${Y.ankle - 10}`,
      bbox: bboxOf([
        [calfMedMidX, Y.calfMid + 60],
        [calfMedDistX, Y.ankle - 10],
      ]),
      label: segmentLabel('gsv-dist-calf', side),
    });
  }

  return segs;
}

// ---------------------------------------------------------------------------
// POSTERIOR VIEW — shows popliteal fossa + calf posterior veins
// ---------------------------------------------------------------------------

function buildPosteriorSegments(side: Side): SegmentDef[] {
  const leg = LEGS[side];
  const m = leg.medialSign;
  const cx = leg.topX;
  const deepX = cx;
  const segs: SegmentDef[] = [];

  // Popliteal — above knee, fossa, below knee — centered
  segs.push({
    id: `pop-ak-${side}`,
    d: straight(deepX, Y.popAkTop, deepX, Y.popFossa - 5),
    bbox: bboxOf([
      [deepX, Y.popAkTop],
      [deepX, Y.popFossa - 5],
    ]),
    label: segmentLabel('pop-ak', side),
  });
  // Fossa = small diamond shape to highlight the junction zone
  {
    const fy = Y.popFossa;
    segs.push({
      id: `pop-fossa-${side}`,
      d: `M ${deepX},${fy - 8} L ${deepX + 10},${fy} L ${deepX},${fy + 8} L ${deepX - 10},${fy} Z`,
      bbox: bboxOf([
        [deepX - 10, fy - 8],
        [deepX + 10, fy + 8],
      ]),
      label: segmentLabel('pop-fossa', side),
    });
  }
  segs.push({
    id: `pop-bk-${side}`,
    d: straight(deepX, Y.popFossa + 5, deepX, Y.popBkBottom),
    bbox: bboxOf([
      [deepX, Y.popFossa + 5],
      [deepX, Y.popBkBottom],
    ]),
    label: segmentLabel('pop-bk', side),
  });

  // Saphenopopliteal junction — small arc joining SSV to popliteal at the fossa
  {
    const x1 = deepX - m * 18;
    const y1 = Y.popFossa + 10;
    const x2 = deepX;
    const y2 = Y.popFossa + 2;
    segs.push({
      id: `spj-${side}`,
      d: `M ${x1},${y1} Q ${(x1 + x2) / 2},${y1 - 8} ${x2},${y2}`,
      bbox: bboxOf([
        [x1, y1],
        [x2, y2 - 8],
      ]),
      label: segmentLabel('spj', side),
    });
  }

  // SSV — runs down the posterior midline of the calf (slightly lateral)
  {
    const x1 = deepX - m * 18;
    const y1 = Y.popFossa + 10;
    const x2 = deepX - m * 5;
    const y2 = Y.ankle - 30;
    segs.push({
      id: `ssv-${side}`,
      d: bowPath(x1, y1, x2, y2, m * 3),
      bbox: bboxOf([
        [x1, y1],
        [x2, y2],
      ]),
      label: segmentLabel('ssv', side),
    });
  }

  // Gastrocnemius veins — paired short loops off the popliteal
  {
    const x1 = deepX - m * 12;
    const y1 = Y.popFossa + 20;
    const x2 = deepX - m * 18;
    const y2 = Y.calfTop + 60;
    segs.push({
      id: `gastroc-${side}`,
      d: bowPath(x1, y1, x2, y2, -m * 6),
      bbox: bboxOf([
        [x1, y1],
        [x2, y2],
      ]),
      label: segmentLabel('gastroc', side),
    });
  }

  // Soleal veins — deeper, slightly more medial, mid-calf
  {
    const x1 = deepX + m * 6;
    const y1 = Y.popFossa + 28;
    const x2 = deepX + m * 12;
    const y2 = Y.calfMid + 30;
    segs.push({
      id: `soleal-${side}`,
      d: bowPath(x1, y1, x2, y2, m * 4),
      bbox: bboxOf([
        [x1, y1],
        [x2, y2],
      ]),
      label: segmentLabel('soleal', side),
    });
  }

  // PTV — medial calf
  {
    const x1 = deepX + m * 4;
    const y1 = Y.calfTop;
    const x2 = deepX + m * 18;
    const y2 = Y.ankle - 20;
    segs.push({
      id: `ptv-${side}`,
      d: bowPath(x1, y1, x2, y2, m * 8),
      bbox: bboxOf([
        [x1, y1],
        [x2, y2],
      ]),
      label: segmentLabel('ptv', side),
    });
  }

  // Peroneal — lateral calf
  {
    const x1 = deepX - m * 4;
    const y1 = Y.calfTop;
    const x2 = deepX - m * 18;
    const y2 = Y.ankle - 40;
    segs.push({
      id: `per-${side}`,
      d: bowPath(x1, y1, x2, y2, -m * 8),
      bbox: bboxOf([
        [x1, y1],
        [x2, y2],
      ]),
      label: segmentLabel('per', side),
    });
  }

  // GSV mid + distal calf (medial — visible on posterior too)
  {
    const medOffset = m * 30;
    segs.push({
      id: `gsv-mid-calf-${side}`,
      d: bowPath(deepX + medOffset, Y.calfTop + 30, deepX + medOffset - m * 4, Y.calfMid + 40, m * 3),
      bbox: bboxOf([
        [deepX + medOffset, Y.calfTop + 30],
        [deepX + medOffset - m * 4, Y.calfMid + 40],
      ]),
      label: segmentLabel('gsv-mid-calf', side),
    });
    segs.push({
      id: `gsv-dist-calf-${side}`,
      d: bowPath(
        deepX + medOffset - m * 4,
        Y.calfMid + 40,
        deepX + medOffset - m * 14,
        Y.ankle - 10,
        m * 2,
      ),
      bbox: bboxOf([
        [deepX + medOffset - m * 4, Y.calfMid + 40],
        [deepX + medOffset - m * 14, Y.ankle - 10],
      ]),
      label: segmentLabel('gsv-dist-calf', side),
    });
  }

  return segs;
}

// ---------------------------------------------------------------------------
// Leg silhouette (background decoration, not tagged)
// ---------------------------------------------------------------------------

function legSilhouettePath(side: Side): string {
  const leg = LEGS[side];
  const cx = leg.topX;
  const ax = leg.ankleX;
  // Widths (half-widths from centerline)
  const wThigh = 60; // thigh
  const wKnee = 34; // knee
  const wCalf = 44; // widest calf belly
  const wAnkle = 18; // ankle
  const yTop = Y.pelvisTop - 5;
  const yKnee = Y.popFossa;
  const yCalfBelly = Y.calfMid;
  const yAnkle = Y.ankle + 10;
  // Smooth path: hip -> thigh -> knee -> calf belly -> ankle -> back up
  return [
    `M ${cx - wThigh},${yTop}`,
    // down outer thigh to knee
    `C ${cx - wThigh - 4},${yTop + 120} ${cx - wKnee - 6},${yKnee - 60} ${cx - wKnee},${yKnee}`,
    // knee to outer calf belly
    `C ${cx - wCalf + 4},${yKnee + 40} ${cx - wCalf},${yCalfBelly - 30} ${cx - wCalf},${yCalfBelly}`,
    // calf belly tapering to ankle
    `C ${cx - wCalf + 6},${yCalfBelly + 80} ${ax - wAnkle - 4},${yAnkle - 40} ${ax - wAnkle},${yAnkle}`,
    // across foot
    `L ${ax + wAnkle},${yAnkle}`,
    // up inner calf belly
    `C ${ax + wAnkle + 4},${yAnkle - 40} ${cx + wCalf - 6},${yCalfBelly + 80} ${cx + wCalf},${yCalfBelly}`,
    `C ${cx + wCalf},${yCalfBelly - 30} ${cx + wKnee + 6},${yKnee + 40} ${cx + wKnee},${yKnee}`,
    `C ${cx + wKnee + 6},${yKnee - 60} ${cx + wThigh + 4},${yTop + 120} ${cx + wThigh},${yTop}`,
    'Z',
  ].join(' ');
}

// ---------------------------------------------------------------------------
// SVG document assembly
// ---------------------------------------------------------------------------

interface SvgViewSpec {
  view: 'le-anterior' | 'le-posterior';
  title: string;
  segments: SegmentDef[];
}

const VIEWBOX_WIDTH = 600;
const VIEWBOX_HEIGHT = 900;

function buildSvg(spec: SvgViewSpec): string {
  const parts: string[] = [];
  parts.push(
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}" role="img" aria-labelledby="title-${spec.view}">`,
    `  <title id="title-${spec.view}">${spec.title}</title>`,
    `  <desc>Anatomically-approximate line-art of the lower-extremity venous system. Every vein segment carries a canonical id (cfv-left, gsv-ak-right, etc.) matching the IAC/SVU venous duplex protocol.</desc>`,
  );

  // Background decorative group — never tagged
  parts.push(`  <g id="silhouette" fill="#f7fafc" stroke="#cbd5e0" stroke-width="1.25" stroke-linejoin="round">`);
  parts.push(`    <path d="${legSilhouettePath('right')}" />`);
  parts.push(`    <path d="${legSilhouettePath('left')}" />`);
  parts.push(`  </g>`);

  // Pelvis/torso hint — a soft arc across the top
  parts.push(
    `  <g id="pelvis-hint" fill="none" stroke="#cbd5e0" stroke-width="1.25" stroke-linejoin="round">`,
    `    <path d="M 120,${Y.pelvisTop - 20} Q 300,20 480,${Y.pelvisTop - 20}" />`,
    `  </g>`,
  );

  // Midline guide (very light)
  parts.push(
    `  <line x1="300" y1="30" x2="300" y2="${Y.pelvisTop}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3 3" />`,
  );

  // Side labels
  parts.push(
    `  <g id="side-labels" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="14" fill="#4a5568" text-anchor="middle">`,
    `    <text x="200" y="40">R</text>`,
    `    <text x="400" y="40">L</text>`,
    `  </g>`,
  );

  // Segments — tagged paths. Stroke-only, thick enough to hit-test.
  parts.push(
    `  <g id="segments" fill="none" stroke="#1a365d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">`,
  );
  for (const seg of spec.segments) {
    parts.push(
      `    <path id="${seg.id}" d="${seg.d}" data-label="${escapeAttr(seg.label)}"><title>${escapeXml(seg.label)}</title></path>`,
    );
  }
  parts.push(`  </g>`);

  parts.push(`</svg>`);
  return parts.join('\n') + '\n';
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return escapeXml(s).replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface ViewMetadata {
  viewBox: string;
  segments: Array<{ id: string; bbox: [number, number, number, number]; label: string }>;
}

interface AnatomyMetadata {
  version: string;
  views: Record<string, ViewMetadata>;
}

function ensureDir(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

function main(): void {
  const outDir = resolve(process.cwd(), 'public/anatomy');
  const anteriorSegs = [...buildAnteriorSegments('right'), ...buildAnteriorSegments('left')];
  const posteriorSegs = [...buildPosteriorSegments('right'), ...buildPosteriorSegments('left')];

  // Coverage sanity check — warn (not fail) if we missed an expected ID.
  const expectedAnt = new Set(expectedIdsForView('le-anterior'));
  const actualAnt = new Set(anteriorSegs.map((s) => s.id));
  const missingAnt = [...expectedAnt].filter((id) => !actualAnt.has(id));
  const extraAnt = [...actualAnt].filter((id) => !expectedAnt.has(id));
  if (missingAnt.length) {
    console.warn(`[author] le-anterior MISSING ${missingAnt.length}: ${missingAnt.join(', ')}`);
  }
  if (extraAnt.length) {
    console.log(`[author] le-anterior extra (not expected but included): ${extraAnt.join(', ')}`);
  }

  const expectedPost = new Set(expectedIdsForView('le-posterior'));
  const actualPost = new Set(posteriorSegs.map((s) => s.id));
  const missingPost = [...expectedPost].filter((id) => !actualPost.has(id));
  const extraPost = [...actualPost].filter((id) => !expectedPost.has(id));
  if (missingPost.length) {
    console.warn(`[author] le-posterior MISSING ${missingPost.length}: ${missingPost.join(', ')}`);
  }
  if (extraPost.length) {
    console.log(`[author] le-posterior extra (not expected but included): ${extraPost.join(', ')}`);
  }

  const anteriorSvg = buildSvg({
    view: 'le-anterior',
    title: 'Lower-extremity venous system — anterior view',
    segments: anteriorSegs,
  });
  const posteriorSvg = buildSvg({
    view: 'le-posterior',
    title: 'Lower-extremity venous system — posterior view',
    segments: posteriorSegs,
  });

  const anteriorPath = resolve(outDir, 'le-anterior.svg');
  const posteriorPath = resolve(outDir, 'le-posterior.svg');
  ensureDir(anteriorPath);
  writeFileSync(anteriorPath, anteriorSvg, 'utf8');
  writeFileSync(posteriorPath, posteriorSvg, 'utf8');

  const metadata: AnatomyMetadata = {
    version: '0.1.0',
    views: {
      'le-anterior': {
        viewBox: `0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`,
        segments: anteriorSegs.map((s) => ({ id: s.id, bbox: s.bbox, label: s.label })),
      },
      'le-posterior': {
        viewBox: `0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`,
        segments: posteriorSegs.map((s) => ({ id: s.id, bbox: s.bbox, label: s.label })),
      },
    },
  };
  writeFileSync(resolve(outDir, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n', 'utf8');

  console.log(`[author] wrote ${anteriorSegs.length} tagged segments -> ${anteriorPath}`);
  console.log(`[author] wrote ${posteriorSegs.length} tagged segments -> ${posteriorPath}`);
  console.log(`[author] wrote metadata.json (${Object.keys(metadata.views).length} views)`);
}

main();
