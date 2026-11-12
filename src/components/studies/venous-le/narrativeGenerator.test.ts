/**
 * U-1027: the competency override stored as `inconclusive` means
 * "perforator" (clinician feedback 2026-10-07). The narrative must say
 * perforator — never "study limited / inconclusive".
 */
import { describe, expect, it } from 'vitest';
import { generateNarrative } from './narrativeGenerator';
import ka from '../../../translations/venous-le/ka.json';
import en from '../../../translations/venous-le/en.json';
import ru from '../../../translations/venous-le/ru.json';

describe('generateNarrative — perforator (competencyOverride "inconclusive")', () => {
  const out = generateNarrative({ 'gsv-calf-right': { competencyOverride: 'inconclusive' } });

  it('emits a perforator sentence, not a study-limitation one', () => {
    expect(out.rightFindingsEntries).toEqual([
      {
        key: 'venousLE.narrative.perforator',
        params: { vein: 'venousLE.segments.gsv-calf', side: 'right' },
      },
    ]);
    expect(out.rightFindings).toBe('Perforator — great saphenous vein, calf.');
    // English conclusion feeds FHIR DiagnosticReport.conclusion.
    expect(out.conclusions).toEqual(['Perforator — right great saphenous vein, calf.']);
    expect(out.conclusionsEntries[0]?.key).toBe('venousLE.conclusion.perforator');
    expect(JSON.stringify(out)).not.toMatch(/inconclusive|limit/i);
    expect(out.leftFindingsEntries).toEqual([]);
  });

  it('has perforator wording in ka / en / ru', () => {
    expect(ka.venousLE.narrative.perforator).toBe('პერფორანტი — {vein}.');
    expect(en.venousLE.narrative.perforator).toBe('Perforator — {vein}.');
    expect(ru.venousLE.narrative.perforator).toBe('Перфорант — {vein}.');
    expect(ka.venousLE.conclusion.perforator).toBe('პერფორანტი — {side} {vein}.');
    expect(en.venousLE.conclusion.perforator).toBe('Perforator — {side} {vein}.');
    expect(ru.venousLE.conclusion.perforator).toBe('Перфорант — {side} {vein}.');
  });

  it('still flags inconclusive compressibility as a study limitation', () => {
    const limited = generateNarrative({ 'ptv-left': { compressibility: 'inconclusive' } });
    expect(limited.leftFindingsEntries[0]?.key).toBe('venousLE.narrative.inconclusive');
  });
});
