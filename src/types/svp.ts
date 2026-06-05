// SPDX-License-Identifier: Apache-2.0
/**
 * SVP classification for pelvic venous disorders (Meissner et al., 2021;
 * J Vasc Surg Venous Lymphat Disord 9:568-584 / Phlebology 36:342-360).
 *
 * Three axes:
 *   S — Symptoms        (single-select, multi allowed)
 *   V — Varices         (single-select, multi allowed)
 *   P — Pathophysiology (a LIST of per-segment entries: anatomy × hemodynamics × etiology)
 *
 * Used CONCURRENTLY with CEAP (not in place of it) when there is pelvic-origin
 * lower-extremity disease — the existing CEAP classification stays; SVP coexists.
 *
 * The structural divergence from CEAP (4 fixed single-select axes): SVP's P axis
 * is a repeatable list of `P_segment(H,E)` rows the clinician adds/removes.
 */

/** Symptoms axis. S0 none · S1 renal · S2 chronic pelvic pain · S3a/b/c pelvic-origin. */
export type SvpS = 'S0' | 'S1' | 'S2' | 'S3a' | 'S3b' | 'S3c';

/** Varices axis. V0 none · V1 renal hilar · V2 pelvic · V3a genital · V3b pelvic-origin leg. */
export type SvpV = 'V0' | 'V1' | 'V2' | 'V3a' | 'V3b';

/** Anatomic segment, listed IVC→caudal. Laterality is carried separately. */
export type SvpSegment =
  | 'IVC' // inferior vena cava (no laterality)
  | 'LRV' // left renal vein
  | 'GV' // gonadal (ovarian) vein — L/R/B
  | 'CIV' // common iliac vein — L/R/B
  | 'EIV' // external iliac vein — L/R/B
  | 'IIV' // internal iliac vein — L/R/B
  | 'PELV'; // pelvic escape veins

export type SvpLaterality = 'L' | 'R' | 'B';

/** Hemodynamics: obstruction and/or reflux (both may co-exist). */
export type SvpHemodynamic = 'O' | 'R';

/** Etiology: thrombotic | non-thrombotic | congenital. */
export type SvpEtiology = 'T' | 'NT' | 'C';

/** One P-axis entry: `P_segment(H,E)` with optional laterality + interim `x`. */
export interface SvpPathoSegment {
  /** Stable id for React keys + list mutations. Optional for legacy/seeded rows. */
  readonly id?: string;
  readonly segment: SvpSegment;
  /** Omitted/ignored for IVC (midline). */
  readonly laterality?: SvpLaterality;
  /** `['O']`, `['R']`, or both. Never empty. */
  readonly hemodynamics: ReadonlyArray<SvpHemodynamic>;
  readonly etiology: SvpEtiology;
  /** Per-segment interim/incomplete → renders the `x` subscript (e.g. `LCIVx`). */
  readonly incomplete?: boolean;
}

/**
 * Full SVP record. `s` / `v` are arrays to realise "single-select (allow
 * multi)" — exactly one entry on the common path, several when the clinician
 * records multiple. `p` is the repeatable per-segment list.
 */
export interface SvpClassification {
  readonly s: ReadonlyArray<SvpS>;
  readonly v: ReadonlyArray<SvpV>;
  readonly p: ReadonlyArray<SvpPathoSegment>;
  /** Whole-classification interim flag (overall `x` subscript). */
  readonly incomplete?: boolean;
}
