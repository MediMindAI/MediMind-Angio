/**
 * Per-study payload shapes for `FormStateBase.parameters` (Wave 2.5).
 *
 * `parameters` is typed `Readonly<Record<string, unknown>>` on FormStateBase so
 * each study variant can carry its own complex findings without smuggling
 * objects through a `string | number | boolean` shape via casts. This module
 * supplies:
 *
 *   1. The per-study payload interfaces (Venous/Arterial/Carotid).
 *   2. Lightweight runtime type guards used at the read boundary
 *      (fhirBuilder, narrativeService, FormActions PDF render).
 *
 * The guards are intentionally minimal — they confirm "this is a non-array
 * object" so downstream code can treat keyed lookups as the expected map
 * type. Deep-field validation is a Wave 4 hardening task; the goal here is a
 * typed boundary so the 11 unsafe `as unknown as <Type>` casts disappear and
 * the compiler can help catch shape drift.
 *
 * Why a separate file (not in `./form.ts`):
 *   `form.ts` is a low-level type module. The study config files
 *   (`components/studies/*\/config.ts`) already import from `form.ts`, so
 *   pulling their types back into `form.ts` would form a cycle. Keeping the
 *   payload types here breaks the cycle — only the leaf consumers
 *   (fhirBuilder, narrativeService, FormActions, *Form.tsx) import this file.
 */

import type {
  VenousSegmentFindings,
} from '../components/studies/venous-le/config';
import type {
  ArterialSegmentFindings,
  SegmentalPressures,
} from '../components/studies/arterial-le/config';
import type {
  CarotidFindings,
  CarotidNascetClassification,
} from '../components/studies/carotid/config';

// ============================================================================
// Per-study payload shapes
// ============================================================================

/** Parameter bag carried by a venous LE form (bilateral / right / left). */
export interface VenousFormParameters {
  readonly segmentFindings: VenousSegmentFindings;
}

/** Parameter bag carried by an arterial LE form. */
export interface ArterialFormParameters {
  readonly segmentFindings: ArterialSegmentFindings;
  readonly pressures?: SegmentalPressures;
}

/** Parameter bag carried by a carotid form. */
export interface CarotidFormParameters {
  readonly segmentFindings: CarotidFindings;
  readonly nascet?: CarotidNascetClassification;
}

// ============================================================================
// Runtime type guards (used at the read boundary)
// ============================================================================

/** True when `x` is a non-null, non-array object — the minimal shape every
 *  per-segment findings map satisfies (`Partial<Record<segmentId, finding>>`). */
function isPlainObject(x: unknown): x is Readonly<Record<string, unknown>> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/**
 * Narrow `parameters['segmentFindings']` to `VenousSegmentFindings`.
 *
 * The runtime check confirms "non-null object" — the per-finding fields
 * themselves remain optional (matching the source type), so downstream code
 * is safe to do `findings[segmentId]?.compressibility` without further
 * guarding.
 */
export function isVenousFindings(x: unknown): x is VenousSegmentFindings {
  return isPlainObject(x);
}

/** Narrow `parameters['segmentFindings']` to `ArterialSegmentFindings`. */
export function isArterialFindings(x: unknown): x is ArterialSegmentFindings {
  return isPlainObject(x);
}

/** Narrow `parameters['pressures']` to `SegmentalPressures`. */
export function isArterialPressures(x: unknown): x is SegmentalPressures {
  return isPlainObject(x);
}

/** Narrow `parameters['segmentFindings']` to `CarotidFindings`. */
export function isCarotidFindings(x: unknown): x is CarotidFindings {
  return isPlainObject(x);
}

/** Narrow `parameters['nascet']` to `CarotidNascetClassification`. */
export function isCarotidNascet(x: unknown): x is CarotidNascetClassification {
  return isPlainObject(x);
}
