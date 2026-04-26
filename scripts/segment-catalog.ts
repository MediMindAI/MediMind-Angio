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
// Arterial lower-extremity
//
// Wave 4.6 (Part 03 MEDIUM) — synced with the tagged SVG paths under
// `public/anatomy/le-arterial-anterior.svg` (14 sub-segments per side). The
// previous 7-segment list was stale and let `verify-anatomy.ts` quietly miss
// drift between the catalog and the SVG.
// ---------------------------------------------------------------------------

export const ARTERIAL_LE_SEGMENTS = [
  'cia',        // common iliac artery
  'eia',        // external iliac artery
  'cfa',        // common femoral artery
  'pfa',        // profunda femoris artery
  'sfa-prox',   // superficial femoral artery, proximal
  'sfa-mid',    // superficial femoral artery, mid
  'sfa-dist',   // superficial femoral artery, distal (adductor canal)
  'pop-ak',     // popliteal artery, above knee
  'pop-bk',     // popliteal artery, below knee
  'tpt',        // tibioperoneal trunk
  'ata',        // anterior tibial artery
  'pta',        // posterior tibial artery
  'per',        // peroneal artery
  'dp',         // dorsalis pedis artery
] as const;

export type ArterialLESegment = (typeof ARTERIAL_LE_SEGMENTS)[number];

// ---------------------------------------------------------------------------
// Carotid/vertebral/subclavian
//
// Wave 4.6 (Part 03 MEDIUM) — synced with `public/anatomy/neck-carotid.svg`
// (13 sub-segments per side). The previous 4-vessel list (cca/ica/eca/va)
// hid the proximal/mid/distal CCA + ICA + bulb + V1/V2/V3 + subclavian
// granularity that the form, FHIR builder, and PDF already use.
// ---------------------------------------------------------------------------

export const CAROTID_SEGMENTS = [
  'cca-prox',     // common carotid, proximal
  'cca-mid',      // common carotid, mid
  'cca-dist',     // common carotid, distal
  'bulb',         // carotid bulb
  'ica-prox',     // internal carotid, proximal
  'ica-mid',      // internal carotid, mid
  'ica-dist',     // internal carotid, distal
  'eca',          // external carotid
  'vert-v1',      // vertebral V1 (origin → C6 transverse foramen)
  'vert-v2',      // vertebral V2 (C6 → C2 transverse foramina)
  'vert-v3',      // vertebral V3 (atlas loop → dura)
  'subclav-prox', // subclavian, proximal
  'subclav-dist', // subclavian, distal
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
    pfa: 'Profunda femoris artery',
    'sfa-prox': 'Superficial femoral artery (proximal)',
    'sfa-mid': 'Superficial femoral artery (mid)',
    'sfa-dist': 'Superficial femoral artery (distal)',
    tpt: 'Tibioperoneal trunk',
    ata: 'Anterior tibial artery',
    pta: 'Posterior tibial artery',
    dp: 'Dorsalis pedis artery',
    'cca-prox': 'Common carotid artery (proximal)',
    'cca-mid': 'Common carotid artery (mid)',
    'cca-dist': 'Common carotid artery (distal)',
    bulb: 'Carotid bulb',
    'ica-prox': 'Internal carotid artery (proximal)',
    'ica-mid': 'Internal carotid artery (mid)',
    'ica-dist': 'Internal carotid artery (distal)',
    eca: 'External carotid artery',
    'vert-v1': 'Vertebral artery (V1)',
    'vert-v2': 'Vertebral artery (V2)',
    'vert-v3': 'Vertebral artery (V3)',
    'subclav-prox': 'Subclavian artery (proximal)',
    'subclav-dist': 'Subclavian artery (distal)',
    'avf-inflow': 'AVF inflow',
    'avf-anastomosis': 'AVF anastomosis',
    'avf-outflow': 'AVF outflow',
  };
  const base = map[segment] ?? segment;
  return `${base} (${sideLabel.toLowerCase()})`;
}
