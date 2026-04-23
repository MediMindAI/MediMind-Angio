/**
 * Canonical segment catalog for anatomical SVG tagging.
 *
 * Every vein/artery segment used across the angiology reporting app MUST be
 * declared here. IDs follow the pattern `{segment}-{side}` (e.g. `cfv-left`).
 *
 * Sources:
 * - IAC/SVU venous duplex protocol (standard 15 venous LE segments + variants)
 * - Society of Vascular Ultrasound — arterial LE protocol
 * - IAC carotid/vertebral duplex protocol
 * - KDOQI dialysis access guidelines
 */

// ---------------------------------------------------------------------------
// Sides
// ---------------------------------------------------------------------------

export const SIDES = ['left', 'right'] as const;
export type Side = (typeof SIDES)[number];

// ---------------------------------------------------------------------------
// Venous lower-extremity (Phase 0 — primary target)
// ---------------------------------------------------------------------------

export const VENOUS_LE_SEGMENTS = [
  'cfv', // common femoral vein
  'eiv', // external iliac vein
  'fv-prox', // femoral vein proximal
  'fv-mid', // femoral vein mid
  'fv-dist', // femoral vein distal
  'pfv', // profunda (deep femoral) vein
  'gsv-ak', // great saphenous vein above knee
  'gsv-prox-calf', // GSV proximal calf
  'gsv-mid-calf', // GSV mid calf
  'gsv-dist-calf', // GSV distal calf
  'pop-ak', // popliteal above knee
  'pop-fossa', // popliteal fossa
  'pop-bk', // popliteal below knee
  'ptv', // posterior tibial vein
  'per', // peroneal vein
  'ssv', // small saphenous vein
  'gastroc', // gastrocnemius vein
  'soleal', // soleal vein
  'sfj', // saphenofemoral junction
  'spj', // saphenopopliteal junction
] as const;

export type VenousLESegment = (typeof VENOUS_LE_SEGMENTS)[number];

// ---------------------------------------------------------------------------
// Abdominal & pelvic venous (stub — Phase 1+)
// ---------------------------------------------------------------------------

export const ABDOMINAL_PELVIC_SEGMENTS = [
  'ivc', // inferior vena cava (midline, no side)
  'lrv', // left renal vein (midline, left-specific)
  'cia', // common iliac vein
  'eia', // external iliac vein
  'iia', // internal iliac vein
] as const;

export type AbdominalPelvicSegment = (typeof ABDOMINAL_PELVIC_SEGMENTS)[number];

// ---------------------------------------------------------------------------
// Arterial lower-extremity (stub — Phase 1+)
// ---------------------------------------------------------------------------

export const ARTERIAL_LE_SEGMENTS = [
  'cfa', // common femoral artery
  'sfa', // superficial femoral artery
  'pop-art', // popliteal artery
  'at', // anterior tibial artery
  'pt', // posterior tibial artery
  'per-art', // peroneal artery
  'dp', // dorsalis pedis artery
] as const;

export type ArterialLESegment = (typeof ARTERIAL_LE_SEGMENTS)[number];

// ---------------------------------------------------------------------------
// Carotid/vertebral (stub — Phase 1+)
// ---------------------------------------------------------------------------

export const CAROTID_SEGMENTS = [
  'cca', // common carotid artery
  'ica', // internal carotid artery
  'eca', // external carotid artery
  'va', // vertebral artery
] as const;

export type CarotidSegment = (typeof CAROTID_SEGMENTS)[number];

// ---------------------------------------------------------------------------
// Dialysis access (stub — Phase 1+)
// ---------------------------------------------------------------------------

export const DIALYSIS_ACCESS_SEGMENTS = [
  'avf-inflow',
  'avf-anastomosis',
  'avf-outflow',
] as const;

export type DialysisAccessSegment = (typeof DIALYSIS_ACCESS_SEGMENTS)[number];

// ---------------------------------------------------------------------------
// Union types + full-ID helpers
// ---------------------------------------------------------------------------

export type AnySegment =
  | VenousLESegment
  | AbdominalPelvicSegment
  | ArterialLESegment
  | CarotidSegment
  | DialysisAccessSegment;

export type FullSegmentId = `${AnySegment}-${Side}`;

/** Build a full sided ID, e.g. `cfv-left`. */
export function fullId<T extends AnySegment>(segment: T, side: Side): `${T}-${Side}` {
  return `${segment}-${side}` as `${T}-${Side}`;
}

/**
 * Return the full list of sided IDs expected in a view's SVG.
 * Used by verify-anatomy.ts to check coverage.
 */
export function expectedIdsForView(
  view:
    | 'le-anterior'
    | 'le-posterior'
    | 'abdominal-pelvic'
    | 'le-arterial'
    | 'carotid'
    | 'dialysis-access',
): string[] {
  switch (view) {
    case 'le-anterior': {
      // Anterior view covers everything EXCEPT the posterior-only trio
      // (gastroc, soleal, ssv, spj, pop-fossa — those belong to posterior).
      const anteriorOnly = VENOUS_LE_SEGMENTS.filter(
        (s) => !['gastroc', 'soleal', 'ssv', 'spj', 'pop-fossa'].includes(s),
      );
      return SIDES.flatMap((side) => anteriorOnly.map((seg) => `${seg}-${side}`));
    }
    case 'le-posterior': {
      // Posterior view shows the calf posterior veins + popliteal fossa + SSV/SPJ + distal GSV.
      const posteriorOnly = [
        'pop-ak',
        'pop-fossa',
        'pop-bk',
        'ssv',
        'spj',
        'gastroc',
        'soleal',
        'ptv',
        'per',
        'gsv-mid-calf',
        'gsv-dist-calf',
      ] as const;
      return SIDES.flatMap((side) => posteriorOnly.map((seg) => `${seg}-${side}`));
    }
    case 'abdominal-pelvic':
      return SIDES.flatMap((side) =>
        ABDOMINAL_PELVIC_SEGMENTS.map((seg) => `${seg}-${side}`),
      );
    case 'le-arterial':
      return SIDES.flatMap((side) => ARTERIAL_LE_SEGMENTS.map((seg) => `${seg}-${side}`));
    case 'carotid':
      return SIDES.flatMap((side) => CAROTID_SEGMENTS.map((seg) => `${seg}-${side}`));
    case 'dialysis-access':
      return SIDES.flatMap((side) =>
        DIALYSIS_ACCESS_SEGMENTS.map((seg) => `${seg}-${side}`),
      );
  }
}

/** Human-readable label for a segment (English). Used in metadata + tooltips. */
export function segmentLabel(segment: AnySegment, side: Side): string {
  const sideLabel = side.charAt(0).toUpperCase() + side.slice(1);
  const map: Record<string, string> = {
    cfv: 'Common femoral vein',
    eiv: 'External iliac vein',
    'fv-prox': 'Femoral vein (proximal)',
    'fv-mid': 'Femoral vein (mid)',
    'fv-dist': 'Femoral vein (distal)',
    pfv: 'Profunda (deep femoral) vein',
    'gsv-ak': 'Great saphenous vein (above knee)',
    'gsv-prox-calf': 'Great saphenous vein (proximal calf)',
    'gsv-mid-calf': 'Great saphenous vein (mid calf)',
    'gsv-dist-calf': 'Great saphenous vein (distal calf)',
    'pop-ak': 'Popliteal vein (above knee)',
    'pop-fossa': 'Popliteal vein (fossa)',
    'pop-bk': 'Popliteal vein (below knee)',
    ptv: 'Posterior tibial vein',
    per: 'Peroneal vein',
    ssv: 'Small saphenous vein',
    gastroc: 'Gastrocnemius vein',
    soleal: 'Soleal vein',
    sfj: 'Saphenofemoral junction',
    spj: 'Saphenopopliteal junction',
    ivc: 'Inferior vena cava',
    lrv: 'Left renal vein',
    cia: 'Common iliac vein',
    eia: 'External iliac vein',
    iia: 'Internal iliac vein',
    cfa: 'Common femoral artery',
    sfa: 'Superficial femoral artery',
    'pop-art': 'Popliteal artery',
    at: 'Anterior tibial artery',
    pt: 'Posterior tibial artery',
    'per-art': 'Peroneal artery',
    dp: 'Dorsalis pedis artery',
    cca: 'Common carotid artery',
    ica: 'Internal carotid artery',
    eca: 'External carotid artery',
    va: 'Vertebral artery',
    'avf-inflow': 'AVF inflow',
    'avf-anastomosis': 'AVF anastomosis',
    'avf-outflow': 'AVF outflow',
  };
  const base = map[segment] ?? segment;
  return `${base} (${sideLabel.toLowerCase()})`;
}
