// SPDX-License-Identifier: Apache-2.0
/**
 * SVP (Symptoms–Varices–Pathophysiology) classification helpers — the pelvic
 * analogue of `ceapService`. Produces:
 *   - the canonical formatted string ("S2 V2 P_LCIV(O,NT); LIIV(R,NT)")
 *   - i18n keys per axis code (UI labels)
 *   - FHIR `Observation.component[]` entries
 *
 * Spec: Meissner MH, et al. "The Symptoms-Varices-Pathophysiology
 * classification of pelvic venous disorders." J Vasc Surg Venous Lymphat
 * Disord 2021;9:568-584.
 *
 * Divergence from CEAP: the P axis is a LIST of per-segment rows, so SVP emits
 * ONE Observation.component per P-row (CEAP emits exactly four, one per axis).
 */

import type {
  SvpClassification,
  SvpHemodynamic,
  SvpPathoSegment,
  SvpS,
  SvpSegment,
  SvpV,
} from '../types/svp';
import type { Coding, ObservationComponent } from '../types/fhir';
import {
  SNOMED_LATERALITY,
  STANDARD_FHIR_SYSTEMS,
  SVP_SEGMENT_SNOMED,
  SVP_SNOMED,
} from '../constants/fhir-systems';

/** Canonical anatomic order, IVC → caudal. Drives the P-row sort. */
export const SVP_SEGMENT_ORDER: ReadonlyArray<SvpSegment> = [
  'IVC',
  'LRV',
  'GV',
  'CIV',
  'EIV',
  'IIV',
  'PELV',
];

// ============================================================================
// Formatting
// ============================================================================

/** Canonical composite, e.g. `"S2 V2 P_LCIV(O,NT); LIIV(R,NT)"`. */
export function formatSvpClassification(svp: SvpClassification): string {
  const sPart = svp.s.length > 0 ? svp.s.join(',') : 'S0';
  const vPart = svp.v.length > 0 ? svp.v.join(',') : 'V0';
  const ordered = sortedP(svp.p);
  const pPart = ordered.length > 0 ? `P_${ordered.map(formatSegment).join('; ')}` : 'P_';
  const out = `${sPart} ${vPart} ${pPart}`;
  return svp.incomplete ? `${out} (interim)` : out;
}

function sortedP(p: ReadonlyArray<SvpPathoSegment>): SvpPathoSegment[] {
  return [...p].sort(
    (a, b) => SVP_SEGMENT_ORDER.indexOf(a.segment) - SVP_SEGMENT_ORDER.indexOf(b.segment),
  );
}

/** One P entry, e.g. `LCIV(O,NT)` or `IVC(R,T)`. */
export function formatSegment(seg: SvpPathoSegment): string {
  const lat = seg.segment === 'IVC' ? '' : (seg.laterality ?? '');
  const token = `${lat}${seg.segment}${seg.incomplete ? 'x' : ''}`;
  // O before R; combined renders `O/R` so the `(H,E)` comma never collides.
  const order: Record<SvpHemodynamic, number> = { O: 0, R: 1 };
  const h = [...seg.hemodynamics].sort((a, b) => order[a] - order[b]).join('/');
  return `${token}(${h},${seg.etiology})`;
}

// ============================================================================
// Per-axis descriptions (i18n keys)
// ============================================================================

/** e.g. 'S3a' → 'svp.s.3a'. */
export function svpSDescription(s: SvpS): string {
  return `svp.s.${s.slice(1).toLowerCase()}`;
}

/** e.g. 'V2' → 'svp.v.2'. */
export function svpVDescription(v: SvpV): string {
  return `svp.v.${v.slice(1).toLowerCase()}`;
}

// ============================================================================
// FHIR emission
// ============================================================================

export function svpObservationComponents(
  svp: SvpClassification,
): ReadonlyArray<ObservationComponent> {
  const components: ObservationComponent[] = [];

  // S axis — text only (symptom codes).
  components.push({
    code: { text: 'SVP Symptoms (S)' },
    valueCodeableConcept: { text: (svp.s.length ? svp.s : ['S0']).join(' ') },
  });

  // V axis — text + pelvic-varices SNOMED when V2 present.
  const vCodings: Coding[] = [];
  if (svp.v.includes('V2')) {
    vCodings.push({
      system: STANDARD_FHIR_SYSTEMS.SNOMED,
      code: SVP_SNOMED.PELVIC_VARICES.code,
      display: SVP_SNOMED.PELVIC_VARICES.display,
    });
  }
  components.push({
    code: { text: 'SVP Varices (V)' },
    valueCodeableConcept: {
      ...(vCodings.length ? { coding: vCodings } : {}),
      text: (svp.v.length ? svp.v : ['V0']).join(' '),
    },
  });

  // P axis — one component per segment row (the divergence from CEAP).
  for (const seg of sortedP(svp.p)) {
    const codeCodings = codeForSegment(seg);
    const valueCodings = codingsForPSegment(seg);
    const segText = `${seg.segment === 'IVC' ? '' : (seg.laterality ?? '')}${seg.segment}`;
    components.push({
      code: codeCodings.length ? { coding: codeCodings, text: segText } : { text: segText },
      valueCodeableConcept: valueCodings.length
        ? { coding: valueCodings, text: formatSegment(seg) }
        : { text: formatSegment(seg) },
    });
  }

  return components;
}

/** Segment body-site + laterality codings (the WHAT — goes on component.code). */
function codeForSegment(seg: SvpPathoSegment): Coding[] {
  const codings: Coding[] = [];
  const segSnomed = SVP_SEGMENT_SNOMED[seg.segment];
  if (segSnomed.code !== '-') {
    codings.push({
      system: STANDARD_FHIR_SYSTEMS.SNOMED,
      code: segSnomed.code,
      display: segSnomed.display,
    });
  }
  if (seg.segment !== 'IVC' && seg.laterality) {
    const lat =
      seg.laterality === 'L'
        ? SNOMED_LATERALITY.left
        : seg.laterality === 'R'
          ? SNOMED_LATERALITY.right
          : SNOMED_LATERALITY.bilateral;
    codings.push({ system: STANDARD_FHIR_SYSTEMS.SNOMED, code: lat.code, display: lat.display });
  }
  return codings;
}

/** Finding codings (the FINDING — goes on component.value), with syndrome refinement. */
function codingsForPSegment(seg: SvpPathoSegment): Coding[] {
  const codings: Coding[] = [];
  if (seg.hemodynamics.includes('R')) {
    codings.push({
      system: STANDARD_FHIR_SYSTEMS.SNOMED,
      code: SVP_SNOMED.REFLUX.code,
      display: SVP_SNOMED.REFLUX.display,
    });
  }
  if (seg.hemodynamics.includes('O')) {
    codings.push({
      system: STANDARD_FHIR_SYSTEMS.SNOMED,
      code: SVP_SNOMED.OBSTRUCTION.code,
      display: SVP_SNOMED.OBSTRUCTION.display,
    });
    // Named-syndrome refinement.
    if (seg.segment === 'CIV' && seg.etiology === 'NT') {
      codings.push({
        system: STANDARD_FHIR_SYSTEMS.SNOMED,
        code: SVP_SNOMED.ILIAC_COMPRESSION.code,
        display: SVP_SNOMED.ILIAC_COMPRESSION.display,
      });
    }
    if (seg.segment === 'LRV' && seg.etiology === 'NT') {
      codings.push({
        system: STANDARD_FHIR_SYSTEMS.SNOMED,
        code: SVP_SNOMED.NUTCRACKER.code,
        display: SVP_SNOMED.NUTCRACKER.display,
      });
    }
  }
  return codings;
}
