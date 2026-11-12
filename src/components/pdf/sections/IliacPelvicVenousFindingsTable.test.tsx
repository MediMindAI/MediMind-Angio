// SPDX-License-Identifier: Apache-2.0
/**
 * IliacPelvicVenousFindingsTable — render guard for the technique block (audit
 * H3) and the simplified IVC / RIGHT / LEFT table (clinician feedback 2026-11).
 * Booting @react-pdf is heavy, so we flatten the returned element tree to its
 * text content (the same "inspect the element tree" approach used by
 * ReportDocument.test.tsx).
 */

import { describe, expect, it } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import {
  IliacPelvicVenousFindingsTable,
  type IliacPelvicVenousFindingsTableLabels,
} from './IliacPelvicVenousFindingsTable';
import type {
  IliacPelvicVenousFindings,
  IliacContext,
} from '../../studies/iliac-pelvic-venous/config';

/** Recursively collect all string/number text rendered in the element tree. */
function flattenText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join(' ');
  const el = node as ReactElement<{ children?: ReactNode }>;
  if (el.props && 'children' in el.props) return flattenText(el.props.children);
  return '';
}

const LABELS: IliacPelvicVenousFindingsTableLabels = {
  heading: 'Findings',
  none: 'No findings recorded.',
  zone: { technique: 'Technique & context', caval: 'Iliac & caval', gonadal: 'Left gonadal vein' },
  section: { ivc: 'IVC', right: 'RIGHT', left: 'LEFT' },
  column: {
    segment: 'Vein',
    patency: 'Thrombosis',
    filling: 'Filling',
    phasicity: 'Phasicity',
    competency: 'Competency',
    apDiameterMm: 'AP mm',
    peakVelocityCmS: 'PV cm/s',
  },
  row: { cfv: 'CFV', 'civ-prox': 'CIV Prox', 'ivc-mid': 'IVC Mid', lrv: 'LRV', iiv: 'IIV' },
  field: { sex: 'Sex', symptoms: 'Symptoms', valsalva: 'Valsalva performed', diameterMm: 'Diameter', reflux: 'Reflux' },
  value: {
    'sex.female': 'Female',
    'symptom.chronic-pelvic-pain': 'Chronic pelvic pain',
    'patency.patent': 'Patent',
    'patency.thrombosis': 'Thrombosis',
    'filling.partial': 'Partial filling',
    'phasicity.monophasic': 'Monophasic',
    'competency.incompetent': 'Incompetent',
  },
  yes: 'Present',
  no: 'Absent',
};

const CONTEXT: IliacContext = {
  sex: 'female',
  symptoms: ['chronic-pelvic-pain'],
  valsalvaPerformed: true,
};

const FINDINGS: IliacPelvicVenousFindings = {
  caval: {
    'cfv-left': {
      patency: 'patent',
      phasicity: 'monophasic',
      competency: 'incompetent',
      apDiameterMm: 12,
      peakVelocityCmS: 22,
    },
    'civ-prox-right': { filling: 'partial' },
  },
  gonadal: { left: { diameterMm: 7, refluxPresent: true } },
};

describe('IliacPelvicVenousFindingsTable', () => {
  const text = (findings: IliacPelvicVenousFindings, context?: IliacContext): string =>
    flattenText(IliacPelvicVenousFindingsTable({ findings, context, labels: LABELS }));

  it('renders the technique/context block (audit H3)', () => {
    const out = text(FINDINGS, CONTEXT);
    expect(out).toContain('Technique & context');
    expect(out).toContain('Female');
    expect(out).toContain('Chronic pelvic pain');
  });

  it('renders RIGHT/LEFT sections with the same columns on every row', () => {
    const out = text(FINDINGS);
    expect(out).toContain('RIGHT');
    expect(out).toContain('LEFT');
    expect(out).not.toContain('IVC'); // no IVC rows recorded → section skipped
    expect(out).toContain('CFV');
    expect(out).toContain('Monophasic');
    expect(out).toContain('Incompetent');
    expect(out).toContain('12');
    expect(out).toContain('22');
    expect(out).toContain('Partial filling');
  });

  it('renders the left gonadal vein diameter + reflux', () => {
    const out = text(FINDINGS);
    expect(out).toContain('Left gonadal vein');
    expect(out).toContain('7');
    expect(out).toContain('Present');
  });

  it('shows the empty-state when nothing is recorded', () => {
    expect(text({})).toContain('No findings recorded.');
  });

  it('prints LRV in the IVC section, thrombosis, and AP diameter on a non-CFV row', () => {
    const out = text({
      caval: {
        lrv: { patency: 'thrombosis', apDiameterMm: 6.5 },
        'iiv-left': { apDiameterMm: 8.2 },
      },
    });
    expect(out).toContain('IVC');
    expect(out).toContain('LRV');
    expect(out).toContain('Thrombosis');
    expect(out).toContain('6.5');
    expect(out).toContain('IIV');
    expect(out).toContain('8.2');
  });

  it('never prints the removed ovarian rows from an old draft', () => {
    const legacy = {
      caval: { 'ov-right': { competency: 'incompetent', apDiameterMm: 9.9 } },
    } as unknown as IliacPelvicVenousFindings;
    const out = text(legacy);
    expect(out).toContain('No findings recorded.');
    expect(out).not.toContain('9.9');
  });

  it('ignores removed zones + old caval keys from an old draft (no crash)', () => {
    const legacy = {
      renal: { peakVelocityRatio: 8 },
      caval: { ivc: { patency: 'occluded' } },
    } as unknown as IliacPelvicVenousFindings;
    expect(text(legacy)).toContain('No findings recorded.');
  });
});
