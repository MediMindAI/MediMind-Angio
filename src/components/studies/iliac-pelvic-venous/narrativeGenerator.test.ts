import { describe, expect, it } from 'vitest';
import { generateIliacNarrative } from './narrativeGenerator';
import type { IliacPelvicVenousFindings } from './config';

describe('generateIliacNarrative', () => {
  it('treats thrombosis patency as obstruction (finding + conclusion)', () => {
    const out = generateIliacNarrative({ caval: { 'civ-mid-right': { patency: 'thrombosis' } } });
    expect(out.rightFindingsKeys).toContain('iliacPelvicVenous.narrative.rowObstruction');
    expect(out.conclusionsKeys).toContain('iliacPelvicVenous.conclusion.iliacObstruction');
    expect(out.conclusionsKeys).not.toContain('iliacPelvicVenous.conclusion.normal');
  });

  it('reports an obstructed LRV on the left side + its own conclusion', () => {
    const out = generateIliacNarrative({ caval: { lrv: { patency: 'occluded' } } });
    expect(out.leftFindingsEntries[0]?.params?.['row']).toBe('iliacPelvicVenous.row.lrv');
    expect(out.rightFindingsKeys).toEqual(['iliacPelvicVenous.narrative.normalSide']);
    expect(out.conclusionsKeys).toEqual(['iliacPelvicVenous.conclusion.lrvObstruction']);
  });

  it('ignores removed ovarian rows from an old draft', () => {
    const legacy = {
      caval: { 'ov-left': { competency: 'incompetent' } },
    } as unknown as IliacPelvicVenousFindings;
    expect(generateIliacNarrative(legacy).leftFindingsKeys).toEqual([
      'iliacPelvicVenous.narrative.normalSide',
    ]);
  });
});
