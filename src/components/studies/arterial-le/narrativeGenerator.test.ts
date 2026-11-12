import { describe, expect, it } from 'vitest';
import { generateArterialNarrative } from './narrativeGenerator';
import type { ArterialSegmentFindings } from './config';

describe('generateArterialNarrative — stenosis sentence', () => {
  it('omits PSV when none was entered instead of printing 0 (level-up U-1040)', () => {
    const findings = { 'sfa-prox-right': { stenosisCategory: 'severe' } } as ArterialSegmentFindings;
    const out = generateArterialNarrative(findings, {});
    const entry = out.rightFindingsEntries.find((e) => e.key.startsWith('arterialLE.narrative.stenosis'));
    expect(entry?.key).toBe('arterialLE.narrative.stenosisNoPsv');
    expect(entry?.params).not.toHaveProperty('psv');
  });

  it('keeps the PSV sentence when a PSV was entered', () => {
    const findings = { 'sfa-prox-right': { stenosisCategory: 'severe', psvCmS: 310 } } as ArterialSegmentFindings;
    const out = generateArterialNarrative(findings, {});
    const entry = out.rightFindingsEntries.find((e) => e.key.startsWith('arterialLE.narrative.stenosis'));
    expect(entry?.key).toBe('arterialLE.narrative.stenosis');
    expect(entry?.params).toMatchObject({ psv: 310 });
  });
});
