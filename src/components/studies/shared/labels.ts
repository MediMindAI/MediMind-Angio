// SPDX-License-Identifier: Apache-2.0
/**
 * Shared default labels for cross-study primitives.
 *
 * Some categorical values (e.g. `PlaqueMorphology`) are structurally
 * identical across the arterial-LE and carotid studies. Both modules
 * expose nominally-distinct types whose underlying string-literal sets
 * match, so we type the helper inputs as the literal union and accept
 * either study's type structurally.
 *
 * These functions return the canonical English fallback label only. The
 * call site is expected to wire i18n via `t()` and use this as the
 * second-arg fallback when the translation key is missing.
 */

/** Plaque morphology values shared by arterial-LE and carotid studies. */
export type SharedPlaqueMorphology = 'none' | 'calcified' | 'mixed' | 'soft';

/** English default label for a plaque morphology value. */
export function defaultPlaqueLabel(v: SharedPlaqueMorphology): string {
  switch (v) {
    case 'none':      return 'None';
    case 'calcified': return 'Calcified';
    case 'mixed':     return 'Mixed';
    case 'soft':      return 'Soft';
  }
}
