// SPDX-License-Identifier: Apache-2.0
/**
 * Client-side id generation with a graceful fallback.
 *
 * `crypto.randomUUID()` is not available in every runtime the EMR targets (older
 * embedded WebViews, some test environments), so calling it unguarded can throw.
 * This mirrors the long-standing guard in `RecommendationsBlock` and centralises
 * it so feature code doesn't re-inline the check (audit M4).
 *
 * For FHIR resource ids that MUST be UUIDs, use the strict generator in
 * `services/fhirBuilder/context.ts` (which throws on unsupported runtimes by
 * design) — this helper is for React keys / local list ids, where a non-UUID
 * fallback is perfectly fine.
 */
export function makeId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
