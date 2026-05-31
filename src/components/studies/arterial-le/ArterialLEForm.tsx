// SPDX-License-Identifier: Apache-2.0
/**
 * ArterialLEForm — Phase 2 orchestrator for bilateral lower-extremity
 * arterial duplex reporting.
 *
 * Layout (desktop):
 *   ┌─ EncounterContextBanner ──────────────────────────┐
 *   ├─ SegmentalPressureTable ──┬─ ArterialSegmentTable ┤
 *   ├─ ImpressionBlock ─────────────────────────────────┤
 *   ├─ RecommendationsBlock ────────────────────────────┤
 *   └─ FormActions (sticky) ────────────────────────────┘
 *
 * Phase 3b (encounter pivot) — patient + visit identity now lives on the
 * `EncounterContext`; this reducer carries only the per-study clinical
 * fields (studyDate/studyTime/accessionNumber/cptCode/patientPosition/
 * quality, plus findings/pressures/narrative/recommendations). Per-study
 * state is mirrored into `encounter.studies.arterialLE` (debounced 500 ms)
 * so the encounter draft is the single source of truth.
 */

import { memo, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Alert, Grid, Stack, Group, Paper, SegmentedControl, Text, Textarea, Title } from '@mantine/core';
import { EMRSelect } from '../../shared/EMRFormFields';
import { AnatomyDiagramSection } from '../../anatomy/AnatomyDiagramSection';
import { AnatomyLegend } from '../../anatomy';
import { severityBandColor, severityLegendItems } from '../../anatomy/severityColor';
import type { SegmentId } from '../../../types/anatomy';
import type { DrawingStroke } from '../../../types/drawing';
import { useHotkeys } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconAlertTriangle, IconPlus, IconStack2 } from '@tabler/icons-react';
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
import { ConfirmDialog, EMRButton } from '../../common';
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
import { deriveArterialCompetency, RUNOFF_VALUES } from './config';
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
      return { ...state, findings: { ...state.findings, [action.id]: merged } };
    }
    case 'SET_PRESSURES':
      return { ...state, pressures: action.pressures };
    case 'SET_RUNOFF':
      return { ...state, runoff: { ...state.runoff, [action.side]: action.value } };
    case 'SET_IMPRESSION':
      return { ...state, impression: action.impression, impressionEdited: true };
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
  // `encounter.studies.arterialLE`. We debounce to 500ms so a burst of
  // findings/pressures keystrokes isn't 1:1 with `saveEncounter` calls.
  // The `setStudyState` callback is stable across renders (memoised inside
  // the context), so the effect's dependency list is keystroke + state.
  const lastSavedAtRef = useRef<Date | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  // Skip the very first effect run so we don't re-mirror the freshly-hydrated
  // state back into the encounter (it was just read from there).
  const isFirstMirrorRun = useRef(true);

  useEffect(() => {
    if (!encounter) return;
    if (isFirstMirrorRun.current) {
      isFirstMirrorRun.current = false;
      return;
    }
    setHasUnsavedChanges(true);
    const handle = setTimeout(() => {
      setStudyState<ArterialFormStateV2>('arterialLE', state);
      const now = new Date();
      lastSavedAtRef.current = now;
      setLastSavedAt(now);
      setHasUnsavedChanges(false);
    }, 500);
    return () => clearTimeout(handle);
  }, [encounter, setStudyState, state]);

  const saveNow = useCallback(() => {
    if (!encounter) return;
    setStudyState<ArterialFormStateV2>('arterialLE', state);
    const now = new Date();
    lastSavedAtRef.current = now;
    setLastSavedAt(now);
    setHasUnsavedChanges(false);
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

  // --- Handlers --------------------------------------------------------------

  const handleViewChange = useCallback((v: string) => {
    dispatch({ type: 'SET_VIEW', view: v as ArterialTableView });
  }, []);

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
      const finding = state.findings[id as ArterialLEFullSegmentId];
      const band = deriveArterialCompetency(finding);
      return severityBandColor(band);
    },
    [state.findings],
  );

  // Click-to-cycle severity (parity with carotid). Advances a manual
  // `competencyOverride` through the 5 stenosis bands so a clinician can paint
  // the diagram directly when they haven't filled the segment table yet.
  const handleAnatomySegmentClick = useCallback(
    (id: SegmentId) => {
      if (!id.endsWith('-left') && !id.endsWith('-right')) return;
      const fullId = id as ArterialLEFullSegmentId;
      const current = deriveArterialCompetency(state.findings[fullId]);
      const cycle = ['normal', 'mild', 'moderate', 'severe', 'occluded'] as const;
      const next = cycle[(cycle.indexOf(current) + 1) % cycle.length] ?? 'normal';
      dispatch({ type: 'SET_FINDING', id: fullId, patch: { competencyOverride: next } });
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

  // Under-diagram color key — the 5 stenosis-severity bands, colored by the
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
      const finding = state.findings[id as ArterialLEFullSegmentId];
      const band = deriveArterialCompetency(finding);
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
          <SegmentedControl
            value={state.view}
            onChange={handleViewChange}
            data={[
              { value: 'right', label: t('arterialLE.tabs.right', 'Right') },
              { value: 'bilateral', label: t('arterialLE.tabs.bilateral', 'Bilateral') },
              { value: 'left', label: t('arterialLE.tabs.left', 'Left') },
            ]}
          />
          <Group gap="xs">
            <EMRButton
              variant="secondary"
              size="sm"
              icon={IconStack2}
              onClick={handleOpenGallery}
              data-testid="arterial-template-gallery-trigger"
            >
              {t('arterialLE.templates.menuLabel', 'Templates')}
            </EMRButton>
            <button
              type="button"
              className={classes.newCaseButton}
              onClick={handleNewCaseRequest}
              aria-label={t('arterialLE.actions.newCase', '+ New case')}
            >
              <IconPlus size={16} />
              <span>{t('arterialLE.actions.newCase', '+ New case')}</span>
            </button>
          </Group>
        </Group>

        <Grid gutter="md" align="stretch">
          <Grid.Col span={{ base: 12, lg: 5 }}>
            <SegmentalPressureTable
              pressures={state.pressures}
              onChange={handlePressuresChange}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, lg: 7 }}>
            <ArterialSegmentTable
              findings={state.findings}
              view={state.view}
              onFindingChange={handleFindingChange}
            />
          </Grid.Col>
        </Grid>

        {warningMessages.length > 0 && (
          <Alert
            variant="light"
            color="yellow"
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
          </Alert>
        )}

        <Paper withBorder radius="md" shadow="sm" p="md">
          <Stack gap="sm">
            <div>
              <Title order={5} mb={2}>
                {t('arterialLE.runoff.title', 'Distal run-off')}
              </Title>
              <Text size="sm" c="dimmed">
                {t('arterialLE.runoff.subtitle', 'Tibial-vessel patency summary per side.')}
              </Text>
            </div>
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
          </Stack>
        </Paper>

        <Paper withBorder radius="md" shadow="sm" p="md">
          <Stack gap="sm">
            <div>
              <Title order={5} mb={2}>
                {t('arterialLE.anatomy.title', 'Arterial anatomy')}
              </Title>
              <Text size="sm" c="dimmed">
                {t(
                  'arterialLE.anatomy.subtitle',
                  'Segment colors reflect severity (normal → occluded).',
                )}
              </Text>
            </div>
            <AnatomyDiagramSection
              view="le-arterial-anterior"
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
        </Paper>

        <Stack gap="sm" className={classes.textSection}>
          <Textarea
            label={t('arterialLE.narrative.impression', 'Impression')}
            value={state.impression}
            onChange={(e) => handleImpressionChange(e.currentTarget.value)}
            autosize
            minRows={4}
            data-testid="arterial-impression"
          />
          <Textarea
            label={t('arterialLE.narrative.sonographerComments', 'Sonographer comments')}
            value={state.sonographerComments}
            onChange={(e) => handleSonographerChange(e.currentTarget.value)}
            autosize
            minRows={2}
            data-testid="arterial-sonographer"
          />
          <Textarea
            label={t('arterialLE.narrative.clinicianComments', 'Clinician comments')}
            value={state.clinicianComments}
            onChange={(e) => handleClinicianChange(e.currentTarget.value)}
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
          lastSavedAt={lastSavedAt}
          hasUnsavedChanges={hasUnsavedChanges}
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
        title={t('arterialLE.actions.newCaseConfirmTitle', 'Start a new case?')}
        message={t(
          'arterialLE.actions.newCaseConfirmBody',
          'This will erase all current data. Unsaved changes will be lost.',
        )}
        confirmLabel={t('arterialLE.actions.newCaseConfirm', 'Discard & start new')}
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
