/**
 * CEAP 2020 classification for chronic venous disease.
 *
 * Spec: Lurie F, et al. "CEAP classification system and reporting standard,
 * revision 2020." Phlebology 2020;35(2):86-100.
 *
 * The classification has four axes:
 *   C — Clinical signs (C0..C6 + subscripts + recurrent/asymptomatic flags)
 *   E — Etiology
 *   A — Anatomical distribution
 *   P — Pathophysiology
 *
 * Plus three modifiers that decorate the whole classification:
 *   r  — recurrent (e.g. C2r, C6r)
 *   s  — symptomatic (appended to C class)
 *   a  — asymptomatic
 *   n  — no venous pathology identified (used with E/A/P when normal)
 */

/**
 * Clinical signs axis (C0..C6 with 4a/4b subclasses and 2r/4r/6r recurrent).
 *
 * Simplified to the codes the reporting app emits directly. The `Ceap`
 * resource-builder can construct composite strings like "C6r,s" by
 * combining a `CeapC` plus modifiers.
 */
export type CeapC =
  | 'C0' // No visible or palpable signs
  | 'C1' // Telangiectasies or reticular veins
  | 'C2' // Varicose veins
  | 'C2r' // Recurrent varicose veins
  | 'C3' // Edema
  | 'C4a' // Pigmentation / eczema
  | 'C4b' // Lipodermatosclerosis / atrophie blanche
  | 'C4c' // Corona phlebectatica
  | 'C5' // Healed venous ulcer
  | 'C6' // Active venous ulcer
  | 'C6r'; // Recurrent active venous ulcer

/** Etiology axis. */
export type CeapE =
  | 'Ec' // Congenital
  | 'Ep' // Primary
  | 'Es' // Secondary (post-thrombotic or other)
  | 'Esi' // Secondary - intravenous
  | 'Ese' // Secondary - extravenous
  | 'En'; // No cause identified

/** Anatomical axis. */
export type CeapA =
  | 'As' // Superficial
  | 'Ap' // Perforators
  | 'Ad' // Deep
  | 'An'; // No anatomical location identified

/** Pathophysiology axis. */
export type CeapP =
  | 'Pr' // Reflux
  | 'Po' // Obstruction
  | 'Pro' // Both reflux and obstruction
  | 'Pn'; // No pathophysiology identified

/** Symptom / recurrence modifier applied to the C class. */
export type CeapModifier = 'r' | 's' | 'a' | 'n';

/**
 * Full CEAP classification record.
 */
export interface CeapClassification {
  readonly c: CeapC;
  readonly e: CeapE;
  readonly a: CeapA;
  readonly p: CeapP;
  /** Optional modifiers: e.g. ['s'] for symptomatic, ['r','s'] for recurrent+symptomatic. */
  readonly modifiers?: ReadonlyArray<CeapModifier>;
}
