// SPDX-License-Identifier: Apache-2.0
/**
 * Wave 4.6 — focused guards for the Area 01 / 03 MEDIUM fixes.
 *
 *   1. `deriveArterialCompetency()` honors `competencyOverride`
 *      (parity with venous + carotid manual-override field).
 *   2. `subclavianStealPhase: 0` produces NO Observation in the FHIR
 *      bundle (phase 0 is the explicit negative — emitting it pollutes
 *      downstream queries that count any present phase as positive).
 *   3. ArterialLE `APPLY_TEMPLATE` with empty impression no longer
 *      forces `impressionEdited: true` — only template text marks the
 *      textarea as edited (matches venous reducer semantics).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  deriveArterialCompetency,
  type ArterialSegmentFinding,
} from './arterial-le/config';
import { buildFhirBundle } from '../../services/fhirBuilder';
import type { FormState, StudyHeader } from '../../types/form';
import type { Observation } from '../../types/fhir';

// ---------------------------------------------------------------------------
// 1. competencyOverride wins on arterial
// ---------------------------------------------------------------------------

describe('Wave 4.6 — deriveArterialCompetency honors competencyOverride', () => {
  it('returns the override even when auto-derivation would say "occluded"', () => {
    const finding: ArterialSegmentFinding = {
      occluded: true,
      stenosisCategory: 'occluded',
      waveform: 'absent',
      // Manual override forces the diagram to color this segment "normal"
      // (e.g. patent stent post-revascularization).
      competencyOverride: 'normal',
    };
    expect(deriveArterialCompetency(finding)).toBe('normal');
  });

  it('returns the override even when auto-derivation would say "severe"', () => {
    const finding: ArterialSegmentFinding = {
      stenosisCategory: 'severe',
      stenosisPct: 80,
      competencyOverride: 'mild',
    };
    expect(deriveArterialCompetency(finding)).toBe('mild');
  });

  it('falls back to auto-derivation when no override is set', () => {
    const finding: ArterialSegmentFinding = {
      stenosisCategory: 'severe',
      stenosisPct: 80,
    };
    expect(deriveArterialCompetency(finding)).toBe('severe');
  });
});

// ---------------------------------------------------------------------------
// 2. subclavianStealPhase 0 is NOT emitted as an Observation
// ---------------------------------------------------------------------------

function minimalCarotidForm(
  segmentFindings: Record<string, unknown>,
): FormState {
  const header: StudyHeader = {
    patientName: 'Test',
    studyDate: '2026-04-25',
  };
  return {
    studyType: 'carotid',
    header,
    segments: [],
    narrative: {},
    recommendations: [],
    parameters: { segmentFindings },
  } as FormState;
}

describe('Wave 4.6 — subclavianStealPhase 0 produces no Observation (Part 03 MEDIUM)', () => {
  it('phase 0 on a vertebral segment is silently dropped', () => {
    const bundle = buildFhirBundle(
      minimalCarotidForm({
        'vert-v1-left': { subclavianStealPhase: 0 },
      }),
    );
    const obsEntries = (bundle.entry ?? []).filter(
      (e) => e.resource?.resourceType === 'Observation',
    );
    const stealObs = obsEntries.find((e) => {
      const obs = e.resource as Observation;
      return obs.note?.some((n) => n.text?.includes('parameter=subclavianStealPhase'));
    });
    expect(stealObs).toBeUndefined();
  });

  it('phase 1 on a vertebral segment still emits an Observation', () => {
    const bundle = buildFhirBundle(
      minimalCarotidForm({
        'vert-v1-left': { subclavianStealPhase: 1 },
      }),
    );
    const obsEntries = (bundle.entry ?? []).filter(
      (e) => e.resource?.resourceType === 'Observation',
    );
    const stealObs = obsEntries.find((e) => {
      const obs = e.resource as Observation;
      return obs.note?.some((n) => n.text?.includes('parameter=subclavianStealPhase'));
    });
    expect(stealObs).toBeDefined();
  });

  it('phase 2 + 3 still emit (sanity)', () => {
    const bundle = buildFhirBundle(
      minimalCarotidForm({
        'vert-v2-right': { subclavianStealPhase: 2 },
        'vert-v3-left': { subclavianStealPhase: 3 },
      }),
    );
    const obsEntries = (bundle.entry ?? []).filter(
      (e) => e.resource?.resourceType === 'Observation',
    );
    const stealObs = obsEntries.filter((e) => {
      const obs = e.resource as Observation;
      return obs.note?.some((n) => n.text?.includes('parameter=subclavianStealPhase'));
    });
    expect(stealObs.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 3. ArterialLE APPLY_TEMPLATE — impressionEdited is true only when
//    the template carries impression text. Static-source guard because
//    the reducer is module-private (matches the Wave 3.1 testing style).
// ---------------------------------------------------------------------------

const here = dirname(fileURLToPath(import.meta.url));
function readForm(rel: string): string {
  return readFileSync(join(here, rel), 'utf8');
}
function applyTemplateCaseBody(source: string): string {
  const start = source.indexOf("case 'APPLY_TEMPLATE'");
  expect(start, 'expected APPLY_TEMPLATE case in reducer source').toBeGreaterThan(-1);
  const after = source.slice(start + "case 'APPLY_TEMPLATE'".length);
  const nextCase = after.search(/\n\s*case '/);
  const nextDefault = after.search(/\n\s*default\s*[:{]/);
  const candidates = [nextCase, nextDefault].filter((n) => n >= 0);
  const end = candidates.length > 0 ? Math.min(...candidates) : after.length;
  return after.slice(0, end);
}

describe('Wave 4.6 — ArterialLE APPLY_TEMPLATE conditional impressionEdited (Part 03 MEDIUM)', () => {
  it('arterial reducer marks impressionEdited only when template text is non-empty', () => {
    const src = readForm('./arterial-le/ArterialLEForm.tsx');
    const body = applyTemplateCaseBody(src);
    // Must NOT be the unconditional `impressionEdited: true,`
    expect(body).not.toMatch(/impressionEdited\s*:\s*true\s*,/);
    // Must match the conditional length-based form.
    expect(body).toMatch(/impressionEdited\s*:\s*action\.impression\.length\s*>\s*0/);
  });
});
