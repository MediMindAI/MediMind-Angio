// SPDX-License-Identifier: Apache-2.0
/**
 * Phase 4.b — UnifiedReportDocument tests.
 *
 * Same approach as `ReportDocument.test.tsx`: inspect the React element tree
 * the component returns rather than booting `@react-pdf/renderer`'s full
 * pipeline. Lets us assert page composition, prop flow, and section
 * placement without spinning up the heavy reconciler in unit tests.
 *
 * Asserts (anti-regression for the audit's "PatientBlock rendered twice"
 * finding plus the multi-study composition contract):
 *   1. With 2 studies, exactly ONE `<PatientBlock>` is rendered (page 1 only).
 *   2. With 3 studies, three distinct findings tables are present (one per
 *      study type — Venous LE FindingsTable, Arterial LE
 *      ArterialFindingsTable, Carotid CarotidFindingsTable).
 *   3. CEAPSection appears iff a venous form with `ceap` is present.
 *   4. `pageSize="LETTER"` propagates to every `<Page>`.
 *   5. `lang="ru"` propagates to `<Document language>`.
 *   6. Recommendations are deduped by id across studies.
 */

import { describe, expect, it } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import {
  UnifiedReportDocument,
  mergeRecommendations,
} from './UnifiedReportDocument';
import type { UnifiedStudyAssets } from './UnifiedReportDocument';
import type { ReportLabels } from './ReportDocument';
import type { FormState } from '../../types/form';
import type { EncounterDraft } from '../../types/encounter';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

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
  recommendations: {
    heading: 'Recommendations',
    priority: { routine: 'Routine', urgent: 'Urgent', stat: 'Stat' },
    followUpPrefix: 'Follow-up:',
  },
  footer: { pageLabelTemplate: 'Page {current} / {total}' },
};

function makeForm(
  studyType: FormState['studyType'],
  overrides: Partial<FormState> = {},
): FormState {
  return {
    studyType,
    header: {
      patientName: 'Test Patient',
      patientId: 'MRN-99999',
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
    ...overrides,
  } as unknown as FormState;
}

function makeAssets(form: FormState): UnifiedStudyAssets {
  return {
    form,
    labels: EMPTY_LABELS,
    anatomy: { anterior: null, posterior: null },
  };
}

const MOCK_ENCOUNTER: EncounterDraft = {
  schemaVersion: 2,
  encounterId: 'enc-test-1',
  header: {
    patientName: 'Test Patient',
    patientId: 'MRN-99999',
    patientBirthDate: '1980-01-01',
    patientGender: 'female',
    encounterDate: '2026-04-25',
  },
  selectedStudyTypes: ['venousLEBilateral', 'arterialLE'],
  studies: {},
  createdAt: '2026-04-25T10:00:00.000Z',
  updatedAt: '2026-04-25T10:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Tree-walk helpers — `el.props.children` traversal, no JSX runtime.
// ---------------------------------------------------------------------------

interface DocumentLikeProps {
  readonly title?: unknown;
  readonly author?: unknown;
  readonly subject?: unknown;
  readonly language?: unknown;
  readonly children?: ReactNode;
}

function getDocumentProps(
  el: ReactElement<DocumentLikeProps>,
): DocumentLikeProps {
  return el.props;
}

function isElement(node: unknown): node is ReactElement<{ children?: ReactNode }> {
  return Boolean(node) && typeof node === 'object' && 'props' in (node as object);
}

/**
 * Walk the entire React element tree from `root` and yield every element
 * whose `type.name` matches `componentName`. Component-name matching mirrors
 * how `@react-pdf/renderer` identifies elements internally.
 *
 * Note: `@react-pdf/renderer`'s primitives (`Page`, `Document`, `View`,
 * `Text`, ...) are exported as UPPERCASE STRINGS, not React components.
 * Function components (PatientBlock, FindingsTable, ...) match by their
 * `.name`/`.displayName`. We accept either form via case-insensitive
 * comparison so callers can pass `'Page'` or `'PatientBlock'` uniformly.
 */
function findAllByName(
  root: ReactNode,
  componentName: string,
): ReactElement[] {
  const target = componentName.toLowerCase();
  const out: ReactElement[] = [];
  const stack: ReactNode[] = Array.isArray(root) ? [...root] : [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === null || node === undefined || node === false) continue;
    if (Array.isArray(node)) {
      stack.push(...node);
      continue;
    }
    if (!isElement(node)) continue;
    const type = node.type as unknown;
    let name: string | undefined;
    if (typeof type === 'function') {
      name = (type as { name?: string; displayName?: string }).displayName
        ?? (type as { name?: string }).name;
    } else if (typeof type === 'string') {
      name = type;
    }
    if (name && name.toLowerCase() === target) {
      out.push(node);
    }
    const kids = (node.props as { children?: ReactNode } | undefined)?.children;
    if (kids !== undefined) {
      stack.push(kids);
    }
  }
  return out;
}

function getPages(el: ReactElement<DocumentLikeProps>): ReactElement[] {
  // `@react-pdf/renderer` exports `Page` as the string `'PAGE'`, so match
  // case-insensitively (findAllByName lower-cases both sides).
  return findAllByName(el.props.children, 'PAGE');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UnifiedReportDocument — composition (Phase 4.b)', () => {
  it('renders <PatientBlock> exactly ONCE for a 2-study document', () => {
    const venous = makeForm('venousLEBilateral');
    const arterial = makeForm('arterialLE');
    const el = UnifiedReportDocument({
      encounter: MOCK_ENCOUNTER,
      studyForms: [venous, arterial],
      perStudyAssets: [makeAssets(venous), makeAssets(arterial)],
    }) as ReactElement<DocumentLikeProps>;

    const patientBlocks = findAllByName(el, 'PatientBlock');
    expect(patientBlocks).toHaveLength(1);
  });

  it('renders one Page per study + cover + final-narrative — total 1 + (N-1) + 1', () => {
    const venous = makeForm('venousLEBilateral');
    const arterial = makeForm('arterialLE');
    const carotid = makeForm('carotid');
    const el = UnifiedReportDocument({
      encounter: MOCK_ENCOUNTER,
      studyForms: [venous, arterial, carotid],
      perStudyAssets: [makeAssets(venous), makeAssets(arterial), makeAssets(carotid)],
    }) as ReactElement<DocumentLikeProps>;

    const pages = getPages(el);
    // 1 cover (study 1) + 2 follow-up study pages (study 2, 3) + 1 narrative page = 4
    expect(pages.length).toBe(4);
  });

  it('renders three distinct findings tables for a 3-study document', () => {
    const venous = makeForm('venousLEBilateral');
    const arterial = makeForm('arterialLE');
    const carotid = makeForm('carotid');
    const el = UnifiedReportDocument({
      encounter: MOCK_ENCOUNTER,
      studyForms: [venous, arterial, carotid],
      perStudyAssets: [makeAssets(venous), makeAssets(arterial), makeAssets(carotid)],
    }) as ReactElement<DocumentLikeProps>;

    // Venous → FindingsTable (renders once per side, so 2 instances)
    expect(findAllByName(el, 'FindingsTable').length).toBeGreaterThanOrEqual(1);
    // Arterial → ArterialFindingsTable
    expect(findAllByName(el, 'ArterialFindingsTable').length).toBeGreaterThanOrEqual(1);
    // Carotid → CarotidFindingsTable
    expect(findAllByName(el, 'CarotidFindingsTable').length).toBeGreaterThanOrEqual(1);
  });

  it('renders CEAPSection ONLY when a venous form with ceap is present', () => {
    const arterial = makeForm('arterialLE');
    const carotid = makeForm('carotid');
    const noCeapEl = UnifiedReportDocument({
      encounter: MOCK_ENCOUNTER,
      studyForms: [arterial, carotid],
      perStudyAssets: [makeAssets(arterial), makeAssets(carotid)],
    }) as ReactElement<DocumentLikeProps>;
    expect(findAllByName(noCeapEl, 'CEAPSection')).toHaveLength(0);

    const venousWithCeap = makeForm('venousLEBilateral', {
      // Minimal CEAP shape — UnifiedReportDocument only checks truthy.
      ceap: { c: 'C0', e: 'En', a: 'An', p: 'Pn' },
    } as unknown as Partial<FormState>);
    const ceapEl = UnifiedReportDocument({
      encounter: MOCK_ENCOUNTER,
      studyForms: [venousWithCeap, arterial],
      perStudyAssets: [makeAssets(venousWithCeap), makeAssets(arterial)],
    }) as ReactElement<DocumentLikeProps>;
    expect(findAllByName(ceapEl, 'CEAPSection')).toHaveLength(1);
  });

  it('does NOT render CEAPSection when only a venous form WITHOUT ceap is present', () => {
    const venousNoCeap = makeForm('venousLEBilateral');
    const el = UnifiedReportDocument({
      encounter: MOCK_ENCOUNTER,
      studyForms: [venousNoCeap, makeForm('arterialLE')],
      perStudyAssets: [makeAssets(venousNoCeap), makeAssets(makeForm('arterialLE'))],
    }) as ReactElement<DocumentLikeProps>;
    expect(findAllByName(el, 'CEAPSection')).toHaveLength(0);
  });

  it('propagates `pageSize="LETTER"` to every <Page>', () => {
    const venous = makeForm('venousLEBilateral');
    const arterial = makeForm('arterialLE');
    const el = UnifiedReportDocument({
      encounter: MOCK_ENCOUNTER,
      studyForms: [venous, arterial],
      perStudyAssets: [makeAssets(venous), makeAssets(arterial)],
      pageSize: 'LETTER',
    }) as ReactElement<DocumentLikeProps>;

    const pages = getPages(el);
    expect(pages.length).toBeGreaterThanOrEqual(2);
    for (const p of pages) {
      expect((p.props as { size?: unknown }).size).toBe('LETTER');
    }
  });

  it('defaults `pageSize` to A4 on every <Page>', () => {
    const venous = makeForm('venousLEBilateral');
    const arterial = makeForm('arterialLE');
    const el = UnifiedReportDocument({
      encounter: MOCK_ENCOUNTER,
      studyForms: [venous, arterial],
      perStudyAssets: [makeAssets(venous), makeAssets(arterial)],
    }) as ReactElement<DocumentLikeProps>;

    const pages = getPages(el);
    for (const p of pages) {
      expect((p.props as { size?: unknown }).size).toBe('A4');
    }
  });

  it('propagates `lang="ru"` to <Document language>', () => {
    const venous = makeForm('venousLEBilateral');
    const el = UnifiedReportDocument({
      encounter: MOCK_ENCOUNTER,
      studyForms: [venous],
      perStudyAssets: [makeAssets(venous)],
      lang: 'ru',
    }) as ReactElement<DocumentLikeProps>;

    expect(getDocumentProps(el).language).toBe('ru');
  });

  it('defaults <Document language> to "en"', () => {
    const venous = makeForm('venousLEBilateral');
    const el = UnifiedReportDocument({
      encounter: MOCK_ENCOUNTER,
      studyForms: [venous],
      perStudyAssets: [makeAssets(venous)],
    }) as ReactElement<DocumentLikeProps>;

    expect(getDocumentProps(el).language).toBe('en');
  });

  it('uses `labels.title` as `subject`, NOT the patient MRN (PHI leak guard)', () => {
    const venous = makeForm('venousLEBilateral');
    const el = UnifiedReportDocument({
      encounter: MOCK_ENCOUNTER,
      studyForms: [venous],
      perStudyAssets: [makeAssets(venous)],
    }) as ReactElement<DocumentLikeProps>;

    const props = getDocumentProps(el);
    expect(props.subject).toBe('Vascular Ultrasound Report');
    expect(props.subject).not.toContain('MRN');
  });
});

// ---------------------------------------------------------------------------
// Helper-level tests — keep merge semantics pinned without rendering PDFs.
// ---------------------------------------------------------------------------

describe('mergeRecommendations — dedup by id (Phase 4.b)', () => {
  it('returns recommendations from a single study verbatim', () => {
    const form = makeForm('venousLEBilateral', {
      recommendations: [
        { id: 'rec-elev', text: 'Elevate legs' },
        { id: 'rec-stockings', text: 'Wear compression stockings' },
      ],
    } as unknown as Partial<FormState>);
    const out = mergeRecommendations([form]);
    expect(out.map((r) => r.id)).toEqual(['rec-elev', 'rec-stockings']);
  });

  it('dedupes recommendations sharing an id across studies (first-write-wins)', () => {
    const venous = makeForm('venousLEBilateral', {
      recommendations: [
        { id: 'rec-aspirin', text: 'Daily aspirin (venous)' },
        { id: 'rec-elev', text: 'Elevate legs' },
      ],
    } as unknown as Partial<FormState>);
    const arterial = makeForm('arterialLE', {
      recommendations: [
        { id: 'rec-aspirin', text: 'Daily aspirin (arterial)' }, // dup id
        { id: 'rec-walk', text: 'Walking program' },
      ],
    } as unknown as Partial<FormState>);

    const out = mergeRecommendations([venous, arterial]);
    expect(out).toHaveLength(3);
    expect(out.map((r) => r.id)).toEqual(['rec-aspirin', 'rec-elev', 'rec-walk']);
    // First-write-wins: the venous text is preserved when ids collide.
    expect(out[0]?.text).toBe('Daily aspirin (venous)');
  });

  it('keeps recommendations without ids untouched (no false dedup)', () => {
    const venous = makeForm('venousLEBilateral', {
      recommendations: [
        { id: '', text: 'Anonymous rec A' },
        { id: '', text: 'Anonymous rec B' },
      ],
    } as unknown as Partial<FormState>);
    const out = mergeRecommendations([venous]);
    expect(out).toHaveLength(2);
  });

  it('returns empty list for studies with no recommendations', () => {
    const venous = makeForm('venousLEBilateral');
    const arterial = makeForm('arterialLE');
    expect(mergeRecommendations([venous, arterial])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Localized narrative wiring — make sure per-study narrative blocks read
// from `assets.localized` and don't cross-contaminate.
// ---------------------------------------------------------------------------

describe('UnifiedReportDocument — narrative wiring (Phase 4.b)', () => {
  it('renders one NarrativeSection per study on the final page', () => {
    const venous = makeForm('venousLEBilateral');
    const arterial = makeForm('arterialLE');
    const el = UnifiedReportDocument({
      encounter: MOCK_ENCOUNTER,
      studyForms: [venous, arterial],
      perStudyAssets: [makeAssets(venous), makeAssets(arterial)],
    }) as ReactElement<DocumentLikeProps>;

    expect(findAllByName(el, 'NarrativeSection')).toHaveLength(2);
  });
});
