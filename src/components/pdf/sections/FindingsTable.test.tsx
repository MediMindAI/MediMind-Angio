// SPDX-License-Identifier: Apache-2.0
/**
 * FindingsTable — UX-ANGIO-003 L3 / U-1033: a venous segment with only
 * categorical findings (reflux override, partial compressibility) must print
 * as text in the PDF table, never be dropped or shown as a bare "—".
 * Booting @react-pdf is heavy, so we walk the returned element tree (same
 * approach as IliacPelvicVenousFindingsTable.test.tsx), expanding function
 * components (SideTable) along the way.
 */

import { describe, expect, it } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import { FindingsTable, type FindingsTableLabels } from './FindingsTable';
import { PDF_THEME } from '../pdfTheme';
import { buildReportLabels } from '../buildReportLabels';
import type {
  VenousLESegmentBase,
  VenousSegmentFindings,
} from '../../studies/venous-le/config';

type El = ReactElement<{ children?: ReactNode; style?: unknown }>;

/** Expand function components so the walk reaches the rendered primitives. */
function expand(node: ReactNode): ReactNode {
  const el = node as El;
  if (el && typeof el === 'object' && typeof el.type === 'function') {
    return expand((el.type as (p: unknown) => ReactNode)(el.props));
  }
  return node;
}

/** Recursively collect all string/number text rendered in the element tree. */
function flattenText(node: ReactNode): string {
  const n = expand(node);
  if (n === null || n === undefined || typeof n === 'boolean') return '';
  if (typeof n === 'string' || typeof n === 'number') return String(n);
  if (Array.isArray(n)) return n.map(flattenText).join(' ');
  const el = n as El;
  if (el.props && 'children' in el.props) return flattenText(el.props.children);
  return '';
}

/** Find the style of the element whose direct text children equal `text`. */
function styleOfText(node: ReactNode, text: string): Record<string, unknown> | undefined {
  const n = expand(node);
  if (n === null || n === undefined || typeof n !== 'object') return undefined;
  if (Array.isArray(n)) {
    for (const c of n) {
      const hit = styleOfText(c, text);
      if (hit) return hit;
    }
    return undefined;
  }
  const el = n as El;
  if (el.props?.children === text) return el.props.style as Record<string, unknown>;
  return el.props ? styleOfText(el.props.children, text) : undefined;
}

const LABELS: FindingsTableLabels = {
  right: 'RIGHT',
  left: 'LEFT',
  segment: 'Segment',
  refluxMs: 'Dur. (s)',
  apMm: 'Diameter (mm)',
  depthMm: 'Depth (mm)',
  segmentName: { cfv: 'CFV', 'gsv-prox-thigh': 'GSV Prox Thigh', ssv: 'SSV' } as Record<
    VenousLESegmentBase,
    string
  >,
  emptyDash: '—',
  field: {
    competencyOverride: 'Competency',
    compressibility: 'Compressibility',
    thrombosis: 'Thrombosis',
    phasicity: 'Phasicity',
  },
  value: {
    'competencyOverride.incompetent': 'Reflux',
    'compressibility.partial': 'Partial',
    'compressibility.normal': 'Full',
    'thrombosis.none': '—',
    'thrombosis.chronic': 'Chronic',
    'phasicity.respirophasic': 'Respirophasic',
    'phasicity.reduced': 'Reduced',
  },
};

const text = (findings: VenousSegmentFindings, side: 'left' | 'right' = 'right'): string =>
  flattenText(FindingsTable({ findings, labels: LABELS, singleSide: side }));

describe('FindingsTable — categorical findings print as text (U-1033)', () => {
  it('prints a GSV reflux override with no numbers (was dropped)', () => {
    const out = text({ 'gsv-prox-thigh-right': { competencyOverride: 'incompetent' } });
    expect(out).toContain('GSV Prox Thigh');
    expect(out).toContain('Competency: Reflux');
  });

  it('prints CFV partial compressibility with no numbers (was dropped)', () => {
    const out = text({ 'cfv-right': { compressibility: 'partial', thrombosis: 'chronic' } });
    expect(out).toContain('CFV');
    expect(out).toContain('Compressibility: Partial · Thrombosis: Chronic');
  });

  it('prints the categorical line in the error colour when it marks reflux/occlusion', () => {
    const tree = FindingsTable({
      findings: { 'cfv-right': { compressibility: 'partial' } },
      labels: LABELS,
      singleSide: 'right',
    });
    expect(styleOfText(tree, 'Compressibility: Partial')?.color).toBe(PDF_THEME.error);
  });

  it('prints no categorical text for an all-normal segment (U-1011 pertinent findings)', () => {
    const allNormal = {
      competencyOverride: 'normal',
      compressibility: 'normal',
      thrombosis: 'none',
      phasicity: 'respirophasic',
    } as const;
    // Categorical-only normal segment → no row at all.
    expect(text({ 'ssv-right': allNormal })).not.toContain('SSV');
    // With a number the row stays, but no categorical line is printed.
    const out = text({ 'ssv-right': { ...allNormal, apDiameterMm: 4 } });
    expect(out).toContain('SSV');
    expect(out).not.toContain('Competency');
    expect(out).not.toContain('Compressibility');
    expect(out).not.toContain('Thrombosis');
    expect(out).not.toContain('Phasicity');
  });

  it('prints only the abnormal value next to normal ones, in the regular colour', () => {
    const findings: VenousSegmentFindings = {
      'ssv-right': { compressibility: 'normal', thrombosis: 'none', phasicity: 'reduced' },
    };
    const out = text(findings);
    expect(out).toContain('Phasicity: Reduced');
    expect(out).not.toContain('Compressibility');
    expect(out).not.toContain('Thrombosis');
    const tree = FindingsTable({ findings, labels: LABELS, singleSide: 'right' });
    expect(styleOfText(tree, 'Phasicity: Reduced')?.color).toBe(PDF_THEME.text);
  });

  it('keeps numeric-only rows and still omits segments with nothing recorded', () => {
    const out = text({ 'cfv-right': { apDiameterMm: 9 }, 'ssv-right': {} });
    expect(out).toContain('CFV');
    expect(out).toContain('9.0');
    expect(out).not.toContain('SSV');
    expect(out).not.toContain('Compressibility');
  });

  it('a row holding only thrombosis "none" (label "—") is not printed', () => {
    expect(text({ 'ssv-right': { thrombosis: 'none' } })).not.toContain('SSV');
  });

  it('keeps sides apart', () => {
    const findings: VenousSegmentFindings = { 'cfv-left': { compressibility: 'partial' } };
    expect(text(findings, 'right')).not.toContain('Partial');
    expect(text(findings, 'left')).toContain('Compressibility: Partial');
  });

  it('falls back to raw keys when a hand-built label set omits field/value', () => {
    const { field: _f, value: _v, ...bare } = LABELS;
    const out = flattenText(
      FindingsTable({
        findings: { 'cfv-right': { competencyOverride: 'incompetent' } },
        labels: bare,
        singleSide: 'right',
      }),
    );
    expect(out).toContain('competencyOverride: incompetent');
  });
});

describe('buildReportLabels — venous categorical labels', () => {
  const t = (key: string): string => `T(${key})`;

  it('exposes field names and value labels from the on-screen keys', () => {
    const { findings } = buildReportLabels(t);
    expect(findings.field?.competencyOverride).toBe('T(venousLE.param.competency)');
    expect(findings.field?.compressibility).toBe('T(venousLE.param.compressibility)');
    expect(findings.value?.['competencyOverride.incompetent']).toBe(
      'T(venousLE.competency.incompetent)',
    );
    expect(findings.value?.['competencyOverride.inconclusive']).toBe(
      'T(venousLE.competency.inconclusive)',
    );
    expect(findings.value?.['compressibility.partial']).toBe('T(venousLE.compressibility.partial)');
    expect(findings.value?.['thrombosis.acute']).toBe('T(venousLE.thrombosis.acute)');
    expect(findings.value?.['phasicity.pulsatile']).toBe('T(venousLE.phasicity.pulsatile)');
  });
});
