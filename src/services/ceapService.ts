/**
 * CEAP 2020 classification helpers.
 *
 * Produces:
 *   - Human-readable formatted strings ("C2s,Ep,As,Pr")
 *   - i18n keys for each axis value (to render descriptive labels in the UI)
 *   - FHIR `Observation.component[]` entries for emission into the bundle
 *
 * Spec: Lurie F, et al. "CEAP classification system and reporting standard,
 * revision 2020." Phlebology 2020;35(2):86-100.
 *
 * Anatomy and pathophysiology axes are multi-select per the 2020 standard —
 * a single patient can have superficial + perforator + deep involvement.
 * Our internal `CeapClassification.a` / `.p` types model a single-value
 * slot today; the description-returning helpers expose all sub-codes via
 * the keys array so the UI can show combined labels when the form eventually
 * supports multi-select.
 */

import type {
  CeapA,
  CeapC,
  CeapClassification,
  CeapE,
  CeapModifier,
  CeapP,
} from '../types/ceap';
import type { ObservationComponent } from '../types/fhir';
import { CEAP_SNOMED, STANDARD_FHIR_SYSTEMS } from '../constants/fhir-systems';

// ============================================================================
// Formatting
// ============================================================================

/**
 * Canonical CEAP string, e.g. `"C2s,Ep,As,Pr"`.
 *
 * The symptomatic / recurrent modifier sits inline on the C axis (standard
 * practice — `C2s`, `C6r,s`). Remaining axes are joined by commas.
 */
export function formatCeapClassification(c: CeapClassification): string {
  const parts: string[] = [];
  parts.push(formatCAxisWithModifiers(c.c, c.modifiers));
  parts.push(c.e);
  parts.push(c.a);
  parts.push(c.p);
  return parts.join(',');
}

function formatCAxisWithModifiers(
  c: CeapC,
  modifiers: ReadonlyArray<CeapModifier> | undefined
): string {
  if (!modifiers || modifiers.length === 0) return c;
  // Preserve the recurrent/symptomatic ordering convention: r before s.
  const order: CeapModifier[] = ['r', 's', 'a', 'n'];
  const ordered = order.filter((m) => modifiers.includes(m));
  // `C2r`/`C6r` already encode recurrence in the base — don't double-append `r`.
  const baseHasR = c.endsWith('r');
  const filtered = baseHasR ? ordered.filter((m) => m !== 'r') : ordered;
  return `${c}${filtered.join('')}`;
}

// ============================================================================
// Per-axis descriptions (i18n keys)
// ============================================================================

/** Translation key for the C-axis code. */
export function ceapCDescription(c: CeapC): string {
  // Recurrent variants share the same key as their base class.
  const base: CeapC = c === 'C2r' ? 'C2' : c === 'C6r' ? 'C6' : c;
  const num = base.slice(1); // "0" | "1" | "2" | "3" | "4a" | "4b" | "4c" | "5" | "6"
  return `ceap.c.${num}`;
}

/** Translation key for the E-axis code. */
export function ceapEDescription(e: CeapE): string {
  switch (e) {
    case 'Ec':
      return 'ceap.e.c';
    case 'Ep':
      return 'ceap.e.p';
    case 'Es':
    case 'Esi':
    case 'Ese':
      // Intravenous / extravenous variants share the base 'secondary' key; the
      // UI can further disambiguate if needed.
      return 'ceap.e.s';
    case 'En':
      return 'ceap.e.n';
    default: {
      const _exhaustive: never = e;
      return _exhaustive;
    }
  }
}

/** Translation keys for the A-axis — returned as an array for future multi-select. */
export function ceapADescription(a: CeapA): ReadonlyArray<string> {
  switch (a) {
    case 'As':
      return ['ceap.a.s'];
    case 'Ap':
      return ['ceap.a.p'];
    case 'Ad':
      return ['ceap.a.d'];
    case 'An':
      return ['ceap.a.n'];
    default: {
      const _exhaustive: never = a;
      return [_exhaustive];
    }
  }
}

/** Translation keys for the P-axis — returned as an array; `Pro` expands to reflux + obstruction. */
export function ceapPDescription(p: CeapP): ReadonlyArray<string> {
  switch (p) {
    case 'Pr':
      return ['ceap.p.r'];
    case 'Po':
      return ['ceap.p.o'];
    case 'Pro':
      return ['ceap.p.rO'];
    case 'Pn':
      return ['ceap.p.n'];
    default: {
      const _exhaustive: never = p;
      return [_exhaustive];
    }
  }
}

// ============================================================================
// FHIR emission
// ============================================================================

/**
 * Build `Observation.component[]` entries for the four CEAP axes. Emits one
 * component per axis (C, E, A, P) per JVS-VL 2020 reporting recommendations.
 *
 * Each component:
 *   - `code` → a MediMind-internal CodeableConcept naming the axis (human-readable text)
 *   - `valueCodeableConcept` → the axis code + (if available) SNOMED translation
 */
export function ceapObservationComponents(
  c: CeapClassification
): ReadonlyArray<ObservationComponent> {
  const components: ObservationComponent[] = [];
  components.push({
    code: { text: 'CEAP Clinical (C)' },
    valueCodeableConcept: {
      coding: codingsForC(c.c),
      text: formatCAxisWithModifiers(c.c, c.modifiers),
    },
  });
  components.push({
    code: { text: 'CEAP Etiology (E)' },
    valueCodeableConcept: { text: c.e },
  });
  components.push({
    code: { text: 'CEAP Anatomy (A)' },
    valueCodeableConcept: { text: c.a },
  });
  components.push({
    code: { text: 'CEAP Pathophysiology (P)' },
    valueCodeableConcept: { coding: codingsForP(c.p), text: c.p },
  });
  return components;
}

// ---------------------------------------------------------------------------

function codingsForC(c: CeapC): ReadonlyArray<{
  readonly system: string;
  readonly code: string;
  readonly display: string;
}> {
  // Map C-axis codes to SNOMED only where a precise concept exists (see
  // CEAP_SNOMED in fhir-systems.ts). Recurrent variants share the base concept.
  const base: CeapC = c === 'C2r' ? 'C2' : c === 'C6r' ? 'C6' : c;
  const snomed = snomedForC(base);
  if (!snomed) return [];
  const code: string = snomed.code;
  if (code === '-') return [];
  return [{ system: STANDARD_FHIR_SYSTEMS.SNOMED, code, display: snomed.display }];
}

function snomedForC(c: CeapC): { code: string; display: string } | undefined {
  switch (c) {
    case 'C1':
      return CEAP_SNOMED.C1;
    case 'C2':
      return CEAP_SNOMED.C2;
    case 'C3':
      return CEAP_SNOMED.C3;
    case 'C4a':
      return CEAP_SNOMED.C4A;
    case 'C4b':
      return CEAP_SNOMED.C4B;
    case 'C4c':
      return CEAP_SNOMED.C4C;
    case 'C5':
      return CEAP_SNOMED.C5;
    case 'C6':
      return CEAP_SNOMED.C6;
    default:
      return undefined;
  }
}

function codingsForP(p: CeapP): ReadonlyArray<{
  readonly system: string;
  readonly code: string;
  readonly display: string;
}> {
  const codings: Array<{ system: string; code: string; display: string }> = [];
  if (p === 'Pr' || p === 'Pro') {
    const refluxCode: string = CEAP_SNOMED.REFLUX.code;
    if (refluxCode !== '-') {
      codings.push({
        system: STANDARD_FHIR_SYSTEMS.SNOMED,
        code: refluxCode,
        display: CEAP_SNOMED.REFLUX.display,
      });
    }
  }
  if (p === 'Po' || p === 'Pro') {
    const obstructionCode: string = CEAP_SNOMED.OBSTRUCTION.code;
    if (obstructionCode !== '-') {
      codings.push({
        system: STANDARD_FHIR_SYSTEMS.SNOMED,
        code: obstructionCode,
        display: CEAP_SNOMED.OBSTRUCTION.display,
      });
    }
  }
  return codings;
}
