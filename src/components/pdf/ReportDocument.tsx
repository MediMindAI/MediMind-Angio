/**
 * ReportDocument — the entry point for all PDF reports.
 *
 * Dispatches on `form.studyType` to the right layout. Phase 1 ships the
 * bilateral / left / right venous LE variants; other study types fall back
 * to a simpler template that still prints header + patient + narrative +
 * recommendations so the download button works even for in-progress
 * studies outside venous LE.
 *
 * IMPORTANT: @react-pdf/renderer does NOT share a React context tree with
 * the host app (it runs under its own reconciler). Translation must be
 * pre-resolved before ReportDocument mounts. The `labels` prop carries
 * every string the document needs, already translated by the caller.
 */
import type { ReactElement } from 'react';
import { Document, Page, View } from '@react-pdf/renderer';
import { baseStyles } from './styles';
import { PDF_LAYOUT } from './pdfTheme';
import { HeaderSection, PreliminaryWatermark } from './sections/HeaderSection';
import { PatientBlock } from './sections/PatientBlock';
import type { PatientBlockLabels } from './sections/PatientBlock';
import { DiagramSection } from './sections/DiagramSection';
import type { DiagramSectionLabels } from './sections/DiagramSection';
import { FindingsTable } from './sections/FindingsTable';
import type { FindingsTableLabels } from './sections/FindingsTable';
import { ArterialFindingsTable } from './sections/ArterialFindingsTable';
import type { ArterialFindingsTableLabels } from './sections/ArterialFindingsTable';
import { SegmentalPressureTable } from './sections/SegmentalPressureTable';
import type { SegmentalPressureTableLabels } from './sections/SegmentalPressureTable';
import { CarotidFindingsTable } from './sections/CarotidFindingsTable';
import type { CarotidFindingsTableLabels } from './sections/CarotidFindingsTable';
import { NASCETSummaryBlock } from './sections/NASCETSummaryBlock';
import type { NASCETSummaryLabels } from './sections/NASCETSummaryBlock';
import { NarrativeSection } from './sections/NarrativeSection';
import type { NarrativeSectionLabels } from './sections/NarrativeSection';
import { CEAPSection } from './sections/CEAPSection';
import type { CEAPSectionLabels } from './sections/CEAPSection';
import { RecommendationsSection } from './sections/RecommendationsSection';
import type { RecommendationsSectionLabels } from './sections/RecommendationsSection';
import { FooterSection } from './sections/FooterSection';
import type { AnatomyToPdfResult } from './anatomyToPdfSvg';
import type { FormState } from '../../types/form';
import { isVenousForm } from '../../types/form';
import type { VenousSegmentFindings, VenousLESegmentBase } from '../studies/venous-le/config';
import type {
  ArterialSegmentFindings,
  SegmentalPressures,
} from '../studies/arterial-le/config';
import type {
  CarotidFindings,
  CarotidNascetClassification,
} from '../studies/carotid/config';

// ---------------------------------------------------------------------------
// Label bundle — every user-facing string the PDF needs.
// ---------------------------------------------------------------------------

export interface ReportLabels {
  readonly title: string;
  readonly subtitle?: string;
  readonly issueDateLabel?: string;
  readonly preliminary: string;
  readonly patient: PatientBlockLabels;
  readonly diagram: DiagramSectionLabels;
  readonly findings: FindingsTableLabels;
  readonly arterialFindings: ArterialFindingsTableLabels;
  readonly pressures: SegmentalPressureTableLabels;
  readonly carotidFindings: CarotidFindingsTableLabels;
  readonly nascet: NASCETSummaryLabels;
  readonly narrative: NarrativeSectionLabels;
  readonly ceap: CEAPSectionLabels;
  readonly recommendations: RecommendationsSectionLabels;
  readonly footer: {
    readonly pageLabelTemplate: string;
  };
}

export interface ReportOrg {
  readonly name: string;
  readonly address?: string;
  readonly logoUrl?: string;
}

export interface ReportAnatomy {
  readonly anterior: AnatomyToPdfResult | null;
  readonly posterior: AnatomyToPdfResult | null;
}

export interface ReportDocumentProps {
  readonly form: FormState;
  readonly labels: ReportLabels;
  readonly org?: ReportOrg;
  readonly preliminary?: boolean;
  /** Pre-loaded anatomy SVG data, used on venous-le variants. */
  readonly anatomy?: ReportAnatomy;
  /** Optional pre-generated per-side prose blocks. */
  readonly rightFindings?: string;
  readonly leftFindings?: string;
  /** Optional bullet-list of conclusions (Impression mirror). */
  readonly conclusions?: ReadonlyArray<string>;
  /** ISO timestamp for footer + header. Defaults to form.header.studyDate. */
  readonly generatedAt?: string;
  // The smoke-test/legacy callers sometimes pass `data` — we accept it as an
  // opaque pass-through so the PDFGenerator's existing type doesn't break.
  readonly data?: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the venous findings from the form's segment array into the shape
 * `FindingsTable` expects. Phase 1 reads `refluxDurationMs`, `apDiameterMm`,
 * and `depthMm` from `SegmentState` but the on-screen form persists them on
 * `parameters` too; we read both just to be safe.
 *
 * IMPORTANT: the segment base comes from the full segment id (e.g.
 * "gsv-ak-left" → base "gsv-ak", side "left").
 */
function deriveVenousFindings(form: FormState): VenousSegmentFindings {
  if (!isVenousForm(form)) return {};

  // If the form UI stashed the full findings map on `parameters.segmentFindings`
  // (Phase 1+ behavior), use that directly — it already carries trans, AP, depth.
  const staged = form.parameters['segmentFindings'];
  if (staged && typeof staged === 'object') {
    return staged as unknown as VenousSegmentFindings;
  }

  const out: Partial<Record<`${VenousLESegmentBase}-left` | `${VenousLESegmentBase}-right`, {
    readonly refluxDurationMs?: number;
    readonly apDiameterMm?: number;
    readonly transDiameterMm?: number;
    readonly depthMm?: number;
  }>> = {};

  for (const seg of form.segments) {
    const side = seg.side;
    if (side !== 'left' && side !== 'right') continue;
    const segmentId = seg.segmentId;
    // segmentId in SegmentState is just the base; combine with side.
    const key = `${segmentId}-${side}` as `${VenousLESegmentBase}-${'left' | 'right'}`;
    const entry: {
      refluxDurationMs?: number;
      apDiameterMm?: number;
      transDiameterMm?: number;
      depthMm?: number;
    } = {};
    if (typeof seg.refluxDurationMs === 'number') entry.refluxDurationMs = seg.refluxDurationMs;
    if (typeof seg.diameterMm === 'number') entry.apDiameterMm = seg.diameterMm;
    // trans + depth live on `parameters` keyed by `<name>-<fullId>` in Phase 1 forms.
    const depthKey = `depth-${key}`;
    const depthVal = form.parameters[depthKey];
    if (typeof depthVal === 'number') entry.depthMm = depthVal;
    const transKey = `trans-${key}`;
    const transVal = form.parameters[transKey];
    if (typeof transVal === 'number') entry.transDiameterMm = transVal;
    if (Object.keys(entry).length > 0) out[key] = entry;
  }

  return out;
}

/** Arterial LE form stashes findings on `parameters.segmentFindings`. */
function deriveArterialFindings(form: FormState): ArterialSegmentFindings {
  if (form.studyType !== 'arterialLE') return {};
  const raw = form.parameters['segmentFindings'];
  if (!raw || typeof raw !== 'object') return {};
  return raw as unknown as ArterialSegmentFindings;
}

/** Arterial LE form stashes pressures on `parameters.pressures`. */
function deriveArterialPressures(form: FormState): SegmentalPressures {
  if (form.studyType !== 'arterialLE') return {};
  const raw = form.parameters['pressures'];
  if (!raw || typeof raw !== 'object') return {};
  return raw as unknown as SegmentalPressures;
}

/** Carotid form stashes findings on `parameters.segmentFindings`. */
function deriveCarotidFindings(form: FormState): CarotidFindings {
  if (form.studyType !== 'carotid') return {};
  const raw = form.parameters['segmentFindings'];
  if (!raw || typeof raw !== 'object') return {};
  return raw as unknown as CarotidFindings;
}

/** Carotid form stashes NASCET per side on `parameters.nascet`. */
function deriveCarotidNascet(form: FormState): CarotidNascetClassification {
  if (form.studyType !== 'carotid') return {};
  const raw = form.parameters['nascet'];
  if (!raw || typeof raw !== 'object') return {};
  return raw as unknown as CarotidNascetClassification;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toISOString().slice(0, 10);
}

function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  // YYYY-MM-DD HH:MM (local). Stable across timezones when ISO includes a Z.
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export function ReportDocument(props: ReportDocumentProps): ReactElement {
  const {
    form,
    labels,
    org,
    preliminary,
    anatomy,
    rightFindings,
    leftFindings,
    conclusions,
    generatedAt,
  } = props;

  const issueDate = formatDate(generatedAt ?? form.header.studyDate);
  const footerTimestamp = formatDateTime(generatedAt ?? new Date().toISOString());

  const findings = deriveVenousFindings(form);
  const isVenous = isVenousForm(form);
  const isArterial = form.studyType === 'arterialLE';
  const isCarotid = form.studyType === 'carotid';
  const arterialFindings = deriveArterialFindings(form);
  const arterialPressures = deriveArterialPressures(form);
  const carotidFindings = deriveCarotidFindings(form);
  const carotidNascet = deriveCarotidNascet(form);

  const pageWidth = `${PDF_LAYOUT.contentWidthPt}pt`;

  return (
    <Document
      title={labels.title}
      author={org?.name}
      subject={form.header.patientId ?? ''}
      language="ka"
    >
      {/* ------------- Page 1 — Header · Patient · Diagram · Findings ---------- */}
      <Page size="A4" style={baseStyles.page}>
        {preliminary ? <PreliminaryWatermark label={labels.preliminary} /> : null}

        <HeaderSection
          title={labels.title}
          subtitle={labels.subtitle ?? ''}
          issueDate={issueDate}
          orgName={org?.name ?? ''}
        />

        <PatientBlock header={form.header} labels={labels.patient} />

        {isVenous ? (
          <View>
            {/* Tables row — right + left side tables sit on the same horizontal
                line so column headers have ~half the page each (~240pt vs the
                old ~265pt shared between two stacked tables). */}
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
                  labels={labels.findings}
                  singleSide="right"
                />
              </View>
              <View style={{ width: '50%', paddingLeft: 3 }}>
                <FindingsTable
                  findings={findings}
                  labels={labels.findings}
                  singleSide="left"
                />
              </View>
            </View>
            {/* Diagram row — full width below the tables. */}
            <View style={{ width: pageWidth }}>
              <DiagramSection
                anterior={anatomy?.anterior ?? null}
                posterior={anatomy?.posterior ?? null}
                labels={labels.diagram}
                viewWidthPt={150}
              />
            </View>
          </View>
        ) : isArterial ? (
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
                  labels={labels.arterialFindings}
                  singleSide="right"
                />
              </View>
              <View style={{ width: '50%', paddingLeft: 3 }}>
                <ArterialFindingsTable
                  findings={arterialFindings}
                  labels={labels.arterialFindings}
                  singleSide="left"
                />
              </View>
            </View>
            <View style={{ width: pageWidth }}>
              <SegmentalPressureTable
                pressures={arterialPressures}
                labels={labels.pressures}
              />
            </View>
            <View style={{ width: pageWidth }}>
              <DiagramSection
                anterior={anatomy?.anterior ?? null}
                posterior={null}
                labels={labels.diagram}
                viewWidthPt={260}
              />
            </View>
          </View>
        ) : isCarotid ? (
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
                  labels={labels.carotidFindings}
                  singleSide="right"
                />
              </View>
              <View style={{ width: '50%', paddingLeft: 3 }}>
                <CarotidFindingsTable
                  findings={carotidFindings}
                  labels={labels.carotidFindings}
                  singleSide="left"
                />
              </View>
            </View>
            <View style={{ width: pageWidth }}>
              <NASCETSummaryBlock nascet={carotidNascet} labels={labels.nascet} />
            </View>
            <View style={{ width: pageWidth }}>
              <DiagramSection
                anterior={anatomy?.anterior ?? null}
                posterior={null}
                labels={labels.diagram}
                viewWidthPt={260}
              />
            </View>
          </View>
        ) : (
          <FindingsTable findings={findings} labels={labels.findings} />
        )}

        <FooterSection
          orgName={org?.name ?? ''}
          orgAddress={org?.address ?? ''}
          timestamp={footerTimestamp}
          pageLabelTemplate={labels.footer.pageLabelTemplate}
        />
      </Page>

      {/* ------------- Page 2 — Narrative · CEAP · Recommendations ------------- */}
      <Page size="A4" style={baseStyles.page}>
        {preliminary ? <PreliminaryWatermark label={labels.preliminary} /> : null}

        <HeaderSection
          title={labels.title}
          subtitle={labels.subtitle ?? ''}
          issueDate={issueDate}
          orgName={org?.name ?? ''}
        />

        <NarrativeSection
          narrative={form.narrative}
          labels={labels.narrative}
          rightFindings={rightFindings ?? ''}
          leftFindings={leftFindings ?? ''}
          conclusions={conclusions ?? []}
        />

        {form.ceap ? <CEAPSection ceap={form.ceap} labels={labels.ceap} /> : null}

        <RecommendationsSection
          recommendations={form.recommendations}
          labels={labels.recommendations}
        />

        <FooterSection
          orgName={org?.name ?? ''}
          orgAddress={org?.address ?? ''}
          timestamp={footerTimestamp}
          pageLabelTemplate={labels.footer.pageLabelTemplate}
        />
      </Page>
    </Document>
  );
}

export default ReportDocument;
