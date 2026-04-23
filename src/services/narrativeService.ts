/**
 * Narrative service — thin wrapper + form-state adapter.
 *
 * Keeps the study-specific `generateNarrative` call site out of the UI layer.
 * The form UI and PDF renderer both call `narrativeFromFormState(form)` and
 * receive a consistent `NarrativeOutput` regardless of study type.
 *
 * For studies that don't yet have a narrative generator (arterial LE, carotid,
 * IVC, or venous right/left-only variants) we return an empty structure so the
 * caller can still render a shell.
 */

import type { FormState } from '../types/form';
import type { VenousSegmentFindings, VenousSegmentFinding } from '../components/studies/venous-le/config';
import { generateNarrative, type NarrativeOutput } from '../components/studies/venous-le/narrativeGenerator';

export { generateNarrative };
export type { NarrativeOutput };

const EMPTY_NARRATIVE: NarrativeOutput = Object.freeze({
  rightFindings: '',
  leftFindings: '',
  conclusions: [],
  rightFindingsKeys: [],
  leftFindingsKeys: [],
  conclusionsKeys: [],
});

/**
 * Produce a narrative for any form state. Only venous-LE studies currently
 * generate prose; other study types return an empty narrative.
 *
 * The venous findings are pulled from `form.parameters` under the conventional
 * `segmentFindings` key, which the form renderer populates via the per-segment
 * table. If absent we return an empty narrative.
 */
export function narrativeFromFormState(form: FormState): NarrativeOutput {
  if (
    form.studyType !== 'venousLEBilateral' &&
    form.studyType !== 'venousLERight' &&
    form.studyType !== 'venousLELeft'
  ) {
    return EMPTY_NARRATIVE;
  }

  const raw = form.parameters['segmentFindings'];
  if (!raw || typeof raw !== 'object') {
    // `parameters` is a loose record (string|number|boolean); the table UI
    // stores the findings map outside this shape. When not present there's
    // nothing to narrate.
    return EMPTY_NARRATIVE;
  }

  // Narrow cast — the form owner guarantees shape when the key is present.
  const findings = raw as unknown as VenousSegmentFindings;
  return generateNarrative(findings);
}

/**
 * Convenience helper for callers that already hold a findings map (e.g. the
 * smoke-test page). Re-exported for parity with the form-state variant.
 */
export function narrativeFromFindings(
  findings: Readonly<Record<string, VenousSegmentFinding | undefined>>
): NarrativeOutput {
  return generateNarrative(findings as VenousSegmentFindings);
}
