// SPDX-License-Identifier: Apache-2.0
/**
 * VenousLEForm — Phase 1 orchestrator for the bilateral lower-extremity
 * venous duplex report.
 *
 * Layout (desktop):
 *
 *   ┌────────────────────────── StudyHeader ────────────────────────────┐
 *   │                                                                   │
 *   ├──────────────────┬────────────────────────────────────────────────┤
 *   │  AnatomyView L/R │  SegmentTable (tabs: Right | Left | Bilateral) │
 *   │  (live recolor)  │  20 rows × 5 categorical columns               │
 *   ├──────────────────┴────────────────────────────────────────────────┤
 *   │  ReflexTimeTable — numeric ms / AP / depth                         │
 *   ├───────────────────────────────────────────────────────────────────┤
 *   │  ImpressionBlock — auto-generated + editable                      │
 *   ├───────────────────────────────────────────────────────────────────┤
 *   │  CEAPPicker (collapsed)                                           │
 *   ├───────────────────────────────────────────────────────────────────┤
 *   │  RecommendationsBlock                                             │
 *   ├───────────────────────────────────────────────────────────────────┤
 *   │ FormActions — sticky footer                                       │
 *   └───────────────────────────────────────────────────────────────────┘
 *
 * State lives in a single useReducer keyed off `FormState`. A memoized
 * findings map drives the anatomy diagram coloring via `deriveCompetency`.
 */

import { memo, useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { Box, Grid, SimpleGrid, Stack, Text } from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconPlus } from '@tabler/icons-react';
import { useTranslation } from '../../../contexts/TranslationContext';
import { AnatomyView, AnatomyLegend } from '../../anatomy';
import type { Competency, SegmentId } from '../../../types/anatomy';
import type { CeapClassification } from '../../../types/ceap';
import type { FormState, Recommendation, StudyHeader as StudyHeaderShape } from '../../../types/form';
import { useAutoSave, loadDraft } from '../../../hooks/useAutoSave';
import { ConfirmDialog } from '../../common';
import { StudyHeader, type StudyHeaderValue } from '../../form/StudyHeader';
import { BackToStudiesButton } from '../../layout/BackToStudiesButton';
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

interface VenousFormStateV1 {
  readonly studyType: 'venousLEBilateral';
  readonly header: StudyHeaderValue;
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
}

const STUDY_ID = 'venousLEBilateral';
const TODAY_ISO = new Date().toISOString().slice(0, 10);

const DEFAULT_CPT = defaultCptForStudy('venousLEBilateral');

const INITIAL_STATE: VenousFormStateV1 = {
  studyType: 'venousLEBilateral',
  header: {
    patientName: '',
    studyDate: TODAY_ISO,
    // Default CPT matches the study type; user can override.
    cptCode: { code: DEFAULT_CPT.code, display: cptDisplay(DEFAULT_CPT, 'en') },
  },
  findings: {},
  view: 'right',
  impression: '',
  impressionEdited: false,
  ceap: undefined,
  recommendations: [],
  sonographerComments: '',
  clinicianComments: '',
};

// ============================================================================
// Reducer
// ============================================================================

type Action =
  | { type: 'SET_HEADER'; value: StudyHeaderValue }
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
  | { type: 'HYDRATE'; value: VenousFormStateV1 };

function reducer(state: VenousFormStateV1, action: Action): VenousFormStateV1 {
  switch (action.type) {
    case 'HYDRATE':
      return { ...action.value };
    case 'SET_HEADER':
      return { ...state, header: action.value };
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
            spontaneity: 'normal',
            phasicity: 'normal',
            augmentation: 'normal',
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
      };
    }
    case 'RESET':
      // Return a fresh shallow clone of INITIAL_STATE so template-like
      // shared object references (e.g. cptCode) don't leak across resets.
      // Explicitly clear impression + sonographerComments + clinicianComments
      // so no stale template prose survives a "New case" click.
      return {
        ...INITIAL_STATE,
        header: { ...INITIAL_STATE.header },
        findings: {},
        recommendations: [],
        impression: '',
        impressionEdited: false,
        sonographerComments: '',
        clinicianComments: '',
        ceap: undefined,
        view: 'right',
      };
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

// ============================================================================
// FHIR FormState projection (for PDF + JSON export)
// ============================================================================

function stateToFormState(s: VenousFormStateV1): FormState {
  const headerOut: StudyHeaderShape = {
    patientName: s.header.patientName,
    patientId: s.header.patientId,
    patientBirthDate: s.header.patientBirthDate,
    patientGender: s.header.patientGender,
    studyDate: s.header.studyDate,
    operatorName: s.header.operatorName,
    referringPhysician: s.header.referringPhysician,
    institution: s.header.institution,
    accessionNumber: s.header.accessionNumber,
    informedConsent: s.header.informedConsent,
    informedConsentSignedAt: s.header.informedConsentSignedAt,
    patientPosition: s.header.patientPosition,
    medications: s.header.medications,
    icd10Codes: s.header.icd10Codes,
    cptCode: s.header.cptCode,
  };
  return {
    studyType: 'venousLEBilateral',
    header: headerOut,
    narrative: {
      indication: s.header.indication,
      impression: s.impression,
      sonographerComments: s.sonographerComments || undefined,
      clinicianComments: s.clinicianComments || undefined,
    },
    segments: [],
    recommendations: s.recommendations,
    ceap: s.ceap,
    // Findings travel as a JSON-stringifiable object on the loose parameter bag.
    // The `parameters` record is typed for primitives; fhirBuilder narrows it back.
    parameters: {
      segmentFindings: s.findings,
    } as unknown as Record<string, string | number | boolean | undefined>,
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
// Main component
// ============================================================================

type AnyTemplate = VenousLETemplate | CustomTemplate;

function isBuiltInTemplate(tpl: AnyTemplate): tpl is VenousLETemplate {
  return 'nameFallback' in tpl;
}

export const VenousLEForm = memo(function VenousLEForm(): React.ReactElement {
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
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

  // Hydrate from draft on mount (one-shot).
  useEffect(() => {
    const draft = loadDraft<VenousFormStateV1>(STUDY_ID);
    if (draft && draft.studyType === 'venousLEBilateral') {
      dispatch({ type: 'HYDRATE', value: draft });
    }
  }, []);

  // Auto-save.
  const { lastSavedAt, hasUnsavedChanges, saveNow, clearDraft: clearAutoSaveDraft } =
    useAutoSave<VenousFormStateV1>(STUDY_ID, state, { debounceMs: 1500 });

  // Derived anatomy segment map (memoized — only recomputes when findings change).
  const competencyMap = useMemo(() => competencyMapFromFindings(state.findings), [state.findings]);

  // ---------------- Callbacks ----------------

  const handleHeader = useCallback((v: StudyHeaderValue) => {
    dispatch({ type: 'SET_HEADER', value: v });
  }, []);

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

  const handleBack = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.location.pathname = '/';
    }
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
    dispatch({ type: 'RESET' });
    clearAutoSaveDraft();
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
  }, [clearAutoSaveDraft, t]);

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

  // Project to FormState for FHIR/PDF.
  const formState = useMemo(() => stateToFormState(state), [state]);

  // Filename for exports.
  const baseFilename = useMemo(() => {
    const patient = (state.header.patientName || 'patient').replace(/\s+/g, '-');
    const date = state.header.studyDate || TODAY_ISO;
    return `venous-le-${patient}-${date}`;
  }, [state.header.patientName, state.header.studyDate]);

  // Highlight → single anatomy `highlightId` (anatomy only accepts one).
  const anatomyHighlight = highlightId ?? null;
  const highlightedBase = baseFromFullId(anatomyHighlight);
  void highlightedBase; // reserved for future use (e.g. segment detail popover)

  return (
    <div className={classes.page}>
      <div className={classes.crumbs}>
        <div className={classes.crumbsLeft}>
          <button
            type="button"
            className={classes.backButton}
            onClick={handleBack}
            aria-label={t('venousLE.actions.backToStudies')}
          >
            ← {t('venousLE.actions.backToStudies')}
          </button>
          <Text className={classes.crumbsTitle}>{t('venousLE.title')}</Text>
        </div>
        <button
          type="button"
          className={classes.newCaseButton}
          onClick={handleNewCaseRequest}
          aria-label={t('venousLE.actions.newCase', '+ New case')}
          data-testid="new-case-button"
        >
          <IconPlus size={14} stroke={2.25} />
          <span>{t('venousLE.actions.newCase', '+ New case')}</span>
        </button>
      </div>

      <div className={classes.container}>
        <Stack gap="md">
          <BackToStudiesButton />
          <StudyHeader value={state.header} onChange={handleHeader} />

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
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <Stack gap={4} align="center">
                  <Text className={classes.anatomyViewLabel}>
                    {t('anatomy.view.le-anterior', 'Anterior view')}
                  </Text>
                  <AnatomyView
                    view="le-anterior"
                    segments={competencyMap}
                    size="md"
                    onSegmentClick={handleAnatomySegmentClick}
                    highlightId={anatomyHighlight}
                  />
                </Stack>
                <Stack gap={4} align="center">
                  <Text className={classes.anatomyViewLabel}>
                    {t('anatomy.view.le-posterior', 'Posterior view')}
                  </Text>
                  <AnatomyView
                    view="le-posterior"
                    segments={competencyMap}
                    size="md"
                    onSegmentClick={handleAnatomySegmentClick}
                    highlightId={anatomyHighlight}
                  />
                </Stack>
              </SimpleGrid>
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

      <FormActions
        form={formState}
        lastSavedAt={lastSavedAt}
        hasUnsavedChanges={hasUnsavedChanges}
        onSaveDraft={saveNow}
        baseFilename={baseFilename}
      />

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
