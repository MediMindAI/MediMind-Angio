// SPDX-License-Identifier: Apache-2.0
/**
 * ArterialLEForm — Phase 2 orchestrator for bilateral lower-extremity
 * arterial duplex reporting.
 *
 * Layout (≥1400px; UX-ANGIO-015 + 025 L1):
 *   ┌─ EncounterContextBanner ──────────────────────────┐
 *   ├─ SegmentalPressureTable ──┬─ ArterialSegmentTable ┤
 *   ├─ Anatomy diagram (sticky) ┤   (full 890px grid)   │
 *   ├─ Run-off · narrative · RecommendationsBlock ──────┤
 *   └─ FormActions (sticky) ────────────────────────────┘
 * 1280–1399px: pressures take their own row, diagram | table below it.
 * Below 1280px everything stacks: pressures → diagram → table.
 *
 * Phase 3b (encounter pivot) — patient + visit identity now lives on the
 * `EncounterContext`; this reducer carries only the per-study clinical
 * fields (studyDate/studyTime/accessionNumber/cptCode/patientPosition/
 * quality, plus findings/pressures/narrative/recommendations). Per-study
 * state is mirrored into `encounter.studies.arterialLE` (debounced 500 ms)
 * so the encounter draft is the single source of truth.
 */

import { memo, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Stack, Group, Text, UnstyledButton } from '@mantine/core';
import { EMRSelect, EMRTextarea } from '../../shared/EMRFormFields';
import { AnatomyDiagramSection } from '../../anatomy/AnatomyDiagramSection';
import { AnatomyLegend } from '../../anatomy';
import { nextSeverityBand, severityBandColor, severityLegendItems } from '../../anatomy/severityColor';
import type { SegmentId } from '../../../types/anatomy';
import { STENOSIS_DRAWING_COLORS, type DrawingStroke } from '../../../types/drawing';
import { useHotkeys, useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconAlertTriangle, IconEraser, IconStack2 } from '@tabler/icons-react';
import { useTranslation } from '../../../contexts/TranslationContext';
import { useEncounter } from '../../../contexts/EncounterContext';
import type {
  CptCode,
  FormState,
  Recommendation,
  StudyHeader as StudyHeaderShape,
} from '../../../types/form';
import type { EncounterDraft } from '../../../types/encounter';
import type { PatientPosition } from '../../../types/patient-position';
import { loadDraft } from '../../../hooks/useAutoSave';
import { ConfirmDialog, EMRAlert, EMRButton, EMRContentSection, EMRViewToggle } from '../../common';
import { EncounterContextBanner } from '../../layout/EncounterContextBanner';
import { BackToStudiesButton } from '../../layout/BackToStudiesButton';
import { RecommendationsBlock } from '../../form/RecommendationsBlock';
import { FormActions } from '../../form/FormActions';
import { SaveTemplateDialog, type SaveTemplatePayload } from '../../form/SaveTemplateDialog';
import { defaultCptForStudy, cptDisplay } from '../../../constants/vascular-cpt';
import { localDateToIso } from '../../../services/dateHelpers';
import {
  loadCustomTemplates,
  loadRecentTemplateIds,
  pushRecentTemplate,
  saveCustomTemplate,
  deleteCustomTemplate,
  type CustomTemplate,
} from '../../../services/customTemplatesService';
import type {
  ArterialLEFullSegmentId,
  ArterialSegmentFinding,
  ArterialSegmentFindings,
  Runoff,
  RunoffAssessment,
  SegmentalPressures,
} from './config';
import { arterialCompetencyForSvgId, arterialFindingIdsForSvgId, RUNOFF_VALUES } from './config';
import { validateArterial } from './arterialValidation';
import { SegmentalPressureTable } from './SegmentalPressureTable';
import { ArterialSegmentTable, type ArterialTableView } from './ArterialSegmentTable';
import {
  type ArterialLETemplate,
  type ArterialTemplateKind,
} from './templates';
import { ArterialTemplateGallery } from './ArterialTemplateGallery';
import classes from './ArterialLEForm.module.css';

// Legacy per-study draft key — Phase 3b read-only fallback for pre-encounter
// drafts. New writes mirror into `encounter.studies.arterialLE`.
const LEGACY_STUDY_ID = 'arterialLE';

type StudyQuality = 'excellent' | 'good' | 'suboptimal' | 'limited';

// ============================================================================
// State shape
// ============================================================================

/**
 * Phase 3b — encounter-pivot per-study state. The `header` slot has been
 * removed: encounter-level fields (patient identity, operator, institution,
 * referringPhysician, medications, informedConsent, icd10Codes,
 * indicationNotes) now live on the encounter (read via `useEncounter()`),
 * while the per-study fields (`studyDate`, `studyTime`, `accessionNumber`,
 * `cptCode`, `patientPosition`, `quality`) live as top-level reducer fields.
 *
 * Schema bumps to V2 so a stale V1 draft (which still carried `header`)
 * doesn't silently hydrate as V2 and crash downstream consumers.
 */
interface ArterialFormStateV2 {
  readonly schemaVersion: 2;
  readonly studyType: 'arterialLE';
  // --- Per-study clinical metadata ---
  readonly studyDate: string; // ISO YYYY-MM-DD
  readonly studyTime?: string;
  readonly accessionNumber?: string;
  readonly cptCode?: CptCode;
  readonly patientPosition?: PatientPosition;
  readonly quality?: StudyQuality;
  // --- Findings + narrative ---
  readonly findings: ArterialSegmentFindings;
  readonly pressures: SegmentalPressures;
  readonly runoff: RunoffAssessment;
  readonly view: ArterialTableView;
  readonly impression: string;
  readonly impressionEdited: boolean;
  /**
   * True when findings changed after the conclusion text was written (e.g. a
   * "normal" template conclusion, then an abnormal finding). The text is never
   * rewritten — the form only asks the clinician to review it. Optional so
   * older drafts hydrate unchanged.
   */
  readonly impressionStale?: boolean;
  readonly sonographerComments: string;
  readonly clinicianComments: string;
  readonly recommendations: ReadonlyArray<Recommendation>;
  // Clinician freehand annotations on the arterial anatomy diagram. Added
  // without a schemaVersion bump (mirrors the carotid drawing rollout): a
  // pre-drawing V2 draft simply defaults `drawings: []` on hydration, so
  // in-flight encounter drafts are never rejected and wiped.
  readonly drawings: ReadonlyArray<DrawingStroke>;
}

type Action =
  | { type: 'SET_VIEW'; view: ArterialTableView }
  | { type: 'SET_FINDING'; id: ArterialLEFullSegmentId; patch: Partial<ArterialSegmentFinding> }
  | { type: 'SET_PRESSURES'; pressures: SegmentalPressures }
  | { type: 'SET_RUNOFF'; side: 'left' | 'right'; value: Runoff | undefined }
  | { type: 'SET_IMPRESSION'; impression: string }
  | { type: 'SET_SONOGRAPHER'; comments: string }
  | { type: 'SET_CLINICIAN'; comments: string }
  | { type: 'SET_RECOMMENDATIONS'; recommendations: ReadonlyArray<Recommendation> }
  | { type: 'COMMIT_STROKE'; stroke: DrawingStroke }
  | { type: 'ERASE_STROKE'; strokeId: string }
  | { type: 'UNDO_STROKE' }
  | { type: 'CLEAR_DRAWINGS' }
  | {
      type: 'APPLY_TEMPLATE';
      findings: ArterialSegmentFindings;
      pressures: SegmentalPressures;
      view: ArterialTableView;
      recommendations: ReadonlyArray<Recommendation>;
      impression: string;
      sonographerComments?: string;
    }
  | { type: 'RESET' };

function defaultCpt(): CptCode {
  const cpt = defaultCptForStudy('arterialLE');
  return {
    code: cpt.code,
    display: cptDisplay(cpt, 'en'),
  };
}

function initialState(): ArterialFormStateV2 {
  return {
    schemaVersion: 2,
    studyType: 'arterialLE',
    studyDate: localDateToIso(new Date()) ?? '',
    cptCode: defaultCpt(),
    findings: {},
    pressures: {},
    runoff: {},
    view: 'bilateral',
    impression: '',
    impressionEdited: false,
    sonographerComments: '',
    clinicianComments: '',
    recommendations: [],
    drawings: [],
  };
}

/**
 * Backfill fields added to V2 after its first ship (`drawings`, `runoff`) on a
 * hydrated draft so they're never `undefined` (mirrors the carotid rollout —
 * no schemaVersion bump, so in-flight drafts are never rejected and wiped).
 */
function withDrawingsDefault(s: ArterialFormStateV2): ArterialFormStateV2 {
  let out = s;
  if (!out.drawings) out = { ...out, drawings: [] };
  if (!out.runoff) out = { ...out, runoff: {} };
  return out;
}

function reducer(state: ArterialFormStateV2, action: Action): ArterialFormStateV2 {
  switch (action.type) {
    case 'SET_VIEW':
      return { ...state, view: action.view };
    case 'SET_FINDING': {
      const prev = state.findings[action.id] ?? {};
      const merged: ArterialSegmentFinding = { ...prev, ...action.patch };
      return {
        ...state,
        findings: { ...state.findings, [action.id]: merged },
        impressionStale: state.impression.trim() !== '',
      };
    }
    case 'SET_PRESSURES':
      return { ...state, pressures: action.pressures, impressionStale: state.impression.trim() !== '' };
    case 'SET_RUNOFF':
      return {
        ...state,
        runoff: { ...state.runoff, [action.side]: action.value },
        impressionStale: state.impression.trim() !== '',
      };
    case 'SET_IMPRESSION':
      return { ...state, impression: action.impression, impressionEdited: true, impressionStale: false };
    case 'SET_SONOGRAPHER':
      return { ...state, sonographerComments: action.comments };
    case 'SET_CLINICIAN':
      return { ...state, clinicianComments: action.comments };
    case 'SET_RECOMMENDATIONS':
      return { ...state, recommendations: action.recommendations };
    case 'COMMIT_STROKE':
      return { ...state, drawings: [...state.drawings, action.stroke] };
    case 'ERASE_STROKE':
      return { ...state, drawings: state.drawings.filter((s) => s.id !== action.strokeId) };
    case 'UNDO_STROKE':
      return state.drawings.length === 0
        ? state
        : { ...state, drawings: state.drawings.slice(0, -1) };
    case 'CLEAR_DRAWINGS':
      return { ...state, drawings: [] };
    case 'APPLY_TEMPLATE': {
      return {
        ...state,
        findings: { ...action.findings },
        pressures: { ...action.pressures },
        view: action.view,
        recommendations: [...action.recommendations],
        impression: action.impression,
        // Wave 4.6 (Part 03 MEDIUM) — match venous reducer: only mark
        // edited when the template actually carries impression text.
        // Empty templates leave the textarea pristine so a regenerate-on-
        // findings-change button (planned) can still rebuild it.
        impressionEdited: action.impression.length > 0,
        impressionStale: false,
        sonographerComments: action.sonographerComments ?? state.sonographerComments,
        // Wave 3.1 (Part 10 HIGH) — always reset clinicianComments so an
        // interpretation typed for a previous patient cannot silently leak
        // into the next case when a clinician picks a template.
        clinicianComments: '',
      };
    }
    case 'RESET':
      // Phase 3b — encounter-pivot. Encounter header is owned by the
      // encounter store, not this reducer, so RESET drops its previous
      // header argument. "+ New case" now means "reset THIS study's
      // findings within the encounter"; encounter identity persists.
      return { ...initialState() };
    default: {
      // Wave 3.7 (Part 03 HIGH) — exhaustiveness check. If a new Action member
      // is added without a corresponding case here, TypeScript will fail
      // compilation on this assignment, preventing silent no-ops.
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

// ============================================================================
// FormState shape for FormActions / FHIR / PDF
// ============================================================================

/**
 * Phase 3b — assemble a `FormState` for the FHIR/PDF pipeline by merging
 * the encounter-level header (read from `EncounterContext`) with the local
 * study-clinical fields. The downstream `FormState.header` shape is
 * unchanged for this phase — Phase 4 will refactor the FHIR builder to
 * consume encounter + per-study state directly.
 */
function toFormState(state: ArterialFormStateV2, encounter: EncounterDraft | null): FormState {
  const eh = encounter?.header;
  const header: StudyHeaderShape = {
    // Patient identity (encounter-level)
    patientName: eh?.patientName ?? '',
    patientId: eh?.patientId,
    patientBirthDate: eh?.patientBirthDate,
    patientGender: eh?.patientGender,
    // Visit context (encounter-level)
    operatorName: eh?.operatorName,
    referringPhysician: eh?.referringPhysician,
    institution: eh?.institution,
    informedConsent: eh?.informedConsent,
    informedConsentSignedAt: eh?.informedConsentSignedAt,
    medications: eh?.medications,
    icd10Codes: eh?.icd10Codes,
    // Per-study fields (local reducer state); studyDate falls back to encounter date.
    studyDate: state.studyDate || eh?.encounterDate || localDateToIso(new Date()) || '',
    accessionNumber: state.accessionNumber,
    patientPosition: state.patientPosition,
    cptCode: state.cptCode,
  };

  return {
    studyType: 'arterialLE',
    header,
    segments: [],  // FHIR builder pulls from parameters for arterial
    narrative: {
      impression: state.impression,
      sonographerComments: state.sonographerComments,
      clinicianComments: state.clinicianComments,
    },
    recommendations: state.recommendations,
    parameters: {
      // Stash findings + pressures on parameters so FHIR/PDF can retrieve them.
      // Wave 2.5: `parameters` is now `Record<string, unknown>` so the per-study
      // payload (`ArterialFormParameters`) flows through without casts.
      segmentFindings: state.findings,
      pressures: state.pressures,
      drawings: state.drawings,
      runoff: state.runoff,
    },
  };
}

/**
 * Phase 3b — type guard for an encounter-mirrored arterial draft. The
 * encounter store widens `studies[type]` to `unknown`, so before we
 * hydrate we must runtime-check it carries V2 metadata. Older V1 entries
 * (still carrying `header`) are treated as miss → reducer falls through
 * to the legacy localStorage probe + fresh initial state.
 */
function isArterialFormStateV2(value: unknown): value is ArterialFormStateV2 {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { schemaVersion?: unknown }).schemaVersion === 2 &&
    (value as { studyType?: unknown }).studyType === 'arterialLE'
  );
}

// ============================================================================
// Component
// ============================================================================

export const ArterialLEForm = memo(function ArterialLEForm(): React.ReactElement {
  const { t } = useTranslation();
  const { encounter, setStudyState } = useEncounter();

  const [state, dispatch] = useReducer(reducer, undefined, () => {
    // Phase 3b hydration order:
    //   1. Encounter-mirrored draft (`encounter.studies.arterialLE`) — the
    //      new source of truth once Phase 3 lands.
    //   2. Legacy per-study localStorage draft (Wave 4.1 store) — back-compat
    //      for pre-encounter drafts; Phase 1c migration will eventually fold
    //      these into encounters and we can drop this branch.
    //   3. Fresh initial state.
    //
    // `loadEncounterSync` already ran inside the wrapper (Phase 3a) before
    // this reducer mounted, so reading `encounter.studies` from the
    // EncounterContext closure is safe even on first render.
    const fromEncounter = encounter?.studies.arterialLE;
    if (isArterialFormStateV2(fromEncounter)) {
      return withDrawingsDefault(fromEncounter);
    }

    const persisted = loadDraft<{ schemaVersion?: unknown; studyType?: unknown }>(LEGACY_STUDY_ID);
    if (isArterialFormStateV2(persisted)) {
      return withDrawingsDefault(persisted);
    }
    return initialState();
  });

  // --- Persistence: mirror per-study state into the encounter draft -----------
  //
  // Phase 3b chose option (a) from the brief — single source of truth in
  // `encounter.studies.arterialLE`. Every change persists immediately (no
  // debounce, CLAUDE.md). UX-ANGIO-001 L1: the old 500 ms timer re-armed
  // itself on every `encounter` change that `setStudyState` causes, so an
  // idle tab rewrote the whole visit ~2×/s and wiped other tabs' edits.
  // Same anti-loop guard as CarotidForm:
  //   * Wait for a non-null encounter before mirroring.
  //   * On the FIRST run with a non-null encounter, just seed
  //     `lastPersistedRef` so we don't echo the freshly-hydrated state
  //     back into the encounter (it was just read from there).
  //   * Subsequent runs: persist only if `state` actually changed by
  //     reference. The encounter-ref churn that `setStudyState` itself
  //     produces re-fires the effect with the same `state`, so the ref
  //     guard short-circuits the loop.
  //
  // UX-ANGIO-002 L3a: the form no longer keeps its own "last saved" clock or
  // dirty flag. FormActions reads the confirmed save time and any save error
  // from EncounterContext, so the line survives a reload and shows failures.
  const lastPersistedRef = useRef<ArterialFormStateV2 | null>(null);

  useEffect(() => {
    if (!encounter) return;
    if (lastPersistedRef.current === null) {
      lastPersistedRef.current = state;
      return;
    }
    if (lastPersistedRef.current === state) return;
    lastPersistedRef.current = state;
    setStudyState<ArterialFormStateV2>('arterialLE', state);
  }, [encounter, setStudyState, state]);

  const saveNow = useCallback(() => {
    if (!encounter) return;
    setStudyState<ArterialFormStateV2>('arterialLE', state);
  }, [encounter, setStudyState, state]);

  type PendingTemplate = ArterialLETemplate | CustomTemplate;
  const [pendingTemplate, setPendingTemplate] = useState<PendingTemplate | null>(null);
  const [newCaseOpen, setNewCaseOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [pendingDeleteCustomId, setPendingDeleteCustomId] = useState<string | null>(null);
  const [customTemplates, setCustomTemplates] = useState<ReadonlyArray<CustomTemplate>>(
    () => loadCustomTemplates('arterialLE'),
  );
  const [recentTemplateIds, setRecentTemplateIds] = useState<ReadonlyArray<string>>(
    () => loadRecentTemplateIds('arterialLE'),
  );

  // UX-ANGIO-026 L2 — on a phone a bilateral study shows one leg at a time
  // behind an R/L switch, so each segment is one card with its name printed
  // once. Display-only: `state.view` (saved, used by templates) is untouched,
  // and the other leg's answers stay one tap away.
  const isPhone = useMediaQuery('(max-width: 639px)', false, { getInitialValueInEffect: false });
  const [phoneSide, setPhoneSide] = useState<'right' | 'left'>('right');

  // --- Handlers --------------------------------------------------------------

  const handleViewChange = useCallback((v: string) => {
    dispatch({ type: 'SET_VIEW', view: v as ArterialTableView });
  }, []);

  const handlePhoneSideChange = useCallback((v: string) => {
    setPhoneSide(v === 'left' ? 'left' : 'right');
  }, []);
  const showSideSwitch = isPhone && state.view === 'bilateral';
  const tableView: ArterialTableView = showSideSwitch ? phoneSide : state.view;

  const handleFindingChange = useCallback(
    (id: ArterialLEFullSegmentId, patch: Partial<ArterialSegmentFinding>) => {
      dispatch({ type: 'SET_FINDING', id, patch });
    },
    [],
  );

  const handlePressuresChange = useCallback((next: SegmentalPressures) => {
    dispatch({ type: 'SET_PRESSURES', pressures: next });
  }, []);

  const handleImpressionChange = useCallback((text: string) => {
    dispatch({ type: 'SET_IMPRESSION', impression: text });
  }, []);

  const handleSonographerChange = useCallback((text: string) => {
    dispatch({ type: 'SET_SONOGRAPHER', comments: text });
  }, []);

  const handleClinicianChange = useCallback((text: string) => {
    dispatch({ type: 'SET_CLINICIAN', comments: text });
  }, []);

  const handleRecommendationsChange = useCallback((next: ReadonlyArray<Recommendation>) => {
    dispatch({ type: 'SET_RECOMMENDATIONS', recommendations: next });
  }, []);

  /** Narrow helper — true iff the given template is a built-in (has nameKey). */
  const isBuiltInTemplate = (
    tpl: PendingTemplate,
  ): tpl is ArterialLETemplate =>
    typeof (tpl as ArterialLETemplate).nameKey === 'string';

  const handleTemplateRequest = useCallback((tpl: PendingTemplate) => {
    setPendingTemplate(tpl);
  }, []);

  const handleTemplateConfirm = useCallback(() => {
    if (!pendingTemplate) return;
    if (isBuiltInTemplate(pendingTemplate)) {
      const impression = t(pendingTemplate.impressionKey, pendingTemplate.impressionFallback);
      const sonographer = pendingTemplate.sonographerCommentsKey
        ? t(
            pendingTemplate.sonographerCommentsKey,
            pendingTemplate.sonographerCommentsFallback ?? '',
          )
        : undefined;
      const view: ArterialTableView =
        pendingTemplate.scope === 'bilateral' ? 'bilateral' : pendingTemplate.scope;
      dispatch({
        type: 'APPLY_TEMPLATE',
        findings: pendingTemplate.findings,
        pressures: pendingTemplate.pressures,
        view,
        recommendations: pendingTemplate.recommendations
          ? [...pendingTemplate.recommendations]
          : [],
        impression,
        sonographerComments: sonographer,
      });
      notifications.show({
        title: t('arterialLE.actions.templateApplied', 'Template applied'),
        message: t(pendingTemplate.nameKey, pendingTemplate.nameFallback),
        color: 'blue',
      });
    } else {
      // Custom template — findings/pressures stored as unknown; cast by trust.
      const extras = (pendingTemplate.extras ?? {}) as Readonly<{
        pressures?: SegmentalPressures;
      }>;
      const view: ArterialTableView =
        pendingTemplate.scope === 'bilateral' ? 'bilateral' : pendingTemplate.scope;
      dispatch({
        type: 'APPLY_TEMPLATE',
        findings: pendingTemplate.findings as ArterialSegmentFindings,
        pressures: extras.pressures ?? {},
        view,
        recommendations: pendingTemplate.recommendations
          ? [...pendingTemplate.recommendations]
          : [],
        impression: pendingTemplate.impression ?? '',
        sonographerComments: pendingTemplate.sonographerComments ?? undefined,
      });
      notifications.show({
        title: t('arterialLE.actions.templateApplied', 'Template applied'),
        message: pendingTemplate.name,
        color: 'blue',
      });
    }
    // Push to recent + refresh.
    pushRecentTemplate('arterialLE', pendingTemplate.id);
    setRecentTemplateIds(loadRecentTemplateIds('arterialLE'));
    setPendingTemplate(null);
  }, [pendingTemplate, t]);

  // ---- Gallery open/close ----
  const handleOpenGallery = useCallback(() => setGalleryOpen(true), []);
  const handleCloseGallery = useCallback(() => setGalleryOpen(false), []);

  // ---- Save current as template ----
  const handleOpenSaveDialog = useCallback(() => setSaveDialogOpen(true), []);
  const handleCloseSaveDialog = useCallback(() => setSaveDialogOpen(false), []);

  const handleSaveTemplateSubmit = useCallback(
    (payload: SaveTemplatePayload) => {
      // Map the venous `TemplateKind` to an arterial kind ("normal" works for both;
      // the venous kinds `acute`/`chronic` fall back to `normal` — a save dialog
      // upgrade is tracked in Wave 3).
      const arterialKind: ArterialTemplateKind =
        payload.kind === 'normal' || payload.kind === 'post-procedure'
          ? payload.kind
          : 'normal';
      const scope =
        state.view === 'right' || state.view === 'left' ? state.view : 'bilateral';
      const saved = saveCustomTemplate('arterialLE', {
        name: payload.name,
        description: payload.description,
        kind: arterialKind,
        scope,
        findings: state.findings,
        extras: { pressures: state.pressures },
        recommendations: state.recommendations,
        impression: state.impression,
        sonographerComments: state.sonographerComments,
      });
      setCustomTemplates(loadCustomTemplates('arterialLE'));
      setSaveDialogOpen(false);
      notifications.show({
        title: t('arterialLE.templateGallery.saveSuccessTitle', 'Template saved'),
        message: saved.name,
        color: 'teal',
        autoClose: 2500,
      });
    },
    [
      state.view,
      state.findings,
      state.pressures,
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
    deleteCustomTemplate('arterialLE', pendingDeleteCustomId);
    setCustomTemplates(loadCustomTemplates('arterialLE'));
    setPendingDeleteCustomId(null);
    notifications.show({
      title: t('arterialLE.templateGallery.deleteSuccessTitle', 'Template deleted'),
      message: t(
        'arterialLE.templateGallery.deleteSuccessMessage',
        'The template has been removed from your library.',
      ),
      color: 'teal',
      autoClose: 2500,
    });
  }, [pendingDeleteCustomId, t]);

  const handleNewCaseRequest = useCallback(() => setNewCaseOpen(true), []);
  const handleNewCaseConfirm = useCallback(() => {
    // Phase 3b — encounter-pivot. "+ New case" no longer touches the
    // encounter header (operator/institution/patient identity). It only
    // resets THIS study's findings within the active encounter; the
    // encounter mirror picks up the new shape on the next debounced save.
    dispatch({ type: 'RESET' });
    setNewCaseOpen(false);
    notifications.show({
      title: t('arterialLE.actions.newCaseToastTitle', 'New case started'),
      message: t('arterialLE.actions.newCaseToastMessage', 'All data cleared.'),
      color: 'green',
    });
  }, [t]);

  // --- Auto-impression -------------------------------------------------------
  // Wave 4.6 (Part 03 MEDIUM) — the previous discarded-result useMemo here
  // forced narrative regeneration on every findings/pressures keystroke yet
  // never read the output. Removed; the narrative is computed on demand by
  // the PDF renderer + template-apply path.

  // --- Hotkeys ---------------------------------------------------------------

  useHotkeys([
    ['mod+s', () => saveNow(), { preventDefault: true }],
    ['mod+shift+N', () => handleNewCaseRequest(), { preventDefault: true }],
  ]);

  // --- Render ----------------------------------------------------------------

  const formState = useMemo(() => toFormState(state, encounter), [state, encounter]);

  const arterialColorFn = useCallback(
    (id: string): { fill: string; stroke: string } => {
      const band = arterialCompetencyForSvgId(state.findings, id);
      return severityBandColor(band);
    },
    [state.findings],
  );

  // Click-to-cycle severity (parity with carotid). Advances a manual
  // `competencyOverride` through grey → red → black so a clinician can paint
  // the diagram directly when they haven't filled the segment table yet.
  const handleAnatomySegmentClick = useCallback(
    (id: SegmentId) => {
      if (!id.endsWith('-left') && !id.endsWith('-right')) return;
      const current = arterialCompetencyForSvgId(state.findings, id);
      const next = nextSeverityBand(current);
      // One SVG path can stand for several table rows (PTA/Per/ATA Prox-Mid-Dist).
      for (const fullId of arterialFindingIdsForSvgId(id)) {
        dispatch({ type: 'SET_FINDING', id: fullId, patch: { competencyOverride: next } });
      }
    },
    [state.findings],
  );

  // Drawing handlers — persist freehand strokes into the encounter draft.
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

  // Under-diagram color key — grey / red / black, colored by the
  // same helper the vessels use so legend ↔ diagram agree.
  const arterialLegendItems = useMemo(
    () => severityLegendItems(t, 'arterialLE.severity'),
    [t],
  );

  const handleRunoffChange = useCallback(
    (side: 'left' | 'right', value: Runoff | undefined) => {
      dispatch({ type: 'SET_RUNOFF', side, value });
    },
    [],
  );

  // Non-blocking consistency hints (≥50 % stenosis with triphasic flow, ABI
  // computed from incomplete pressures, etc.). Resolves each warning's i18n
  // param values (segment/side keys) before interpolation.
  const warnings = useMemo(
    () => validateArterial(state.findings, state.pressures),
    [state.findings, state.pressures],
  );
  const warningMessages = useMemo(
    () =>
      warnings.map((w) => {
        const params = w.params
          ? Object.fromEntries(
              Object.entries(w.params).map(([k, v]) => [
                k,
                typeof v === 'string' && v.startsWith('arterialLE.') ? t(v) : v,
              ]),
            )
          : undefined;
        return { id: w.id, text: params ? t(w.key, params) : t(w.key, w.fallback) };
      }),
    [warnings, t],
  );

  const runoffData = useMemo(
    () =>
      RUNOFF_VALUES.map((v) => ({
        value: v,
        label: t(`arterialLE.runoff.${v}`, v),
      })),
    [t],
  );

  // Tooltip status text — the venous Competency enum doesn't apply here, so
  // surface the arterial severity band directly. Without this, AnatomyView
  // would say "Normal" on every segment (Area 01 BLOCKER). i18n keys are
  // optional; falls back to the English band name if missing.
  const arterialTooltipText = useCallback(
    (id: string): string => {
      const band = arterialCompetencyForSvgId(state.findings, id);
      return t(`arterialLE.severity.${band}`, band);
    },
    [state.findings, t],
  );

  // Tooltip NAME line — the shared anatomy.segment.* catalog is venous, so
  // arterial ids (cia/eia/pop-ak/per…) would otherwise read "…vein". Resolve
  // from the arterial study's own segment labels instead.
  const arterialLabelFor = useCallback(
    (id: string): string => {
      const m = id.match(/-(left|right)$/);
      if (!m) return t(`arterialLE.segment.${id}`, id);
      const side = m[1] as 'left' | 'right';
      const base = id.slice(0, id.length - side.length - 1);
      const baseLabel = t(`arterialLE.segment.${base}`, base);
      const sideLabel = t(`arterialLE.side.${side}`, side);
      return `${baseLabel} (${sideLabel})`;
    },
    [t],
  );

  return (
    <div className={classes.wrap}>
      <Stack gap="md">
        <BackToStudiesButton />
        <EncounterContextBanner />

        <Group justify="space-between" wrap="wrap" gap="sm">
          <EMRViewToggle
            value={state.view}
            onChange={handleViewChange}
            alwaysShowLabels
            options={[
              { value: 'right', label: t('arterialLE.tabs.right', 'Right') },
              { value: 'bilateral', label: t('arterialLE.tabs.bilateral', 'Bilateral') },
              { value: 'left', label: t('arterialLE.tabs.left', 'Left') },
            ]}
          />
          <Group gap="xs" wrap="wrap">
            <EMRButton
              variant="secondary"
              size="sm"
              icon={IconStack2}
              onClick={handleOpenGallery}
              data-testid="arterial-template-gallery-trigger"
            >
              {t('arterialLE.templates.menuLabel', 'Templates')}
            </EMRButton>
            {/*
              UX-ANGIO-005 — this RESETS the current study (after a confirm),
              so it is a quiet secondary button that says so, not an
              add-looking one. Red appears only on hover/focus and in the
              confirm (same treatment as the venous form).
            */}
            <EMRButton
              variant="secondary"
              size="sm"
              leftSection={<IconEraser size={15} stroke={1.9} aria-hidden />}
              onClick={handleNewCaseRequest}
              className={classes.clearFormButton}
              data-testid="arterial-new-case-button"
            >
              {t('arterialLE.actions.newCase', 'Clear form')}
            </EMRButton>
          </Group>
        </Group>

        {/*
          UX-ANGIO-015 + 025 L1 — the segment table gets the room its 890px
          grid needs (no inner scroll, plaque/occlusion visible) and the
          diagram it colours sits beside it in a sticky column from 1280px.
          Below 1280px the three stack: pressures → diagram → table.
        */}
        <div className={classes.assessmentLayout}>
          <div className={classes.pressuresArea}>
            <SegmentalPressureTable
              pressures={state.pressures}
              onChange={handlePressuresChange}
            />
          </div>

          <div className={classes.diagramArea} data-testid="arterial-diagram-area">
            <EMRContentSection
              title={t('arterialLE.anatomy.title', 'Arterial anatomy')}
              subtitle={t(
                'arterialLE.anatomy.subtitle',
                'Segment colors reflect severity (normal → occluded).',
              )}
              showAccent={false}
              padding="md"
            >
              <Stack gap="sm">
                <AnatomyDiagramSection
                  view="le-arterial-anterior"
                  drawingColors={STENOSIS_DRAWING_COLORS}
                  drawingColorLabelPrefix="arterialLE.drawingColor"
                  segments={{}}
                  colorFn={arterialColorFn}
                  tooltipText={arterialTooltipText}
                  labelFor={arterialLabelFor}
                  overlay={false}
                  enableSegmentEdit={false}
                  drawings={state.drawings}
                  onSegmentClick={handleAnatomySegmentClick}
                  onCommitStroke={handleCommitStroke}
                  onEraseStroke={handleEraseStroke}
                  onUndo={handleUndoStroke}
                  onClear={handleClearDrawings}
                />
                <AnatomyLegend
                  items={arterialLegendItems}
                  ariaLabel={t('arterialLE.anatomy.legendLabel', 'Stenosis severity legend')}
                />
              </Stack>
            </EMRContentSection>
          </div>

          <div className={classes.tableArea}>
            {showSideSwitch && (
              <div
                className={classes.sideSwitch}
                role="group"
                aria-label={t('arterialLE.segmentTable.sideSwitchLabel', 'Leg shown in the segment table')}
              >
                {/* Options carry the same R / L side chips as the segment
                    cards (the full side name stays the accessible name);
                    the chosen leg is solid --emr-primary, not the gradient. */}
                <div className={classes.sideSegments} data-testid="arterial-phone-side-toggle">
                  {(['right', 'left'] as const).map((side) => {
                    const active = phoneSide === side;
                    return (
                      <UnstyledButton
                        key={side}
                        className={classes.sideSegment}
                        data-active={active || undefined}
                        aria-pressed={active}
                        aria-label={
                          side === 'right'
                            ? t('arterialLE.tabs.right', 'Right')
                            : t('arterialLE.tabs.left', 'Left')
                        }
                        onClick={() => handlePhoneSideChange(side)}
                        data-testid={`arterial-phone-side-toggle-${side}`}
                      >
                        <span className={classes.sideSegmentChip} data-side={side} aria-hidden>
                          {side === 'right' ? 'R' : 'L'}
                        </span>
                      </UnstyledButton>
                    );
                  })}
                </div>
              </div>
            )}
            <ArterialSegmentTable
              findings={state.findings}
              view={tableView}
              onFindingChange={handleFindingChange}
            />
          </div>
        </div>

        {warningMessages.length > 0 && (
          <EMRAlert
            variant="warning"
            icon={<IconAlertTriangle size={18} />}
            title={t('arterialLE.validation.title', 'Check these findings')}
            data-testid="arterial-warnings"
          >
            <Stack gap={4}>
              {warningMessages.map((w) => (
                <Text key={w.id} size="sm">
                  {w.text}
                </Text>
              ))}
            </Stack>
          </EMRAlert>
        )}

        <EMRContentSection
          title={t('arterialLE.runoff.title', 'Distal run-off')}
          subtitle={t('arterialLE.runoff.subtitle', 'Tibial-vessel patency summary per side.')}
          showAccent={false}
          padding="md"
        >
          <Group grow align="flex-start" wrap="wrap">
            <EMRSelect
              label={t('arterialLE.tabs.right', 'Right')}
              value={state.runoff.right ?? ''}
              onChange={(v) => handleRunoffChange('right', v === '' ? undefined : (v as Runoff))}
              data={runoffData}
              clearable
              size="sm"
              data-testid="arterial-runoff-right"
            />
            <EMRSelect
              label={t('arterialLE.tabs.left', 'Left')}
              value={state.runoff.left ?? ''}
              onChange={(v) => handleRunoffChange('left', v === '' ? undefined : (v as Runoff))}
              data={runoffData}
              clearable
              size="sm"
              data-testid="arterial-runoff-left"
            />
          </Group>
        </EMRContentSection>

        <Stack gap="sm" className={classes.textSection}>
          <EMRTextarea
            label={t('arterialLE.narrative.impression', 'Impression')}
            value={state.impression}
            onChange={handleImpressionChange}
            autosize
            minRows={4}
            data-testid="arterial-impression"
          />
          {state.impressionStale && (
            <EMRAlert
              variant="info"
              title={t('common.impressionStale.title', 'Findings changed after this conclusion was written')}
              withCloseButton
              onClose={() => handleImpressionChange(state.impression)}
              data-testid="arterial-impression-stale"
            >
              {t('common.impressionStale.body', 'Please review the conclusion. Close this note to keep it as it is.')}
            </EMRAlert>
          )}
          <EMRTextarea
            label={t('arterialLE.narrative.sonographerComments', 'Sonographer comments')}
            value={state.sonographerComments}
            onChange={handleSonographerChange}
            autosize
            minRows={2}
            data-testid="arterial-sonographer"
          />
          <EMRTextarea
            label={t('arterialLE.narrative.clinicianComments', 'Clinician comments')}
            value={state.clinicianComments}
            onChange={handleClinicianChange}
            autosize
            minRows={2}
            data-testid="arterial-clinician"
          />
        </Stack>

        <RecommendationsBlock
          items={state.recommendations}
          onChange={handleRecommendationsChange}
        />

        <FormActions
          form={formState}
          onSaveDraft={saveNow}
          baseFilename={`arterial-le-${state.studyDate || encounter?.header.encounterDate || 'report'}`}
        />
      </Stack>

      <ConfirmDialog
        opened={pendingTemplate !== null}
        onClose={() => setPendingTemplate(null)}
        title={t('arterialLE.actions.applyTemplateConfirmTitle', 'Apply template?')}
        message={t(
          'arterialLE.actions.applyTemplateConfirmBody',
          'This will replace current findings, pressures, impression, and recommendations.',
        )}
        confirmLabel={t('arterialLE.actions.applyTemplate', 'Apply template')}
        cancelLabel={t('arterialLE.actions.cancel', 'Cancel')}
        onConfirm={handleTemplateConfirm}
      />

      <ConfirmDialog
        opened={newCaseOpen}
        onClose={() => setNewCaseOpen(false)}
        title={t('arterialLE.actions.newCaseConfirmTitle', 'Clear this form?')}
        message={
          // UX-ANGIO-005 L3 — bold first line names whose study is erased.
          <>
            <Text fw={700} component="span" display="block" data-testid="arterial-new-case-confirm-patient">
              {[encounter?.header.patientName, t('studies.arterialLE.short', 'Arterial LE')]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            <Text component="span" display="block">
              {t(
                'arterialLE.actions.newCaseConfirmBody',
                'This will erase all current data. Unsaved changes will be lost.',
              )}
            </Text>
          </>
        }
        confirmLabel={t('arterialLE.actions.newCaseConfirm', 'Clear form')}
        cancelLabel={t('arterialLE.actions.cancel', 'Cancel')}
        onConfirm={handleNewCaseConfirm}
        destructive
      />

      <ArterialTemplateGallery
        opened={galleryOpen}
        onClose={handleCloseGallery}
        onApply={handleTemplateRequest}
        onSaveCurrentAsTemplate={handleOpenSaveDialog}
        customTemplates={customTemplates}
        recentTemplateIds={recentTemplateIds}
        onDeleteCustom={handleRequestDeleteCustom}
      />

      <SaveTemplateDialog
        opened={saveDialogOpen}
        onClose={handleCloseSaveDialog}
        onSubmit={handleSaveTemplateSubmit}
      />

      <ConfirmDialog
        opened={pendingDeleteCustomId !== null}
        onClose={handleCancelDeleteCustom}
        title={t('arterialLE.templateGallery.deleteConfirmTitle', 'Delete template?')}
        message={t(
          'arterialLE.templateGallery.deleteConfirmBody',
          'This template will be removed from your library. This cannot be undone.',
        )}
        confirmLabel={t('arterialLE.templateGallery.deleteConfirm', 'Delete')}
        cancelLabel={t('arterialLE.actions.cancel', 'Cancel')}
        onConfirm={handleConfirmDeleteCustom}
        destructive
      />
    </div>
  );
});

export default ArterialLEForm;
