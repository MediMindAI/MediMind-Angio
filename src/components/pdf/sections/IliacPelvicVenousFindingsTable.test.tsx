// SPDX-License-Identifier: Apache-2.0
/**
 * IliacPelvicVenousFindingsTable — render guard for the audit fixes that put
 * the Zone-0 technique block (H3), the per-segment Valsalva response and the
 * confirmatory-imaging flag (H4) into the PDF. Booting @react-pdf is heavy, so
 * we flatten the returned element tree to its text content (the same "inspect
 * the element tree" approach used by ReportDocument.test.tsx).
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
  heading: 'Findings by zone',
  none: 'No findings recorded.',
  zone: {
    technique: 'Technique & context',
    renal: 'Left renal vein',
    caval: 'Iliac & caval',
    gonadal: 'Gonadal veins',
    plexus: 'Pelvic plexus',
    escape: 'Escape points',
    extrapelvic: 'Extrapelvic varices',
    special: 'Special considerations (SMAS / MALS)',
  },
  segment: { 'cfv-left': 'CFV (left)', 'civ-left': 'CIV (left)' },
  side: { left: 'Left', right: 'Right' },
  field: {
    sex: 'Sex',
    symptoms: 'Symptoms',
    valsalva: 'Valsalva performed',
    valsalvaResponse: 'Valsalva response',
    confirmImaging: 'Confirmatory imaging recommended',
    ratio: 'Ratio',
    velocityRatio: 'Velocity ratio',
    smaAortaAngle: 'SMA–aorta angle',
    caExpiratoryPsv: 'Celiac PSV — expiration',
  },
  value: {
    'sex.female': 'Female',
    'symptom.chronic-pelvic-pain': 'Chronic pelvic pain',
    'patency.patent': 'Patent',
    'patency.partial': 'Partial',
    'valsalvaResponse.absent': 'Absent',
    'severity.moderate': 'moderate',
    'severity.significant': 'significant',
    'level.distal': 'Distal',
    'level.mid': 'Mid',
    'level.proximal': 'Proximal',
  },
  yes: 'Present',
};

const CONTEXT: IliacContext = {
  sex: 'female',
  symptoms: ['chronic-pelvic-pain'],
  valsalvaPerformed: true,
};

const FINDINGS: IliacPelvicVenousFindings = {
  caval: {
    'cfv-left': { patency: 'patent', valsalvaResponse: 'absent', confirmatoryImagingRecommended: true },
  },
};

describe('IliacPelvicVenousFindingsTable', () => {
  it('renders the Zone-0 technique/context block (audit H3)', () => {
    const text = flattenText(
      IliacPelvicVenousFindingsTable({ findings: FINDINGS, context: CONTEXT, labels: LABELS }),
    );
    expect(text).toContain('Technique & context');
    expect(text).toContain('Female');
    expect(text).toContain('Chronic pelvic pain');
  });

  it('renders the per-segment Valsalva response + confirmatory flag (audit H4)', () => {
    const text = flattenText(
      IliacPelvicVenousFindingsTable({ findings: FINDINGS, context: CONTEXT, labels: LABELS }),
    );
    expect(text).toContain('Absent'); // valsalvaResponse value
    expect(text).toContain('Confirmatory imaging recommended');
  });

  it('shows the empty-state when nothing is recorded', () => {
    const text = flattenText(
      IliacPelvicVenousFindingsTable({ findings: {}, labels: LABELS }),
    );
    expect(text).toContain('No findings recorded.');
  });

  it('derives the velocity ratio from per-level velocities and tags the severity tier', () => {
    const findings: IliacPelvicVenousFindings = {
      caval: { 'civ-left': { patency: 'partial', levels: { distal: { velocityCmS: 40 }, proximal: { velocityCmS: 120 } } } },
    };
    const text = flattenText(IliacPelvicVenousFindingsTable({ findings, labels: LABELS }));
    expect(text).toContain('Distal 40'); // per-level velocity surfaced
    expect(text).toContain('3.0'); // derived ratio 120/40
    expect(text).toContain('significant'); // ≥ 2.5 → significant tier
  });

  it('renders the SMAS / MALS special-considerations zone', () => {
    const findings: IliacPelvicVenousFindings = {
      specialConsiderations: { smas: { smaAortaAngleDeg: 20 }, mals: { caExpiratoryPsvCmS: 250 } },
    };
    const text = flattenText(IliacPelvicVenousFindingsTable({ findings, labels: LABELS }));
    expect(text).toContain('Special considerations (SMAS / MALS)');
    expect(text).toContain('SMA–aorta angle');
    expect(text).toContain('Celiac PSV — expiration');
  });
});
