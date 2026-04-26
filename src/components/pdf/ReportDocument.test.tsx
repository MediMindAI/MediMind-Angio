// SPDX-License-Identifier: Apache-2.0
/**
 * Wave 4.3 — guards on ReportDocument's accessibility / page-size /
 * subject props (Part 04 MEDIUM ×3).
 *
 * The full @react-pdf/renderer pipeline is heavy (registers fonts, runs
 * its own reconciler) and we don't want to boot it in unit tests, so we
 * inspect the React element tree returned by `<ReportDocument>` directly
 * — the outer `<Document>` and the two `<Page>` children carry the props
 * we care about.
 */

import { describe, expect, it } from 'vitest';
import type { ReactElement } from 'react';
import { ReportDocument } from './ReportDocument';
import type { ReportLabels } from './ReportDocument';
import type { FormState } from '../../types/form';

// Empty label bundle — only `title` matters for the prop-flow tests, so
// everything else is "" / [] / {} to satisfy the type.
const EMPTY_LABELS: ReportLabels = {
  title: 'Vascular Ultrasound Report',
  subtitle: '',
  preliminary: '',
  patient: {} as ReportLabels['patient'],
  diagram: {} as ReportLabels['diagram'],
  findings: {} as ReportLabels['findings'],
  arterialFindings: {} as ReportLabels['arterialFindings'],
  pressures: {} as ReportLabels['pressures'],
  carotidFindings: {} as ReportLabels['carotidFindings'],
  nascet: {} as ReportLabels['nascet'],
  narrative: {} as ReportLabels['narrative'],
  ceap: {} as ReportLabels['ceap'],
  recommendations: {} as ReportLabels['recommendations'],
  footer: { pageLabelTemplate: '' },
};

const MOCK_FORM: FormState = {
  studyType: 'venousLEBilateral',
  header: {
    patientName: 'Test',
    patientId: 'MRN-12345',
    patientBirthDate: '1980-01-01',
    patientGender: 'female',
    studyDate: '2026-04-25',
    operatorName: '',
    referringPhysician: '',
    institution: '',
    accessionNumber: '',
  },
  segments: [],
  parameters: {},
  recommendations: [],
  narrative: { right: '', left: '' },
} as unknown as FormState;

interface DocumentLikeProps {
  readonly title?: unknown;
  readonly author?: unknown;
  readonly subject?: unknown;
  readonly language?: unknown;
  readonly children?: unknown;
}

function getDocumentProps(
  el: ReactElement<DocumentLikeProps>,
): DocumentLikeProps {
  return el.props;
}

function getPageProps(el: ReactElement<DocumentLikeProps>): Array<{ size?: unknown }> {
  // The outer Document's children are the two <Page> elements.
  const kids = el.props.children;
  const arr = Array.isArray(kids) ? kids : [kids];
  return arr
    .filter((k): k is ReactElement<{ size?: unknown }> => Boolean(k) && typeof k === 'object')
    .map((k) => k.props);
}

describe('ReportDocument — accessibility & page-size props (Wave 4.3)', () => {
  it('defaults `language` to "en", not "ka"', () => {
    const el = ReportDocument({ form: MOCK_FORM, labels: EMPTY_LABELS }) as ReactElement<DocumentLikeProps>;
    expect(getDocumentProps(el).language).toBe('en');
  });

  it('honors explicit `lang="ru"` prop', () => {
    const el = ReportDocument({
      form: MOCK_FORM,
      labels: EMPTY_LABELS,
      lang: 'ru',
    }) as ReactElement<DocumentLikeProps>;
    expect(getDocumentProps(el).language).toBe('ru');
  });

  it('honors explicit `lang="ka"` prop', () => {
    const el = ReportDocument({
      form: MOCK_FORM,
      labels: EMPTY_LABELS,
      lang: 'ka',
    }) as ReactElement<DocumentLikeProps>;
    expect(getDocumentProps(el).language).toBe('ka');
  });

  it('uses `labels.title` as `subject`, NOT the patient MRN (PHI leak fix)', () => {
    const el = ReportDocument({ form: MOCK_FORM, labels: EMPTY_LABELS }) as ReactElement<DocumentLikeProps>;
    const props = getDocumentProps(el);
    expect(props.subject).toBe('Vascular Ultrasound Report');
    expect(props.subject).not.toBe('MRN-12345');
    expect(props.subject).not.toContain('MRN');
  });

  it('defaults `pageSize` to A4 on every page', () => {
    const el = ReportDocument({ form: MOCK_FORM, labels: EMPTY_LABELS }) as ReactElement<DocumentLikeProps>;
    const pages = getPageProps(el);
    expect(pages.length).toBeGreaterThanOrEqual(2);
    for (const p of pages) {
      expect(p.size).toBe('A4');
    }
  });

  it('honors `pageSize="Letter"` on every page', () => {
    const el = ReportDocument({
      form: MOCK_FORM,
      labels: EMPTY_LABELS,
      pageSize: 'Letter',
    }) as ReactElement<DocumentLikeProps>;
    const pages = getPageProps(el);
    expect(pages.length).toBeGreaterThanOrEqual(2);
    for (const p of pages) {
      expect(p.size).toBe('Letter');
    }
  });
});
