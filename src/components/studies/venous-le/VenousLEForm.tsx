// SPDX-License-Identifier: Apache-2.0
/**
 * VenousLEForm — Phase 1 orchestrator for the bilateral lower-extremity
 * venous duplex report.
 *
 * Layout (desktop):
 *
 *   ┌───────────── EncounterContextBanner (Phase 3c) ──────────────────┐
 *   │  Patient · age · encounter date | study chips | + Add | Edit     │
 *   ├──────────────────┬────────────────────────────────────────────────┤
 *   │  AnatomyView L/R │  SegmentTable (tabs: Right | Left | Bilateral) │
 *   │  (live recolor)  │  20 rows × 5 categorical columns               │
 *   ├──────────────────┴────────────────────────────────────────────────┤
 *   │  ImpressionBlock — auto-generated + editable                      │
 *   ├───────────────────────────────────────────────────────────────────┤
 *   │  CommentsBlock                                                    │
 *   ├───────────────────────────────────────────────────────────────────┤
 *   │  CEAPPicker (collapsed)                                           │
 *   ├───────────────────────────────────────────────────────────────────┤
 *   │  RecommendationsBlock                                             │
 *   ├───────────────────────────────────────────────────────────────────┤
 *   │ FormActions — sticky footer                                       │
 *   └───────────────────────────────────────────────────────────────────┘
 *
 * State lives in a single useReducer keyed off `FormState`. Patient identity
 * and visit context now live in the encounter (Phase 3b — the `<StudyHeader>`
 * was dropped); per-study clinical fields (studyDate / studyTime / accession
 * / cptCode / patientPosition / quality / protocol) stay in the local
 * reducer. `stateToFormState` projects encounter header + per-study fields
 * into the legacy `FormState.header` shape so downstream FHIR + PDF builders
 * keep working unchanged until Phase 4a refactors them to take an
 * `EncounterDraft` directly.
 *
 * Persistence (Phase 3b):
 *   The reducer state is mirrored into `encounter.studies.venousLEBilateral`
 *   on every change via `useEncounter().setStudyState()`. The encounter
 *   store dual-writes to localStorage + IndexedDB, so reload survives. We
 *   keep a small "lastSavedAt / hasUnsavedChanges" pair locally so the
 *   sticky `<FormActions>` footer's saved-indicator UI keeps working —
 *   but the source of truth is the encounter, not a per-study draft slot.
 *   A legacy fallback path still reads pre-encounter `loadDraft(STUDY_ID)`
 *   on first mount so existing single-study drafts hydrate cleanly.
 */

import { memo, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Box, Grid, Group, Stack, Text } from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconPlus } from '@tabler/icons-react';
import { useTranslation } from '../../../contexts/TranslationContext';
import { useEncounter } from '../../../contexts/EncounterContext';
import { AnatomyLegend } from '../../anatomy';
import { AnatomyDiagramSection } from '../../anatomy/AnatomyDiagramSection';
import { migrateLegacyDrawingColor, type DrawingStroke } from '../../../types/drawing';
import type { Competency, SegmentId } from '../../../types/anatomy';
import type { CeapClassification } from '../../../types/ceap';
import type {
  CptCode,
  FormState,
  Recommendation,
  StudyHeader as StudyHeaderShape,
} from '../../../types/form';
import type { EncounterDraft } from '../../../types/encounter';
import type { PatientPosition } from '../../../types/patient-position';
import { loadDraft } from '../../../hooks/useAutoSave';
import { ConfirmDialog } from '../../common';
import { BackToStudiesButton } from '../../layout/BackToStudiesButton';
import { EncounterContextBanner } from '../../layout/EncounterContextBanner';
import { SegmentAssessmentCard } from '../../form/SegmentAssessmentCard';
import { type SegmentTableView } from '../../form/SegmentTable';
import { ImpressionBlock } from '../../form/ImpressionBlock';
import { CEAPPicker } from '../../form/CEAPPicker';
import { RecommendationsBlock } from '../../form/RecommendationsBlock';
import { FormActions } from '../../form/FormActions';
import { defaultCptForStudy, cptDisplay } from '../../../constants/vascular-cpt';
import {
  VENOUS_LE_SEGMENTS,
  deriveCompetency,
  type VenousLEFullSegmentId,
  type VenousLESegmentBase,
  type VenousSegmentFinding,
  type VenousSegmentFindings,
} from './config';
import type { VenousLETemplate } from './templates';
import {
  loadCustomTemplates,
  loadRecentTemplateIds,
  pushRecentTemplate,
  saveCustomTemplate,
  deleteCustomTemplate,
  type CustomTemplate,
} from '../../../services/customTemplatesService';
import {
  SaveTemplateDialog,
  type SaveTemplatePayload,
} from '../../form/SaveTemplateDialog';
import classes from './VenousLEForm.module.css';

// ============================================================================
// Form state shape — superset of the shared FormState with Phase-1 extras
// ============================================================================

type StudyQuality = 'excellent' | 'good' | 'suboptimal' | 'limited';
type StudyProtocol = 'standard' | 'dvt' | 'reflux' | 'preop';

/**
 * Phase 3b — encounter pivot. The header is gone; encounter-level fields
 * (patient identity, operator, referring physician, institution, ICD-10s,
 * indicationNotes, consent, medications) live on the encounter via
 * `useEncounter()`. Per-study clinical fields stay top-level here.
 */
interface VenousFormStateV1 {
  /**
   * Wave 3.2 (Part 03 MEDIUM) — runtime schema version. The interface name
   * carries `V1`, but without a runtime field a release that bumps the
   * state shape (rename, add required field, change findings shape) would
   * silently hydrate yesterday's draft as the new shape and either crash
   * or render wrong data. `loadDraft` initializers must validate this.
   */
  readonly schemaVersion: 1;
  readonly studyType: 'venousLEBilateral';
  // Per-study clinical fields (Phase 3b — were nested under `header`).
  readonly studyDate: string;
  readonly studyTime?: string;
  readonly accessionNumber?: string;
  readonly cptCode?: CptCode;
  readonly patientPosition?: PatientPosition;
  readonly quality?: StudyQuality;
  readonly protocol?: StudyProtocol;
  // Per-study clinical state.
  readonly findings: VenousSegmentFindings;
  /** Current segment table tab. */
  readonly view: SegmentTableView;
  /** Auto-generated vs. user-edited impression. */
  readonly impression: string;
  /** Has the user modified the impression manually? */
  readonly impressionEdited: boolean;
  readonly ceap: CeapClassification | undefined;
  readonly recommendations: ReadonlyArray<Recommendation>;
  /** Sonographer comments (distinct from clinician impression). */
  readonly sonographerComments: string;
  /** Clinician interpretive comments. */
  readonly clinicianComments: string;
  /** Hand-drawn marks layered over the anatomy diagrams. */
  readonly drawings: ReadonlyArray<DrawingStroke>;
}

const STUDY_ID = 'venousLEBilateral';
const TODAY_ISO = new Date().toISOString().slice(0, 10);

const DEFAULT_CPT = defaultCptForStudy('venousLEBilateral');

const INITIAL_STATE: VenousFormStateV1 = {
  schemaVersion: 1,
  studyType: 'venousLEBilateral',
  studyDate: TODAY_ISO,
  protocol: 'standard',
  // Default CPT matches the study type; user can override (post Phase 5
  // when per-study clinical fields get UI again).
  cptCode: { code: DEFAULT_CPT.code, display: cptDisplay(DEFAULT_CPT, 'en') },
  findings: {},
  view: 'right',
  impression: '',
  impressionEdited: false,
  ceap: undefined,
  recommendations: [],
  sonographerComments: '',
  clinicianComments: '',
  drawings: [],
};

// ============================================================================
// Reducer
// ============================================================================

/**
 * Phase 3b — single discriminated `SET_STUDY_FIELD` action covers all
 * per-study clinical scalar fields. The `field` discriminator pairs with a
 * matching `value` payload so TS catches typos at the dispatch site. We
 * picked the unified shape over six tiny `SET_*` variants because the
 * fields are all "scalar field on the local reducer" — same handling, no
 * per-field side effects.
 */
type StudyField =
  | { field: 'studyDate'; value: string }
  | { field: 'studyTime'; value: string | undefined }
  | { field: 'accessionNumber'; value: string | undefined }
  | { field: 'cptCode'; value: CptCode | undefined }
  | { field: 'patientPosition'; value: PatientPosition | undefined }
  | { field: 'quality'; value: StudyQuality | undefined }
  | { field: 'protocol'; value: StudyProtocol | undefined };

type Action =
  | ({ type: 'SET_STUDY_FIELD' } & StudyField)
  | {
      type: 'SET_FINDING';
      id: VenousLEFullSegmentId;
      patch: Partial<VenousSegmentFinding>;
    }
  | { type: 'SET_VIEW'; value: SegmentTableView }
  | { type: 'SET_IMPRESSION'; value: string; edited: boolean }
  | { type: 'SET_CEAP'; value: CeapClassification | undefined }
  | { type: 'SET_RECOMMENDATIONS'; value: ReadonlyArray<Recommendation> }
  | { type: 'SET_SONOGRAPHER_COMMENTS'; value: string }
  | { type: 'SET_CLINICIAN_COMMENTS'; value: string }
  | { type: 'SET_ALL_NORMAL'; scope: 'left' | 'right' | 'bilateral' }
  | { type: 'CLEAR_ALL'; scope: 'left' | 'right' | 'bilateral' }
  | { type: 'COPY_SIDE'; from: 'left' | 'right' }
  | {
      type: 'APPLY_TEMPLATE';
      findings: VenousSegmentFindings;
      view: SegmentTableView;
      ceap: CeapClassification | undefined;
      recommendations: ReadonlyArray<Recommendation>;
      impression: string;
      sonographerComments: string;
    }
  | { type: 'RESET' }
  | { type: 'HYDRATE'; value: VenousFormStateV1 }
  | { type: 'COMMIT_STROKE'; stroke: DrawingStroke }
  | { type: 'ERASE_STROKE'; strokeId: string }
  | { type: 'UNDO_STROKE' }
  | { type: 'CLEAR_DRAWINGS' }
  | { type: 'SET_SEGMENT_PATH_OVERRIDE'; segmentId: VenousLEFullSegmentId; d: string }
  | { type: 'CLEAR_SEGMENT_PATH_OVERRIDE'; segmentId: VenousLEFullSegmentId };

function reducer(state: VenousFormStateV1, action: Action): VenousFormStateV1 {
  switch (action.type) {
    case 'HYDRATE':
      return { ...action.value };
    case 'SET_STUDY_FIELD': {
      // Discriminated update — TS narrows action.value via action.field.
      switch (action.field) {
        case 'studyDate':
          return { ...state, studyDate: action.value };
        case 'studyTime':
          return { ...state, studyTime: action.value };
        case 'accessionNumber':
          return { ...state, accessionNumber: action.value };
        case 'cptCode':
          return { ...state, cptCode: action.value };
        case 'patientPosition':
          return { ...state, patientPosition: action.value };
        case 'quality':
          return { ...state, quality: action.value };
        case 'protocol':
          return { ...state, protocol: action.value };
        default: {
          const _exhaustive: never = action;
          return _exhaustive;
        }
      }
    }
    case 'SET_FINDING': {
      const prev = state.findings[action.id] ?? {};
      const merged: VenousSegmentFinding = { ...prev, ...action.patch };
      // Prune undefined fields so the findings object stays clean for FHIR.
      const pruned: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(merged)) {
        if (v !== undefined) pruned[k] = v;
      }
      // If nothing left, remove the segment entry entirely.
      const hasAny = Object.keys(pruned).length > 0;
      const nextFindings: VenousSegmentFindings = { ...state.findings };
      if (hasAny) {
        (nextFindings as Record<string, VenousSegmentFinding>)[action.id] =
          pruned as VenousSegmentFinding;
      } else {
        delete (nextFindings as Record<string, VenousSegmentFinding>)[action.id];
      }
      return { ...state, findings: nextFindings };
    }
    case 'SET_VIEW':
      return { ...state, view: action.value };
    case 'SET_IMPRESSION':
      return {
        ...state,
        impression: action.value,
        impressionEdited: action.edited,
      };
    case 'SET_CEAP':
      return { ...state, ceap: action.value };
    case 'SET_RECOMMENDATIONS':
      return { ...state, recommendations: action.value };
    case 'SET_SONOGRAPHER_COMMENTS':
      return { ...state, sonographerComments: action.value };
    case 'SET_CLINICIAN_COMMENTS':
      return { ...state, clinicianComments: action.value };
    case 'SET_ALL_NORMAL': {
      const sides: ReadonlyArray<'left' | 'right'> =
        action.scope === 'bilateral' ? ['left', 'right'] : [action.scope];
      const nextFindings: Record<string, VenousSegmentFinding> = {
        ...(state.findings as Record<string, VenousSegmentFinding>),
      };
      for (const base of VENOUS_LE_SEGMENTS) {
        for (const side of sides) {
          const fullId = `${base}-${side}` as VenousLEFullSegmentId;
          nextFindings[fullId] = {
            compressibility: 'normal',
            thrombosis: 'none',
            phasicity: 'respirophasic',
          };
        }
      }
      return { ...state, findings: nextFindings as VenousSegmentFindings };
    }
    case 'CLEAR_ALL': {
      const sides: ReadonlyArray<'left' | 'right'> =
        action.scope === 'bilateral' ? ['left', 'right'] : [action.scope];
      const nextFindings: Record<string, VenousSegmentFinding> = {
        ...(state.findings as Record<string, VenousSegmentFinding>),
      };
      for (const base of VENOUS_LE_SEGMENTS) {
        for (const side of sides) {
          const fullId = `${base}-${side}` as VenousLEFullSegmentId;
          delete nextFindings[fullId];
        }
      }
      return { ...state, findings: nextFindings as VenousSegmentFindings };
    }
    case 'COPY_SIDE': {
      const src = action.from;
      const dst = src === 'left' ? 'right' : 'left';
      const nextFindings: Record<string, VenousSegmentFinding> = {
        ...(state.findings as Record<string, VenousSegmentFinding>),
      };
      for (const base of VENOUS_LE_SEGMENTS) {
        const srcId = `${base}-${src}` as VenousLEFullSegmentId;
        const dstId = `${base}-${dst}` as VenousLEFullSegmentId;
        const srcFinding = state.findings[srcId];
        if (srcFinding) {
          nextFindings[dstId] = { ...srcFinding };
        } else {
          delete nextFindings[dstId];
        }
      }
      return { ...state, findings: nextFindings as VenousSegmentFindings };
    }
    case 'APPLY_TEMPLATE': {
      // Clone findings so the template's interior objects aren't shared with
      // the reducer's state tree (prevents accidental mutation traps).
      const clonedFindings: Record<string, VenousSegmentFinding> = {};
      for (const [k, v] of Object.entries(action.findings)) {
        if (v) clonedFindings[k] = { ...v };
      }
      return {
        ...state,
        findings: clonedFindings as VenousSegmentFindings,
        view: action.view,
        ceap: action.ceap,
        recommendations: action.recommendations.map((r) => ({ ...r })),
        // Seed the canonical impression from the template and mark it as
        // user-edited so the auto-regen in ImpressionBlock doesn't clobber it.
        impression: action.impression,
        impressionEdited: action.impression.length > 0,
        // Only overwrite sonographer comments if the template supplies one.
        sonographerComments:
          action.sonographerComments.length > 0
            ? action.sonographerComments
            : state.sonographerComments,
        // Wave 3.1 (Part 10 HIGH) — always reset clinicianComments so an
        // interpretation typed for a previous patient cannot silently leak
        // into the next case when a clinician picks a template. Templates
        // never carry clinician prose, so a hard empty-string reset is safe.
        clinicianComments: '',
      };
    }
    case 'RESET':
      // Phase 3b: encounter header is now untouched (lives outside this
      // reducer) so RESET only clears the per-study clinical fields. Per-
      // study scalars (studyDate, protocol, default cptCode) reset to their
      // INITIAL_STATE values; quality / position / accession / cptCode
      // overrides clear; findings / impressions / comments / ceap clear.
      return { ...INITIAL_STATE };
    case 'COMMIT_STROKE':
      return { ...state, drawings: [...state.drawings, action.stroke] };
    case 'ERASE_STROKE':
      return {
        ...state,
        drawings: state.drawings.filter((s) => s.id !== action.strokeId),
      };
    case 'UNDO_STROKE': {
      if (state.drawings.length === 0) return state;
      return { ...state, drawings: state.drawings.slice(0, -1) };
    }
    case 'CLEAR_DRAWINGS':
      return { ...state, drawings: [] };
    case 'SET_SEGMENT_PATH_OVERRIDE': {
      const current = state.findings[action.segmentId] ?? {};
      return {
        ...state,
        findings: {
          ...state.findings,
          [action.segmentId]: { ...current, pathOverride: action.d },
        },
      };
    }
    case 'CLEAR_SEGMENT_PATH_OVERRIDE': {
      const current = state.findings[action.segmentId];
      if (!current) return state;
      const { pathOverride: _drop, ...rest } = current;
      void _drop;
      return {
        ...state,
        findings: { ...state.findings, [action.segmentId]: rest },
      };
    }
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

// ============================================================================
// FHIR FormState projection (for PDF + JSON export)
// ============================================================================

/**
 * Phase 3b — composes encounter-level fields (read from the encounter
 * context) with per-study clinical fields (read from local reducer state)
 * into the legacy `FormState.header` shape. Phase 4a will refactor the
 * downstream FHIR + PDF builders to take `EncounterDraft` directly and
 * retire this projection.
 */
export function stateToFormState(
  s: VenousFormStateV1,
  encounter: EncounterDraft,
): FormState {
  const eh = encounter.header;
  const headerOut: StudyHeaderShape = {
    // Encounter-level fields
    patientName: eh.patientName,
    patientId: eh.patientId,
    patientBirthDate: eh.patientBirthDate,
    patientGender: eh.patientGender,
    operatorName: eh.operatorName,
    referringPhysician: eh.referringPhysician,
    institution: eh.institution,
    informedConsent: eh.informedConsent,
    informedConsentSignedAt: eh.informedConsentSignedAt,
    medications: eh.medications,
    icd10Codes: eh.icd10Codes,
    // Per-study fields — fall back to encounter date when local studyDate
    // is unset (defensive; INITIAL_STATE sets studyDate so this is rare).
    studyDate: s.studyDate || eh.encounterDate,
    accessionNumber: s.accessionNumber,
    patientPosition: s.patientPosition,
    cptCode: s.cptCode,
  };
  return {
    studyType: 'venousLEBilateral',
    header: headerOut,
    narrative: {
      // Encounter-level indication notes flow through as the legacy
      // `narrative.indication` slot the PDF + FHIR builders read.
      indication: eh.indicationNotes,
      impression: s.impression,
      sonographerComments: s.sonographerComments || undefined,
      clinicianComments: s.clinicianComments || undefined,
    },
    segments: [],
    recommendations: s.recommendations,
    ceap: s.ceap,
    // Findings travel on the loose parameter bag. After Wave 2.5 the bag is
    // typed `Record<string, unknown>`, so the per-study payload (here
    // `VenousFormParameters`) flows through without any cast — fhirBuilder /
    // narrativeService narrow it back via `isVenousFindings`.
    parameters: {
      segmentFindings: s.findings,
      drawings: s.drawings,
    },
  };
}

// ============================================================================
// Anatomy ↔ segment bridging
// ============================================================================

function baseFromFullId(id: VenousLEFullSegmentId | null): VenousLESegmentBase | null {
  if (!id) return null;
  for (const base of VENOUS_LE_SEGMENTS) {
    if (id.startsWith(base)) return base;
  }
  return null;
}

function sideFromFullId(id: VenousLEFullSegmentId | null): 'left' | 'right' | null {
  if (!id) return null;
  if (id.endsWith('-left')) return 'left';
  if (id.endsWith('-right')) return 'right';
  return null;
}

function competencyMapFromFindings(
  findings: VenousSegmentFindings,
): Record<SegmentId, Competency> {
  const out: Record<SegmentId, Competency> = {};
  for (const base of VENOUS_LE_SEGMENTS) {
    for (const side of ['left', 'right'] as const) {
      const fullId = `${base}-${side}` as VenousLEFullSegmentId;
      const f = findings[fullId];
      if (!f) continue;
      const comp = deriveCompetency(base, f);
      out[fullId] = comp;
    }
  }
  return out;
}

// ============================================================================
// CommentsBlock — sonographer vs clinician comments
// ============================================================================

import { EMRTextarea } from '../../shared/EMRFormFields';

interface CommentsBlockProps {
  readonly sonographer: string;
  readonly clinician: string;
  readonly onSonographerChange: (v: string) => void;
  readonly onClinicianChange: (v: string) => void;
}

const CommentsBlock = memo(function CommentsBlock({
  sonographer,
  clinician,
  onSonographerChange,
  onClinicianChange,
}: CommentsBlockProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <Box className={classes.commentsCard}>
      <Grid gutter={{ base: 'sm', md: 'md' }}>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <EMRTextarea
            label={t('venousLE.narrative.sonographerComments', 'Sonographer comments')}
            helpText={t(
              'venousLE.narrative.sonographerCommentsHelp',
              'Technical notes from the sonographer performing the study.',
            )}
            value={sonographer}
            onChange={onSonographerChange}
            minRows={3}
            maxRows={6}
            autosize
            size="md"
            data-testid="narrative-sonographer"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <EMRTextarea
            label={t('venousLE.narrative.clinicianComments', 'Clinician impression')}
            helpText={t(
              'venousLE.narrative.clinicianCommentsHelp',
              'Interpreting clinician supplemental comments.',
            )}
            value={clinician}
            onChange={onClinicianChange}
            minRows={3}
            maxRows={6}
            autosize
            size="md"
            data-testid="narrative-clinician"
          />
        </Grid.Col>
      </Grid>
    </Box>
  );
});

// ============================================================================
// Reducer-init helper — hydrate from encounter.studies first, then legacy.
// ============================================================================

/**
 * Reducer initializer. Order:
 *   1. If the encounter has a snapshot under `studies.venousLEBilateral`
 *      with the correct schema, use it.
 *   2. Otherwise fall back to the pre-encounter per-study draft slot
 *      (back-compat for users with in-flight work from before the encounter
 *      pivot). Strip any legacy `header` field on read.
 *   3. Otherwise INITIAL_STATE.
 *
 * Centralised so the per-encounter `useReducer` re-mount path uses the
 * same precedence as the first mount.
 */
function initFromEncounter(
  encounter: EncounterDraft | null,
): VenousFormStateV1 {
  if (encounter) {
    const persisted = encounter.studies?.venousLEBilateral;
    if (
      persisted &&
      typeof persisted === 'object' &&
      (persisted as Partial<VenousFormStateV1>).schemaVersion === 1 &&
      (persisted as Partial<VenousFormStateV1>).studyType === 'venousLEBilateral'
    ) {
      // Migrate older drafts that pre-date the `drawings` field, plus
      // remap legacy stroke colours (black/red/blue/green → clinical
      // palette).
      const cast = persisted as Partial<VenousFormStateV1>;
      const drawings = (cast.drawings ?? []).map((s) => ({
        ...s,
        color: migrateLegacyDrawingColor(s.color),
      })) as DrawingStroke[];
      return { ...(persisted as VenousFormStateV1), drawings };
    }
  }
  // Legacy fallback — strip any pre-encounter `header` field if present.
  const legacy = loadDraft<VenousFormStateV1 & { header?: unknown }>(STUDY_ID);
  if (
    legacy &&
    legacy.schemaVersion === 1 &&
    legacy.studyType === 'venousLEBilateral'
  ) {
    const { header: _drop, ...rest } = legacy;
    void _drop;
    const drawings = (rest.drawings ?? []).map((s) => ({
      ...s,
      color: migrateLegacyDrawingColor(s.color),
    })) as DrawingStroke[];
    return { ...INITIAL_STATE, ...rest, drawings };
  }
  return INITIAL_STATE;
}

// ============================================================================
// Main component
// ============================================================================

type AnyTemplate = VenousLETemplate | CustomTemplate;

function isBuiltInTemplate(tpl: AnyTemplate): tpl is VenousLETemplate {
  return 'nameFallback' in tpl;
}

export const VenousLEForm = memo(function VenousLEForm(): React.ReactElement {
  const { t } = useTranslation();
  const { encounter, setStudyState } = useEncounter();

  // Lazy reducer init — read encounter snapshot OR legacy draft on first
  // render. The encounter context's sync-hydration path (Phase 2a) gives us
  // a populated encounter on the very first render when one already exists
  // in localStorage / IDB cache.
  const [state, dispatch] = useReducer(
    reducer,
    encounter,
    initFromEncounter,
  );
  const [highlightId, setHighlightId] = useState<VenousLEFullSegmentId | null>(null);
  /** Template awaiting confirmation (set when user picks one on a non-empty form). */
  const [pendingTemplate, setPendingTemplate] = useState<AnyTemplate | null>(null);
  /** "Start new case?" confirm modal open state. */
  const [newCaseOpen, setNewCaseOpen] = useState<boolean>(false);
  /** Save-as-template modal open state. */
  const [saveDialogOpen, setSaveDialogOpen] = useState<boolean>(false);
  /** Custom template pending delete-confirm. */
  const [pendingDeleteCustomId, setPendingDeleteCustomId] = useState<string | null>(null);
  /** Custom templates loaded from localStorage. */
  const [customTemplates, setCustomTemplates] = useState<ReadonlyArray<CustomTemplate>>(
    () => loadCustomTemplates('venousLEBilateral'),
  );
  /** Recently-used template IDs (MRU-first). */
  const [recentTemplateIds, setRecentTemplateIds] = useState<ReadonlyArray<string>>(
    () => loadRecentTemplateIds('venousLEBilateral'),
  );

  // ---- Persistence: mirror state into encounter.studies.venousLEBilateral.
  //
  // Approach chosen (per Phase 3b brief): drop standalone `useAutoSave`,
  // route persistence through `useEncounter().setStudyState()`. The
  // encounter store already dual-writes localStorage + IDB on every
  // mutation, so reload survives. We track `lastSavedAt` / `dirty` locally
  // to keep the sticky `<FormActions>` saved-indicator UI working.
  // Rationale: a single source of truth (encounter) avoids the IDB-key
  // collision risk between encounters AND eliminates the legacy
  // `angio-study-draft-venousLEBilateral` key as a long-lived artefact.
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [dirty, setDirty] = useState<boolean>(false);

  // Stable refs so the persistence effect can call setStudyState without
  // depending on `encounter` (which mutates on every save and would create
  // a feedback loop: save → encounter changes → effect re-runs → save).
  const setStudyStateRef = useRef(setStudyState);
  const encounterPresentRef = useRef<boolean>(encounter !== null);
  useEffect(() => {
    setStudyStateRef.current = setStudyState;
    encounterPresentRef.current = encounter !== null;
  }, [setStudyState, encounter]);

  // Skip the very first sync — INITIAL_STATE / hydrated state shouldn't
  // mark the form dirty until the user actually edits.
  const firstSyncRef = useRef<boolean>(true);

  useEffect(() => {
    if (!encounterPresentRef.current) return;
    if (firstSyncRef.current) {
      firstSyncRef.current = false;
      return;
    }
    setStudyStateRef.current('venousLEBilateral', state as VenousFormStateV1);
    setLastSavedAt(new Date());
    setDirty(false);
    // We intentionally depend on `state` only. The setStudyState callback
    // and encounter presence are read through stable refs so each save
    // doesn't re-arm this effect (which would loop because saving mutates
    // the encounter reference).
  }, [state]);

  // Rehydrate when the encounter context resolves AFTER the reducer mounted
  // with an empty cache — covers the async IDB-load path. Only fires when
  // a real persisted snapshot lands and differs from the in-memory state.
  const hasHydratedFromAsyncRef = useRef<boolean>(false);
  useEffect(() => {
    if (!encounter || hasHydratedFromAsyncRef.current) return;
    const persisted = encounter.studies?.venousLEBilateral;
    if (
      persisted &&
      typeof persisted === 'object' &&
      (persisted as Partial<VenousFormStateV1>).schemaVersion === 1 &&
      (persisted as Partial<VenousFormStateV1>).studyType === 'venousLEBilateral' &&
      persisted !== state
    ) {
      // Skip if the snapshot equals the current state by reference (the
      // common case once we've synced once).
      hasHydratedFromAsyncRef.current = true;
      dispatch({ type: 'HYDRATE', value: persisted as VenousFormStateV1 });
      // Suppress the next mirror-write (which would clobber the snapshot
      // we just hydrated FROM with the same value).
      firstSyncRef.current = true;
    }
    // Same rationale as above — we don't want this firing on every
    // encounter mutation. Once we've hydrated once we never re-import.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounter]);

  // Manual save — no-op when state is already mirrored, but bumps the
  // saved-indicator timestamp so the UI shows a fresh "saved just now".
  const saveNow = useCallback(() => {
    if (!encounterPresentRef.current) return;
    setStudyStateRef.current('venousLEBilateral', state as VenousFormStateV1);
    setLastSavedAt(new Date());
    setDirty(false);
  }, [state]);

  // Marks the form dirty between auto-syncs. The persistence effect above
  // is the canonical clean-state edge: every time it fires it calls
  // `setDirty(false)`. Between fires (the brief window before the post-
  // render flush) we'd be lying if we showed clean — but the persistence
  // effect runs synchronously after every render, so the gap is too short
  // to matter in the UI. We track a separate `firstDirtyRef` so the
  // initial mount doesn't flash a dirty state while the first sync is
  // still pending.
  const firstDirtyRef = useRef<boolean>(true);
  useEffect(() => {
    if (firstDirtyRef.current) {
      firstDirtyRef.current = false;
      return;
    }
    setDirty(true);
  }, [state]);

  // Derived anatomy segment map (memoized — only recomputes when findings change).
  const competencyMap = useMemo(() => competencyMapFromFindings(state.findings), [state.findings]);
  // Collect any user-redrawn segment paths so the diagram can render
  // them instead of the static SVG geometry.
  const pathOverridesMap = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [id, f] of Object.entries(state.findings)) {
      if (f?.pathOverride) out[id] = f.pathOverride;
    }
    return out;
  }, [state.findings]);

  // ---------------- Callbacks ----------------

  const handleView = useCallback((v: SegmentTableView) => {
    dispatch({ type: 'SET_VIEW', value: v });
  }, []);

  const handleFinding = useCallback(
    (id: VenousLEFullSegmentId, patch: Partial<VenousSegmentFinding>) => {
      dispatch({ type: 'SET_FINDING', id, patch });
    },
    [],
  );

  const handleImpression = useCallback((v: string, edited: boolean) => {
    dispatch({ type: 'SET_IMPRESSION', value: v, edited });
  }, []);

  const handleImpressionRegenerate = useCallback((v: string) => {
    dispatch({ type: 'SET_IMPRESSION', value: v, edited: false });
  }, []);

  const handleCeap = useCallback((v: CeapClassification | undefined) => {
    dispatch({ type: 'SET_CEAP', value: v });
  }, []);

  const handleRecs = useCallback((v: ReadonlyArray<Recommendation>) => {
    dispatch({ type: 'SET_RECOMMENDATIONS', value: v });
  }, []);

  const handleSonographerComments = useCallback((v: string) => {
    dispatch({ type: 'SET_SONOGRAPHER_COMMENTS', value: v });
  }, []);

  const handleClinicianComments = useCallback((v: string) => {
    dispatch({ type: 'SET_CLINICIAN_COMMENTS', value: v });
  }, []);

  const handleSetAllNormal = useCallback(() => {
    dispatch({ type: 'SET_ALL_NORMAL', scope: state.view });
  }, [state.view]);

  const handleClearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL', scope: state.view });
  }, [state.view]);

  const handleCopySide = useCallback((from: 'left' | 'right') => {
    dispatch({ type: 'COPY_SIDE', from });
  }, []);

  const handleAnatomySegmentClick = useCallback(
    (id: SegmentId) => {
      // Jump the segment-table view to the segment's side and highlight it.
      const side = sideFromFullId(id as VenousLEFullSegmentId);
      if (side) {
        if (state.view !== 'bilateral' && state.view !== side) {
          dispatch({ type: 'SET_VIEW', value: side });
        }
      }
      setHighlightId(id as VenousLEFullSegmentId);
    },
    [state.view],
  );

  const handleRowHighlight = useCallback((id: VenousLEFullSegmentId | null) => {
    setHighlightId(id);
  }, []);

  // ---- Drawing handlers ----

  const handleCommitStroke = useCallback((stroke: DrawingStroke) => {
    dispatch({ type: 'COMMIT_STROKE', stroke });
  }, []);

  const handleEraseStroke = useCallback((strokeId: string) => {
    dispatch({ type: 'ERASE_STROKE', strokeId });
  }, []);

  const handleUndoStroke = useCallback(() => {
    dispatch({ type: 'UNDO_STROKE' });
  }, []);

  const handleClearDrawings = useCallback(() => {
    dispatch({ type: 'CLEAR_DRAWINGS' });
  }, []);

  const handleCommitSegmentEdit = useCallback((segmentId: SegmentId, d: string) => {
    dispatch({ type: 'SET_SEGMENT_PATH_OVERRIDE', segmentId: segmentId as VenousLEFullSegmentId, d });
  }, []);

  const handleClearSegmentEdit = useCallback((segmentId: SegmentId) => {
    dispatch({ type: 'CLEAR_SEGMENT_PATH_OVERRIDE', segmentId: segmentId as VenousLEFullSegmentId });
  }, []);

  // ---- Template apply flow ----

  /** True when the form has enough data that applying a template would overwrite work. */
  const hasFormContent = useMemo(() => {
    return (
      Object.keys(state.findings).length > 0 ||
      state.ceap !== undefined ||
      state.recommendations.length > 0 ||
      state.impression.trim().length > 0 ||
      state.sonographerComments.trim().length > 0 ||
      state.clinicianComments.trim().length > 0
    );
  }, [
    state.findings,
    state.ceap,
    state.recommendations,
    state.impression,
    state.sonographerComments,
    state.clinicianComments,
  ]);

  const applyTemplate = useCallback(
    (template: AnyTemplate) => {
      // Resolve localized prose for the template. Built-ins use key + fallback;
      // custom templates store literal strings (saved in the user's language).
      const impression = isBuiltInTemplate(template)
        ? t(template.impressionKey, template.impressionFallback)
        : (template.impression ?? '');
      const sonographerComments = isBuiltInTemplate(template)
        ? template.sonographerCommentsKey
          ? t(template.sonographerCommentsKey, template.sonographerCommentsFallback ?? '')
          : ''
        : (template.sonographerComments ?? '');
      const recommendations: ReadonlyArray<Recommendation> = template.recommendations
        ? template.recommendations.map((r) => ({ ...r }))
        : [];

      dispatch({
        type: 'APPLY_TEMPLATE',
        findings: template.findings as VenousSegmentFindings,
        view: template.scope,
        ceap: template.ceap,
        recommendations,
        impression,
        sonographerComments,
      });
      // Reset anatomy highlight — rows may no longer exist for the old id.
      setHighlightId(null);

      // Push to recently-used queue + refresh state from storage.
      pushRecentTemplate('venousLEBilateral', template.id);
      setRecentTemplateIds(loadRecentTemplateIds('venousLEBilateral'));

      const name = isBuiltInTemplate(template)
        ? t(template.nameKey, template.nameFallback)
        : template.name;
      notifications.show({
        title: t('venousLE.templates.appliedToast.title', 'Template applied'),
        message: t('venousLE.templates.appliedToast.message', { name }),
        color: 'teal',
        autoClose: 2500,
      });
    },
    [t],
  );

  const handleTemplatePick = useCallback(
    (template: AnyTemplate) => {
      if (hasFormContent) {
        setPendingTemplate(template);
        return;
      }
      applyTemplate(template);
    },
    [hasFormContent, applyTemplate],
  );

  const handleTemplateConfirm = useCallback(() => {
    if (pendingTemplate) {
      applyTemplate(pendingTemplate);
    }
    setPendingTemplate(null);
  }, [pendingTemplate, applyTemplate]);

  const handleTemplateCancel = useCallback(() => {
    setPendingTemplate(null);
  }, []);

  // ---- Save current as template flow ----

  const handleOpenSaveDialog = useCallback(() => {
    setSaveDialogOpen(true);
  }, []);

  const handleCloseSaveDialog = useCallback(() => {
    setSaveDialogOpen(false);
  }, []);

  const handleSaveTemplateSubmit = useCallback(
    (payload: SaveTemplatePayload) => {
      const saved = saveCustomTemplate('venousLEBilateral', {
        name: payload.name,
        description: payload.description,
        kind: payload.kind,
        scope: state.view,
        findings: state.findings,
        ceap: state.ceap,
        recommendations: state.recommendations,
        impression: state.impression,
        sonographerComments: state.sonographerComments,
      });
      setCustomTemplates(loadCustomTemplates('venousLEBilateral'));
      setSaveDialogOpen(false);
      notifications.show({
        title: t('venousLE.templates.save.successToast.title', 'Template saved'),
        message: t(
          'venousLE.templates.save.successToast.message',
          { name: saved.name },
        ),
        color: 'teal',
        autoClose: 2500,
      });
    },
    [
      state.view,
      state.findings,
      state.ceap,
      state.recommendations,
      state.impression,
      state.sonographerComments,
      t,
    ],
  );

  // ---- Delete custom template flow ----

  const handleRequestDeleteCustom = useCallback((id: string) => {
    setPendingDeleteCustomId(id);
  }, []);

  const handleCancelDeleteCustom = useCallback(() => {
    setPendingDeleteCustomId(null);
  }, []);

  const handleConfirmDeleteCustom = useCallback(() => {
    if (!pendingDeleteCustomId) return;
    deleteCustomTemplate('venousLEBilateral', pendingDeleteCustomId);
    setCustomTemplates(loadCustomTemplates('venousLEBilateral'));
    setPendingDeleteCustomId(null);
    notifications.show({
      title: t('venousLE.templates.delete.successToast.title', 'Template deleted'),
      message: t(
        'venousLE.templates.delete.successToast.message',
        'The template has been removed from your library.',
      ),
      color: 'teal',
      autoClose: 2500,
    });
  }, [pendingDeleteCustomId, t]);

  // ---- New case flow ----

  const handleNewCaseRequest = useCallback(() => {
    setNewCaseOpen(true);
  }, []);

  const handleNewCaseConfirm = useCallback(() => {
    // Phase 3b: encounter header is preserved automatically (it lives in
    // the encounter context, not the per-study reducer). RESET clears
    // findings + impressions + recommendations + per-study clinical fields
    // back to INITIAL_STATE; the encounter banner stays put.
    dispatch({ type: 'RESET' });
    setHighlightId(null);
    setNewCaseOpen(false);
    notifications.show({
      title: t('venousLE.actions.newCaseToastTitle', 'New case started'),
      message: t(
        'venousLE.actions.newCaseToastMessage',
        'The form has been cleared.',
      ),
      color: 'teal',
      autoClose: 2500,
    });
  }, [t]);

  const handleNewCaseCancel = useCallback(() => {
    setNewCaseOpen(false);
  }, []);

  // Keyboard shortcuts (mirrored to tooltip hints):
  //   ⌘N / Ctrl+N  → All Normal for the current tab's scope
  //   ⌘D / Ctrl+D  → Duplicate right side → left side
  //   ⌘S / Ctrl+S  → Save draft (explicitly preventDefault to block browser "Save Page As")
  //   ⌘⇧N         → Open "Start new case?" confirm modal
  useHotkeys([
    ['mod+N', () => handleSetAllNormal(), { preventDefault: true }],
    ['mod+D', () => handleCopySide('right'), { preventDefault: true }],
    ['mod+S', () => saveNow(), { preventDefault: true }],
    ['mod+shift+N', () => handleNewCaseRequest(), { preventDefault: true }],
  ]);

  // Project to FormState for FHIR/PDF. Returns null when encounter hasn't
  // hydrated yet — renders a thin loading placeholder below in that case.
  const formState = useMemo<FormState | null>(
    () => (encounter ? stateToFormState(state, encounter) : null),
    [state, encounter],
  );

  // Filename for exports — combines encounter patient name + per-study date.
  const baseFilename = useMemo(() => {
    const patient = (encounter?.header.patientName || 'patient').replace(/\s+/g, '-');
    const date = state.studyDate || encounter?.header.encounterDate || TODAY_ISO;
    return `venous-le-${patient}-${date}`;
  }, [encounter?.header.patientName, encounter?.header.encounterDate, state.studyDate]);

  // Highlight → single anatomy `highlightId` (anatomy only accepts one).
  const anatomyHighlight = highlightId ?? null;
  const highlightedBase = baseFromFullId(anatomyHighlight);
  void highlightedBase; // reserved for future use (e.g. segment detail popover)

  return (
    <div className={classes.page}>
      <div className={classes.container}>
        <Stack gap="md">
          <BackToStudiesButton />
          {/*
            Phase 3b — `<StudyHeader>` was removed. The compact
            `<EncounterContextBanner>` replaces it visually; encounter-level
            fields are now read from `useEncounter()` and edited on the
            intake page.
          */}
          <EncounterContextBanner />

          <Group justify="flex-end" gap="xs" wrap="wrap">
            <button
              type="button"
              className={classes.newCaseButton}
              onClick={handleNewCaseRequest}
              aria-label={t('venousLE.actions.newCase', '+ New case')}
              data-testid="new-case-button"
            >
              <IconPlus size={16} stroke={2.25} />
              <span>{t('venousLE.actions.newCase', '+ New case')}</span>
            </button>
          </Group>

          <SegmentAssessmentCard
            view={state.view}
            onViewChange={handleView}
            findings={state.findings}
            onFindingChange={handleFinding}
            highlightId={highlightId}
            onHighlight={handleRowHighlight}
            onSetAllNormal={handleSetAllNormal}
            onClearAll={handleClearAll}
            onCopySide={handleCopySide}
            onApplyTemplate={handleTemplatePick}
            onSaveCurrentAsTemplate={handleOpenSaveDialog}
            customTemplates={customTemplates}
            recentTemplateIds={recentTemplateIds}
            onDeleteCustomTemplate={handleRequestDeleteCustom}
          />

          <Box className={classes.anatomyCard}>
            <Box className={classes.anatomyHead}>
              <Text className={classes.anatomyTitle}>
                {t('venousLE.anatomy.title')}
              </Text>
              <Text className={classes.anatomySubtitle}>
                {t('venousLE.anatomy.subtitle')}
              </Text>
            </Box>
            <div className={classes.anatomyBody}>
              <AnatomyDiagramSection
                segments={competencyMap}
                pathOverrides={pathOverridesMap}
                drawings={state.drawings}
                highlightId={anatomyHighlight}
                onSegmentClick={handleAnatomySegmentClick}
                onCommitStroke={handleCommitStroke}
                onEraseStroke={handleEraseStroke}
                onUndo={handleUndoStroke}
                onClear={handleClearDrawings}
                onCommitSegmentEdit={handleCommitSegmentEdit}
                onClearSegmentEdit={handleClearSegmentEdit}
              />
              <Box className={classes.anatomyLegend}>
                <AnatomyLegend />
              </Box>
            </div>
          </Box>

          <ImpressionBlock
            findings={state.findings}
            value={state.impression}
            edited={state.impressionEdited}
            onChange={handleImpression}
            onRegenerate={handleImpressionRegenerate}
          />

          <CommentsBlock
            sonographer={state.sonographerComments}
            clinician={state.clinicianComments}
            onSonographerChange={handleSonographerComments}
            onClinicianChange={handleClinicianComments}
          />

          <CEAPPicker value={state.ceap} onChange={handleCeap} />

          <RecommendationsBlock items={state.recommendations} onChange={handleRecs} />
        </Stack>
      </div>

      {formState && (
        <FormActions
          form={formState}
          lastSavedAt={lastSavedAt}
          hasUnsavedChanges={dirty}
          onSaveDraft={saveNow}
          baseFilename={baseFilename}
        />
      )}

      <ConfirmDialog
        opened={pendingTemplate !== null}
        onClose={handleTemplateCancel}
        title={t('venousLE.actions.applyTemplateConfirmTitle', 'Apply template?')}
        message={t(
          'venousLE.actions.applyTemplateConfirmBody',
          'This will replace current findings, CEAP, recommendations, impression, and sonographer comments.',
        )}
        confirmLabel={t('venousLE.actions.applyTemplate', 'Apply template')}
        cancelLabel={t('venousLE.actions.cancel', 'Cancel')}
        onConfirm={handleTemplateConfirm}
      />

      <ConfirmDialog
        opened={newCaseOpen}
        onClose={handleNewCaseCancel}
        title={t('venousLE.actions.newCaseConfirmTitle', 'Start a new case?')}
        message={t(
          'venousLE.actions.newCaseConfirmBody',
          'This will erase all current data. Unsaved changes will be lost.',
        )}
        confirmLabel={t('venousLE.actions.newCaseConfirm', 'Discard & start new')}
        cancelLabel={t('venousLE.actions.cancel', 'Cancel')}
        onConfirm={handleNewCaseConfirm}
        destructive
      />

      <SaveTemplateDialog
        opened={saveDialogOpen}
        onClose={handleCloseSaveDialog}
        onSubmit={handleSaveTemplateSubmit}
      />

      <ConfirmDialog
        opened={pendingDeleteCustomId !== null}
        onClose={handleCancelDeleteCustom}
        title={t('venousLE.templates.delete.confirmTitle', 'Delete template?')}
        message={t(
          'venousLE.templates.delete.confirmBody',
          'This template will be removed from your library. This cannot be undone.',
        )}
        confirmLabel={t('venousLE.templates.delete.confirm', 'Delete')}
        cancelLabel={t('venousLE.actions.cancel', 'Cancel')}
        onConfirm={handleConfirmDeleteCustom}
        destructive
        zIndex={1250}
      />
    </div>
  );
});

export default VenousLEForm;
