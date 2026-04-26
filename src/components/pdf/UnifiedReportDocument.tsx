// SPDX-License-Identifier: Apache-2.0
/**
 * UnifiedReportDocument — multi-study unified PDF (Phase 4.b).
 *
 * When a clinician runs ≥ 2 studies in one encounter (e.g. venous-LE
 * bilateral + arterial-LE + carotid in a single visit), this document
 * stitches them into a single PDF. Composition:
 *
 *   - Page 1: HeaderSection · PatientBlock (rendered ONCE for the whole
 *     document) · first study's findings/diagram block · FooterSection.
 *   - Pages 2..N: HeaderSection · per-study findings · FooterSection.
 *   - Final page: combined NarrativeSection (per study, stacked) · CEAPSection
 *     (only if a venous form is present and has CEAP) · merged
 *     RecommendationsSection (deduped by `recommendation.id`) · FooterSection.
 *
 * Single-study case continues to use the existing `<ReportDocument>` — this
 * file is only invoked when `selectedStudyTypes.length >= 2`.
 *
 * IMPORTANT: like `<ReportDocument>`, this component runs under the
 * `@react-pdf/renderer` reconciler — no host React context. Every label and
 * narrative must be pre-resolved by the caller and passed via
 * `perStudyAssets`.
 *
 * Page-numbering is handled natively by `<FooterSection>`'s
 * `render={({ pageNumber, totalPages })}` callback — we don't manage it here.
 */
import type { ReactElement, ReactNode } from 'react';
import { Document, Page, View } from '@react-pdf/renderer';
import { baseStyles } from './styles';
import { PDF_LAYOUT, PDF_PAGE_PRESETS, type PdfPageSize } from './pdfTheme';
import { HeaderSection, PreliminaryWatermark } from './sections/HeaderSection';
import { PatientBlock } from './sections/PatientBlock';
import { DiagramSection } from './sections/DiagramSection';
import { FindingsTable } from './sections/FindingsTable';
import { ArterialFindingsTable } from './sections/ArterialFindingsTable';
import { SegmentalPressureTable } from './sections/SegmentalPressureTable';
import { CarotidFindingsTable } from './sections/CarotidFindingsTable';
import { NASCETSummaryBlock } from './sections/NASCETSummaryBlock';
import { NarrativeSection } from './sections/NarrativeSection';
import { CEAPSection } from './sections/CEAPSection';
import { RecommendationsSection } from './sections/RecommendationsSection';
import { FooterSection } from './sections/FooterSection';
import type { AnatomyToPdfResult } from './anatomyToPdfSvg';
import type { ReportLabels } from './ReportDocument';
import { formatIsoForDisplay, nowIsoTimestamp } from '../../services/dateHelpers';
import type { FormState, Recommendation } from '../../types/form';
import { isVenousForm } from '../../types/form';
import {
  isVenousFindings,
  isArterialFindings,
  isArterialPressures,
  isCarotidFindings,
  isCarotidNascet,
} from '../../types/parameters';
import type { LocalizedNarrative } from '../../services/narrativeService';
import type { EncounterDraft } from '../../types/encounter';
import type { VenousSegmentFindings } from '../studies/venous-le/config';
import type {
  ArterialSegmentFindings,
  SegmentalPressures,
} from '../studies/arterial-le/config';
import type {
  CarotidFindings,
  CarotidNascetClassification,
} from '../studies/carotid/config';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Per-study assets consumed by `UnifiedReportDocument`. */
export interface UnifiedStudyAssets {
  readonly form: FormState;
  readonly labels: ReportLabels;
  readonly anatomy: {
    readonly anterior: AnatomyToPdfResult | null;
    readonly posterior: AnatomyToPdfResult | null;
  };
  /** Pre-resolved venous narrative blocks — only used by venous studies. */
  readonly localized?: LocalizedNarrative;
}

export interface UnifiedReportOrg {
  readonly name?: string;
  readonly address?: string;
}

export interface UnifiedReportDocumentProps {
  readonly encounter: EncounterDraft;
  /** One FormState per study, in the order they should appear in the PDF. */
  readonly studyForms: ReadonlyArray<FormState>;
  /** Per-study pre-resolved labels + narratives + diagrams (same length + order as `studyForms`). */
  readonly perStudyAssets: ReadonlyArray<UnifiedStudyAssets>;
  /** Org metadata (matches `<ReportDocument>`'s shape). */
  readonly org?: UnifiedReportOrg;
  readonly preliminary?: boolean;
  /** ISO timestamp for footer + header. Defaults to now. */
  readonly generatedAt?: string;
  readonly pageSize?: PdfPageSize;
  readonly lang?: 'en' | 'ka' | 'ru';
}

// ---------------------------------------------------------------------------
// Helpers — finding extractors mirror ReportDocument's logic, narrowed via
// the shared `is*` type guards from `types/parameters.ts` (Wave 2.5).
// ---------------------------------------------------------------------------

function extractVenousFindings(form: FormState): VenousSegmentFindings {
  if (!isVenousForm(form)) return {};
  const raw = form.parameters['segmentFindings'];
  return isVenousFindings(raw) ? raw : {};
}

function extractArterialFindings(form: FormState): ArterialSegmentFindings {
  if (form.studyType !== 'arterialLE') return {};
  const raw = form.parameters['segmentFindings'];
  return isArterialFindings(raw) ? raw : {};
}

function extractArterialPressures(form: FormState): SegmentalPressures {
  if (form.studyType !== 'arterialLE') return {};
  const raw = form.parameters['pressures'];
  return isArterialPressures(raw) ? raw : {};
}

function extractCarotidFindings(form: FormState): CarotidFindings {
  if (form.studyType !== 'carotid') return {};
  const raw = form.parameters['segmentFindings'];
  return isCarotidFindings(raw) ? raw : {};
}

function extractCarotidNascet(form: FormState): CarotidNascetClassification {
  if (form.studyType !== 'carotid') return {};
  const raw = form.parameters['nascet'];
  return isCarotidNascet(raw) ? raw : {};
}

/**
 * Render the findings block for one study (diagram + tables). Mirrors the
 * dispatch logic in `<ReportDocument>` but factored out so each study
 * occupies its own `<Page>` cleanly.
 */
function renderStudyFindings(
  form: FormState,
  assets: UnifiedStudyAssets,
  pageWidth: string,
): ReactNode {
  if (isVenousForm(form)) {
    const findings = extractVenousFindings(form);
    return (
      <View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            width: pageWidth,
            marginBottom: 4,
          }}
        >
          <View style={{ width: '50%', paddingRight: 3 }}>
            <FindingsTable
              findings={findings}
              labels={assets.labels.findings}
              singleSide="right"
            />
          </View>
          <View style={{ width: '50%', paddingLeft: 3 }}>
            <FindingsTable
              findings={findings}
              labels={assets.labels.findings}
              singleSide="left"
            />
          </View>
        </View>
        <View style={{ width: pageWidth }}>
          <DiagramSection
            anterior={assets.anatomy.anterior}
            posterior={assets.anatomy.posterior}
            labels={assets.labels.diagram}
            viewWidthPt={150}
          />
        </View>
      </View>
    );
  }

  if (form.studyType === 'arterialLE') {
    const arterialFindings = extractArterialFindings(form);
    const arterialPressures = extractArterialPressures(form);
    return (
      <View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            width: pageWidth,
            marginBottom: 4,
          }}
        >
          <View style={{ width: '50%', paddingRight: 3 }}>
            <ArterialFindingsTable
              findings={arterialFindings}
              labels={assets.labels.arterialFindings}
              singleSide="right"
            />
          </View>
          <View style={{ width: '50%', paddingLeft: 3 }}>
            <ArterialFindingsTable
              findings={arterialFindings}
              labels={assets.labels.arterialFindings}
              singleSide="left"
            />
          </View>
        </View>
        <View style={{ width: pageWidth }}>
          <SegmentalPressureTable
            pressures={arterialPressures}
            labels={assets.labels.pressures}
          />
        </View>
        <View style={{ width: pageWidth }}>
          <DiagramSection
            anterior={assets.anatomy.anterior}
            posterior={null}
            labels={assets.labels.diagram}
            viewWidthPt={260}
          />
        </View>
      </View>
    );
  }

  if (form.studyType === 'carotid') {
    const carotidFindings = extractCarotidFindings(form);
    const carotidNascet = extractCarotidNascet(form);
    return (
      <View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            width: pageWidth,
            marginBottom: 4,
          }}
        >
          <View style={{ width: '50%', paddingRight: 3 }}>
            <CarotidFindingsTable
              findings={carotidFindings}
              labels={assets.labels.carotidFindings}
              singleSide="right"
            />
          </View>
          <View style={{ width: '50%', paddingLeft: 3 }}>
            <CarotidFindingsTable
              findings={carotidFindings}
              labels={assets.labels.carotidFindings}
              singleSide="left"
            />
          </View>
        </View>
        <View style={{ width: pageWidth }}>
          <NASCETSummaryBlock nascet={carotidNascet} labels={assets.labels.nascet} />
        </View>
        <View style={{ width: pageWidth }}>
          <DiagramSection
            anterior={assets.anatomy.anterior}
            posterior={null}
            labels={assets.labels.diagram}
            viewWidthPt={260}
          />
        </View>
      </View>
    );
  }

  // IVC / future study types — no diagram or table yet, skip silently.
  return null;
}

/**
 * Merge per-study recommendations into a single deduped list. Dedup is by
 * `recommendation.id` (first-write-wins so the order of `studyForms` is
 * stable). Recommendations without an id are kept as-is — every entry
 * generated by the form code carries one.
 *
 * Exported so unit tests can pin the merge semantics independently of the
 * heavier PDF render path.
 */
export function mergeRecommendations(
  studyForms: ReadonlyArray<FormState>,
): ReadonlyArray<Recommendation> {
  const seen = new Set<string>();
  const merged: Recommendation[] = [];
  for (const form of studyForms) {
    for (const rec of form.recommendations) {
      const key = rec.id;
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      merged.push(rec);
    }
  }
  return merged;
}

/**
 * Pick the first venous form (if any) whose CEAP is set. We render a single
 * CEAP block on the final narrative page when one exists. Mixed-encounter
 * semantics are documented in the plan §4b risk notes — venous-only.
 */
function pickVenousCeap(
  studyForms: ReadonlyArray<FormState>,
  perStudyAssets: ReadonlyArray<UnifiedStudyAssets>,
): { readonly form: FormState; readonly assets: UnifiedStudyAssets } | null {
  for (let i = 0; i < studyForms.length; i += 1) {
    const f = studyForms[i];
    if (f && isVenousForm(f) && f.ceap) {
      const a = perStudyAssets[i];
      if (a) return { form: f, assets: a };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export function UnifiedReportDocument(
  props: UnifiedReportDocumentProps,
): ReactElement {
  const {
    encounter,
    studyForms,
    perStudyAssets,
    org,
    preliminary,
    generatedAt,
    pageSize = 'A4',
    lang = 'en',
  } = props;

  // Defensive: caller is responsible for passing matching arrays. If they
  // don't, fall back to whichever is shorter — never crash mid-render.
  const studyCount = Math.min(studyForms.length, perStudyAssets.length);
  const firstForm = studyForms[0];
  const firstAssets = perStudyAssets[0];

  const pagePreset = PDF_PAGE_PRESETS[pageSize];
  const pageWidth = `${pagePreset?.contentWidthPt ?? PDF_LAYOUT.contentWidthPt}pt`;

  const issueDate = formatIsoForDisplay(
    generatedAt ?? encounter.header.encounterDate,
  );
  const footerTimestamp = formatIsoForDisplay(generatedAt ?? nowIsoTimestamp(), {
    includeTime: true,
  });

  const documentTitle = firstAssets?.labels.title ?? 'Vascular Ultrasound Report';

  const venousCeapPick = pickVenousCeap(studyForms, perStudyAssets);
  const mergedRecommendations = mergeRecommendations(studyForms);
  // Recommendation labels — every study's bundle carries the same
  // `recommendations` sub-bundle, so picking the first-form's labels is
  // safe and consistent with the way translations resolve.
  const recommendationsLabels = firstAssets?.labels.recommendations;

  return (
    <Document
      title={documentTitle}
      author={org?.name}
      // Use the report title (already translated, non-PHI) as `subject` —
      // mirrors the PHI-leak fix in `<ReportDocument>` (Wave 4.3 Part 04).
      subject={documentTitle}
      language={lang}
    >
      {/* ------------- Page 1 — Header · Patient · First study's findings ------ */}
      {firstForm && firstAssets ? (
        <Page size={pageSize} style={baseStyles.page}>
          {preliminary ? (
            <PreliminaryWatermark label={firstAssets.labels.preliminary} />
          ) : null}

          <HeaderSection
            title={firstAssets.labels.title}
            subtitle={firstAssets.labels.subtitle ?? ''}
            issueDate={issueDate}
            issuedLabel={firstAssets.labels.issueDateLabel}
            orgName={org?.name ?? ''}
          />

          {/* PatientBlock — rendered ONCE for the entire document. The shared
              encounter header is reflected via the first form's StudyHeader
              (the per-study refactor in Phase 3 keeps patient identity in
              sync with EncounterHeader via the form's `header` projection). */}
          <PatientBlock
            header={firstForm.header}
            labels={firstAssets.labels.patient}
          />

          {renderStudyFindings(firstForm, firstAssets, pageWidth)}

          <FooterSection
            orgName={org?.name ?? ''}
            orgAddress={org?.address ?? ''}
            timestamp={footerTimestamp}
            pageLabelTemplate={firstAssets.labels.footer.pageLabelTemplate}
          />
        </Page>
      ) : null}

      {/* ------------- Pages 2..N — One Page per remaining study --------------- */}
      {Array.from({ length: Math.max(0, studyCount - 1) }, (_, i) => {
        const idx = i + 1;
        const form = studyForms[idx];
        const assets = perStudyAssets[idx];
        if (!form || !assets) return null;
        return (
          <Page
            key={`study-${form.studyType}-${idx}`}
            size={pageSize}
            style={baseStyles.page}
          >
            {preliminary ? (
              <PreliminaryWatermark label={assets.labels.preliminary} />
            ) : null}

            <HeaderSection
              title={assets.labels.title}
              subtitle={assets.labels.subtitle ?? ''}
              issueDate={issueDate}
              issuedLabel={assets.labels.issueDateLabel}
              orgName={org?.name ?? ''}
            />

            {renderStudyFindings(form, assets, pageWidth)}

            <FooterSection
              orgName={org?.name ?? ''}
              orgAddress={org?.address ?? ''}
              timestamp={footerTimestamp}
              pageLabelTemplate={assets.labels.footer.pageLabelTemplate}
            />
          </Page>
        );
      })}

      {/* ------------- Final page — Combined narrative · CEAP · Recs ----------- */}
      {firstAssets ? (
        <Page size={pageSize} style={baseStyles.page}>
          {preliminary ? (
            <PreliminaryWatermark label={firstAssets.labels.preliminary} />
          ) : null}

          <HeaderSection
            title={firstAssets.labels.title}
            subtitle={firstAssets.labels.subtitle ?? ''}
            issueDate={issueDate}
            issuedLabel={firstAssets.labels.issueDateLabel}
            orgName={org?.name ?? ''}
          />

          {Array.from({ length: studyCount }, (_, i) => {
            const form = studyForms[i];
            const assets = perStudyAssets[i];
            if (!form || !assets) return null;
            return (
              <NarrativeSection
                key={`narr-${form.studyType}-${i}`}
                narrative={form.narrative}
                labels={assets.labels.narrative}
                rightFindings={assets.localized?.rightFindings ?? ''}
                leftFindings={assets.localized?.leftFindings ?? ''}
                conclusions={assets.localized?.conclusions ?? []}
              />
            );
          })}

          {venousCeapPick && venousCeapPick.form.ceap ? (
            <CEAPSection
              ceap={venousCeapPick.form.ceap}
              labels={venousCeapPick.assets.labels.ceap}
            />
          ) : null}

          {recommendationsLabels ? (
            <RecommendationsSection
              recommendations={mergedRecommendations}
              labels={recommendationsLabels}
            />
          ) : null}

          <FooterSection
            orgName={org?.name ?? ''}
            orgAddress={org?.address ?? ''}
            timestamp={footerTimestamp}
            pageLabelTemplate={firstAssets.labels.footer.pageLabelTemplate}
          />
        </Page>
      ) : null}
    </Document>
  );
}

export default UnifiedReportDocument;
