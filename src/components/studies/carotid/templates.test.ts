// SPDX-License-Identifier: Apache-2.0
/**
 * Carotid built-in templates — guards for the clinician cleanup:
 *   - subclavian steal + plaque ulceration (ULC) are gone from every template;
 *   - no template pins a manual NASCET grade, so the SRU 2003 calculator grades
 *     from the template's own findings and keeps following typed velocities.
 */

import { describe, expect, it } from 'vitest';
import { CAROTID_TEMPLATES, findCarotidTemplateById } from './templates';
import { effectiveNascet, suggestNascetCategory } from './stenosisCalculator';
import type { CarotidFindings, NascetCategory } from './config';

/** Grade each template is meant to reach from its findings alone. */
const EXPECTED_GRADES: Record<string, { right: NascetCategory; left: NascetCategory }> = {
  'carotid-normal-bilateral': { right: 'normal', left: 'normal' },
  'carotid-mild-bilateral-atherosclerosis': { right: 'lt50', left: 'lt50' },
  'carotid-moderate-left-ica': { right: 'normal', left: '50to69' },
  'carotid-severe-left-ica': { right: 'normal', left: 'ge70' },
  'carotid-left-ica-occlusion': { right: 'lt50', left: 'occluded' },
  'carotid-post-cea-left': { right: 'lt50', left: 'normal' },
  'carotid-post-stent-right-ica': { right: 'lt50', left: 'normal' },
};

describe('carotid templates', () => {
  it('has no subclavian-steal template', () => {
    expect(findCarotidTemplateById('carotid-subclavian-steal-left')).toBeUndefined();
    expect(CAROTID_TEMPLATES.map((t) => t.id).sort()).toEqual(Object.keys(EXPECTED_GRADES).sort());
  });

  it('no template writes the retired steal / ulceration fields', () => {
    for (const tpl of CAROTID_TEMPLATES) {
      for (const f of Object.values(tpl.findings)) {
        expect(f?.subclavianStealPhase).toBeUndefined();
        expect(f?.plaqueUlceration).toBeUndefined();
      }
    }
  });

  it('no template pins a manual NASCET grade', () => {
    for (const tpl of CAROTID_TEMPLATES) {
      expect(tpl.nascet).toEqual({});
    }
  });

  it.each(Object.entries(EXPECTED_GRADES))('%s grades from its own findings', (id, expected) => {
    const tpl = findCarotidTemplateById(id);
    expect(tpl).toBeDefined();
    if (!tpl) return;
    expect(suggestNascetCategory(tpl.findings, 'right')).toBe(expected.right);
    expect(suggestNascetCategory(tpl.findings, 'left')).toBe(expected.left);
  });

  it('normal template, then ICA prox PSV 300 → effective grade follows to ≥ 70 %', () => {
    const tpl = findCarotidTemplateById('carotid-normal-bilateral');
    expect(tpl).toBeDefined();
    if (!tpl) return;
    // Mirrors the form reducer: APPLY_TEMPLATE copies findings + nascet, then
    // SET_FINDING merges the typed PSV into the existing ICA finding.
    const nascet = { ...tpl.nascet };
    const findings: CarotidFindings = {
      ...tpl.findings,
      'ica-prox-right': { ...tpl.findings['ica-prox-right'], psvCmS: 300 },
    };
    expect(effectiveNascet(findings, nascet).right).toBe('ge70');
    expect(effectiveNascet(findings, nascet).left).toBe('normal');
  });
});
