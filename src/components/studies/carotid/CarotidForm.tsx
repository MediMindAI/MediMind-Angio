// SPDX-License-Identifier: Apache-2.0
/**
 * CarotidForm — bilateral carotid-vertebral-subclavian duplex container.
 *
 * Layout (Phase 3b — encounter pivot):
 *   EncounterContextBanner · SegmentedControl (view) · CarotidSegmentTable ·
 *   NASCETPicker · Impression/Sonographer/Clinician textareas ·
 *   RecommendationsBlock · FormActions.
 *
 * Phase 3b refactor:
 *   - Drops the legacy `<StudyHeader>` card. Encounter-level fields
 *     (patient identity + visit context) come from `useEncounter()`; only
 *     study-clinical scalars (studyDate, studyTime, accessionNumber,
 *     cptCode, patientPosition, quality) live in this reducer.
 *   - `RESET` no longer takes a header — all encounter fields are
 *     untouched by per-study reset.
 *   - `toFormState(state, encounter)` merges encounter header with
 *     per-study scalars to assemble the FHIR-ready FormState.
 *   - Persistence: `useEncounter().setStudyState('carotid', state)` so
 *     the encounter draft is the single source of truth (option a in the
 *     phase brief). Legacy per-study draft key (`'carotid'`) remains a
 *     read-fallback on first hydration for back-compat.
 */

import { memo, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Stack, Group, Paper, SegmentedControl, Text, Textarea, Title } from '@mantine/core';
import { AnatomyView } from '../../anatomy/AnatomyView';
import { SEVERITY_COLORS } from '../../../constants/theme-colors';
import { useHotkeys } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconStack2 } from '@tabler/icons-react';
import { useTranslation } from '../../../contexts/TranslationContext';
import { useEncounter } from '../../../contexts/EncounterContext';
import type {
  CptCode,
  FormState,
  Recommendation,
  StudyHeader as StudyHeaderShape,
} from '../../../types/form';
import type { PatientPosition } from '../../../types/patient-position';
import type { EncounterDraft } from '../../../types/encounter';
import { loadDraft } from '../../../hooks/useAutoSave';
import { ConfirmDialog, EMRButton } from '../../common';
import { EncounterContextBanner } from '../../layout/EncounterContextBanner';
import { BackToStudiesButton } from '../../layout/BackToStudiesButton';
import { RecommendationsBlock } from '../../form/RecommendationsBlock';
import { FormActions } from '../../form/FormActions';
import { SaveTemplateDialog, type SaveTemplatePayload } from '../../form/SaveTemplateDialog';
import { defaultCptForStudy, cptDisplay } from '../../../constants/vascular-cpt';
import {
  loadCustomTemplates,
  loadRecentTemplateIds,
  pushRecentTemplate,
  saveCustomTemplate,
  deleteCustomTemplate,
  type CustomTemplate,
} from '../../../services/customTemplatesService';
import type {
  CarotidFindings,
  CarotidNascetClassification,
  CarotidVesselFinding,
  CarotidVesselFullId,
} from './config';
import { deriveCarotidCompetency } from './config';
import { CarotidSegmentTable, type CarotidTableView } from './CarotidSegmentTable';
import { NASCETPicker } from './NASCETPicker';
import { type CarotidTemplate, type CarotidTemplateKind } from './templates';
import { CarotidTemplateGallery } from './CarotidTemplateGallery';
import classes from './CarotidForm.module.css';

const STUDY_ID = 'carotid';

/**
 * Image-quality enum mirrors the venous-LE StudyHeader options. Phase 5
 * will fold this into a shared per-study type once `StudyHeader` shrinks;
 * scoping it here keeps the Phase 3b diff surgical.
 */
type StudyQuality = 'excellent' | 'good' | 'suboptimal' | 'limited';

/**
 * Per-study scalar fields — encounter-level identity/visit-context lives
 * on `EncounterHeader` and reaches FHIR via `useEncounter()` in
 * `toFormState`. Each per-study key is optional to keep migrations from
 * legacy drafts (which never persisted these locally) safe.
 */
interface CarotidStudyFields {
  /** ISO YYYY-MM-DD; defaults to encounter date when omitted. */
  readonly studyDate?: string;
  readonly studyTime?: string;
  readonly accessionNumber?: string;
  readonly cptCode?: CptCode;
  readonly patientPosition?: PatientPosition;
  readonly quality?: StudyQuality;
}

interface CarotidFormStateV2 extends CarotidStudyFields {
  /**
   * Phase 3b (encounter pivot) bumped this from V1 to V2: the previous
   * shape carried a full `header: StudyHeaderValue` slot that the
   * encounter pivot moved up to `EncounterContext`. A stale V1 draft must
   * NOT silently hydrate as V2 — `isHydratableCarotidState` enforces the
   * `schemaVersion === 2` check below.
   *
   * Wave 3.2 (Part 03 MEDIUM) introduced the runtime schema field; Phase
   * 3b bumps the value because the shape changed incompatibly.
   */
  readonly schemaVersion: 2;
  readonly studyType: 'carotid';
  readonly findings: CarotidFindings;
  readonly nascet: CarotidNascetClassification;
  readonly view: CarotidTableView;
  readonly impression: string;
  readonly impressionEdited: boolean;
  readonly sonographerComments: string;
  readonly clinicianComments: string;
  readonly recommendations: ReadonlyArray<Recommendation>;
}

type Action =
  | { type: 'SET_STUDY_FIELD'; patch: Partial<CarotidStudyFields> }
  | { type: 'SET_VIEW'; view: CarotidTableView }
  | { type: 'SET_FINDING'; id: CarotidVesselFullId; patch: Partial<CarotidVesselFinding> }
  | { type: 'SET_NASCET'; nascet: CarotidNascetClassification }
  | { type: 'SET_IMPRESSION'; impression: string }
  | { type: 'SET_SONOGRAPHER'; comments: string }
  | { type: 'SET_CLINICIAN'; comments: string }
  | { type: 'SET_RECOMMENDATIONS'; recommendations: ReadonlyArray<Recommendation> }
  | {
      type: 'APPLY_TEMPLATE';
      findings: CarotidFindings;
      nascet: CarotidNascetClassification;
      view: CarotidTableView;
      recommendations: ReadonlyArray<Recommendation>;
      impression: string;
    }
  | { type: 'RESET' }
  | { type: 'HYDRATE'; state: CarotidFormStateV2 };

function defaultCarotidCpt(): CptCode {
  const cpt = defaultCptForStudy('carotid');
  return { code: cpt.code, display: cptDisplay(cpt, 'en') };
}

function initialState(): CarotidFormStateV2 {
  return {
    schemaVersion: 2,
    studyType: 'carotid',
    studyDate: new Date().toISOString().slice(0, 10),
    cptCode: defaultCarotidCpt(),
    findings: {},
    nascet: {},
    view: 'bilateral',
    impression: '',
    impressionEdited: false,
    sonographerComments: '',
    clinicianComments: '',
    recommendations: [],
  };
}

function reducer(state: CarotidFormStateV2, action: Action): CarotidFormStateV2 {
  switch (action.type) {
    case 'SET_STUDY_FIELD':
      return { ...state, ...action.patch };
    case 'SET_VIEW':
      return { ...state, view: action.view };
    case 'SET_FINDING': {
      const prev = state.findings[action.id] ?? {};
      return {
        ...state,
        findings: { ...state.findings, [action.id]: { ...prev, ...action.patch } },
      };
    }
    case 'SET_NASCET':
      return { ...state, nascet: action.nascet };
    case 'SET_IMPRESSION':
      return { ...state, impression: action.impression, impressionEdited: true };
    case 'SET_SONOGRAPHER':
      return { ...state, sonographerComments: action.comments };
    case 'SET_CLINICIAN':
      return { ...state, clinicianComments: action.comments };
    case 'SET_RECOMMENDATIONS':
      return { ...state, recommendations: action.recommendations };
    case 'APPLY_TEMPLATE':
      return {
        ...state,
        findings: { ...action.findings },
        nascet: { ...action.nascet },
        view: action.view,
        impression: action.impression,
        impressionEdited: true,
        recommendations: [...action.recommendations],
        // Wave 3.1 (Part 10 HIGH) — always reset clinicianComments so an
        // interpretation typed for a previous patient cannot silently leak
        // into the next case when a clinician picks a template.
        clinicianComments: '',
      };
    case 'RESET':
      // Phase 3b — no header argument. Encounter-level fields stay
      // untouched (they live in EncounterContext); per-study fields reset
      // to their defaults via `initialState()`.
      return { ...initialState() };
    case 'HYDRATE':
      return action.state;
    default: {
      // Wave 3.7 (Part 03 HIGH) — exhaustiveness check. If a new Action member
      // is added without a corresponding case here, TypeScript will fail
      // compilation on this assignment, preventing silent no-ops.
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

/**
 * Run-time guard for hydration — accepts both the new (Phase 3b) shape and
 * legacy V1 drafts that still carry a `header` field. Legacy `header`
 * fields are stripped here so encounter-level data in a stale per-study
 * draft cannot override the live encounter context.
 */
function isHydratableCarotidState(value: unknown): value is CarotidFormStateV2 {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<CarotidFormStateV2>;
  return v.schemaVersion === 2 && v.studyType === 'carotid';
}

function normalizeHydratedState(raw: CarotidFormStateV2): CarotidFormStateV2 {
  // Strip a legacy `header` field if it slipped through from a pre-pivot
  // draft — it has no place in the new state shape and would leak stale
  // patient identity if an upstream consumer ever spread the state.
  const legacy = raw as CarotidFormStateV2 & { header?: unknown };
  if ('header' in legacy) {
    const { header: _legacyHeader, ...rest } = legacy;
    void _legacyHeader;
    return { ...initialState(), ...(rest as Partial<CarotidFormStateV2>) } as CarotidFormStateV2;
  }
  return raw;
}

function toFormState(s: CarotidFormStateV2, encounter: EncounterDraft | null): FormState {
  // Encounter-level identity + visit context come from the encounter; the
  // per-study reducer only contributes scalar overrides (studyDate,
  // accessionNumber, cptCode, patientPosition, etc). The cast to
  // StudyHeaderShape is preserved so studyTime / quality (which Phase 5
  // will add to StudyHeader proper) flow through without surfacing in
  // the shrunk-but-not-yet type.
  const encounterHeader = encounter?.header;
  const composed = {
    patientName: encounterHeader?.patientName ?? '',
    patientId: encounterHeader?.patientId,
    patientBirthDate: encounterHeader?.patientBirthDate,
    patientGender: encounterHeader?.patientGender,
    operatorName: encounterHeader?.operatorName,
    referringPhysician: encounterHeader?.referringPhysician,
    institution: encounterHeader?.institution,
    medications: encounterHeader?.medications,
    informedConsent: encounterHeader?.informedConsent,
    informedConsentSignedAt: encounterHeader?.informedConsentSignedAt,
    icd10Codes: encounterHeader?.icd10Codes,
    studyDate: s.studyDate ?? encounterHeader?.encounterDate ?? '',
    studyTime: s.studyTime,
    accessionNumber: s.accessionNumber,
    cptCode: s.cptCode,
    patientPosition: s.patientPosition,
    quality: s.quality,
  };
  return {
    studyType: 'carotid',
    header: composed as StudyHeaderShape,
    segments: [],
    narrative: {
      impression: s.impression,
      sonographerComments: s.sonographerComments,
      clinicianComments: s.clinicianComments,
    },
    recommendations: s.recommendations,
    parameters: {
      // Wave 2.5: `parameters` is now `Record<string, unknown>` so the per-study
      // payload (`CarotidFormParameters`) flows through without casts.
      segmentFindings: s.findings,
      nascet: s.nascet,
    },
  };
}

export const CarotidForm = memo(function CarotidForm(): React.ReactElement {
  const { t } = useTranslation();
  const { encounter, setStudyState } = useEncounter();

  const [state, dispatch] = useReducer(reducer, undefined, () => {
    // Phase 3b hydration order:
    //   1. encounter.studies.carotid (the new source of truth)
    //   2. legacy per-study draft under `'carotid'` key (back-compat for
    //      drafts created before the encounter pivot landed)
    //   3. fresh initialState
    // Both sources are validated against schemaVersion + studyType so a
    // stale shape can't silently render wrong data.
    const fromEncounter = encounter?.studies?.carotid;
    if (isHydratableCarotidState(fromEncounter)) {
      return normalizeHydratedState(fromEncounter);
    }
    const persisted = loadDraft<CarotidFormStateV2>(STUDY_ID);
    if (isHydratableCarotidState(persisted)) {
      return normalizeHydratedState(persisted);
    }
    return initialState();
  });

  // Phase 3b: encounter-driven hydration. If the encounter loads
  // asynchronously (IDB resolution, route change), pull its persisted
  // carotid slice into the reducer so the user resumes where they left
  // off. We HYDRATE only when the encounter copy is meaningfully
  // different from the in-memory state to avoid wiping unsaved typing.
  useEffect(() => {
    const fromEncounter = encounter?.studies?.carotid;
    if (!isHydratableCarotidState(fromEncounter)) return;
    // Cheap structural compare — JSON.stringify is acceptable for the
    // small per-study slice (no functions, no cycles) and avoids pulling
    // in a deep-equal helper just for one effect.
    if (JSON.stringify(fromEncounter) === JSON.stringify(state)) return;
    dispatch({ type: 'HYDRATE', state: normalizeHydratedState(fromEncounter) });
    // Intentionally exclude `state` from the dep list — we only want to
    // re-hydrate when the encounter source changes, not on every local
    // edit (which would create a feedback loop).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounter?.studies?.carotid]);

  // Phase 3b: persist every reducer change into the encounter draft. The
  // encounter store dual-writes to IDB + localStorage internally, so this
  // single call replaces the legacy `useAutoSave` channel.
  //
  // Two anti-loop guards keep this from re-entering itself:
  //   1. `lastPersistedRef` holds the most recently persisted state by
  //      reference. We only call `setStudyState` when the local `state`
  //      reference actually differs — guards against the encounter-ref
  //      churn that `setStudyState` itself causes (which would otherwise
  //      drive the effect to re-run with the same state).
  //   2. `isFirstMirrorRun` skips the very first effect run, so the
  //      freshly-hydrated state isn't immediately re-mirrored back into
  //      the encounter (it was just read from there).
  // `lastSavedAt` mirrors the timestamp so FormActions' "saved at HH:MM"
  // affordance keeps working without re-introducing useAutoSave.
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const lastPersistedRef = useRef<CarotidFormStateV2 | null>(null);
  // Anti-loop guards:
  //   * Wait for a non-null encounter before mirroring.
  //   * On the FIRST run with a non-null encounter, just seed
  //     `lastPersistedRef` so we don't echo the freshly-hydrated state
  //     back into the encounter (it was just read from there).
  //   * Subsequent runs: persist only if `state` actually changed by
  //     reference. The encounter-ref churn that `setStudyState` itself
  //     produces re-fires the effect with the same `state`, so the ref
  //     guard short-circuits the loop.
  useEffect(() => {
    if (!encounter) return;
    if (lastPersistedRef.current === null) {
      lastPersistedRef.current = state;
      return;
    }
    if (lastPersistedRef.current === state) return;
    lastPersistedRef.current = state;
    setStudyState<CarotidFormStateV2>('carotid', state);
    setLastSavedAt(new Date());
  }, [encounter, setStudyState, state]);

  type PendingTemplate = CarotidTemplate | CustomTemplate;
  const [pendingTemplate, setPendingTemplate] = useState<PendingTemplate | null>(null);
  const [newCaseOpen, setNewCaseOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [pendingDeleteCustomId, setPendingDeleteCustomId] = useState<string | null>(null);
  const [customTemplates, setCustomTemplates] = useState<ReadonlyArray<CustomTemplate>>(
    () => loadCustomTemplates('carotid'),
  );
  const [recentTemplateIds, setRecentTemplateIds] = useState<ReadonlyArray<string>>(
    () => loadRecentTemplateIds('carotid'),
  );

  const handleViewChange = useCallback((v: string) => {
    dispatch({ type: 'SET_VIEW', view: v as CarotidTableView });
  }, []);

  const handleFindingChange = useCallback(
    (id: CarotidVesselFullId, patch: Partial<CarotidVesselFinding>) => {
      dispatch({ type: 'SET_FINDING', id, patch });
    },
    [],
  );

  const handleNascetChange = useCallback((next: CarotidNascetClassification) => {
    dispatch({ type: 'SET_NASCET', nascet: next });
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
  ): tpl is CarotidTemplate =>
    typeof (tpl as CarotidTemplate).nameKey === 'string';

  const handleTemplateRequest = useCallback((tpl: PendingTemplate) => {
    setPendingTemplate(tpl);
  }, []);

  const handleTemplateConfirm = useCallback(() => {
    if (!pendingTemplate) return;
    if (isBuiltInTemplate(pendingTemplate)) {
      const impression = t(pendingTemplate.impressionKey, pendingTemplate.impressionFallback);
      const view: CarotidTableView =
        pendingTemplate.scope === 'bilateral' ? 'bilateral' : pendingTemplate.scope;
      dispatch({
        type: 'APPLY_TEMPLATE',
        findings: pendingTemplate.findings,
        nascet: pendingTemplate.nascet,
        view,
        recommendations: pendingTemplate.recommendations
          ? [...pendingTemplate.recommendations]
          : [],
        impression,
      });
      notifications.show({
        title: t('carotid.actions.templateApplied', 'Template applied'),
        message: t(pendingTemplate.nameKey, pendingTemplate.nameFallback),
        color: 'blue',
      });
    } else {
      const extras = (pendingTemplate.extras ?? {}) as Readonly<{
        nascet?: CarotidNascetClassification;
      }>;
      const view: CarotidTableView =
        pendingTemplate.scope === 'bilateral' ? 'bilateral' : pendingTemplate.scope;
      dispatch({
        type: 'APPLY_TEMPLATE',
        findings: pendingTemplate.findings as CarotidFindings,
        nascet: extras.nascet ?? {},
        view,
        recommendations: pendingTemplate.recommendations
          ? [...pendingTemplate.recommendations]
          : [],
        impression: pendingTemplate.impression ?? '',
      });
      notifications.show({
        title: t('carotid.actions.templateApplied', 'Template applied'),
        message: pendingTemplate.name,
        color: 'blue',
      });
    }
    pushRecentTemplate('carotid', pendingTemplate.id);
    setRecentTemplateIds(loadRecentTemplateIds('carotid'));
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
      const carotidKind: CarotidTemplateKind =
        payload.kind === 'normal' || payload.kind === 'post-procedure'
          ? payload.kind
          : 'normal';
      const scope =
        state.view === 'right' || state.view === 'left' ? state.view : 'bilateral';
      const saved = saveCustomTemplate('carotid', {
        name: payload.name,
        description: payload.description,
        kind: carotidKind,
        scope,
        findings: state.findings,
        extras: { nascet: state.nascet },
        recommendations: state.recommendations,
        impression: state.impression,
        sonographerComments: state.sonographerComments,
      });
      setCustomTemplates(loadCustomTemplates('carotid'));
      setSaveDialogOpen(false);
      notifications.show({
        title: t('carotid.templateGallery.saveSuccessTitle', 'Template saved'),
        message: saved.name,
        color: 'teal',
        autoClose: 2500,
      });
    },
    [
      state.view,
      state.findings,
      state.nascet,
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
    deleteCustomTemplate('carotid', pendingDeleteCustomId);
    setCustomTemplates(loadCustomTemplates('carotid'));
    setPendingDeleteCustomId(null);
    notifications.show({
      title: t('carotid.templateGallery.deleteSuccessTitle', 'Template deleted'),
      message: t(
        'carotid.templateGallery.deleteSuccessMessage',
        'The template has been removed from your library.',
      ),
      color: 'teal',
      autoClose: 2500,
    });
  }, [pendingDeleteCustomId, t]);

  const handleNewCaseRequest = useCallback(() => setNewCaseOpen(true), []);
  const handleNewCaseConfirm = useCallback(() => {
    // Phase 3b: "+ New case" now means "reset THIS study's findings within
    // the encounter". Encounter-level fields (patient identity, operator,
    // institution) live on EncounterContext and stay untouched.
    dispatch({ type: 'RESET' });
    setNewCaseOpen(false);
    notifications.show({
      title: t('carotid.actions.newCaseToastTitle', 'New case started'),
      message: t('carotid.actions.newCaseToastMessage', 'All data cleared.'),
      color: 'green',
    });
  }, [t]);

  useHotkeys([
    // mod+s used to call saveNow() from useAutoSave; encounter writes are
    // synchronous on every dispatch now, so the shortcut is a no-op-with-
    // intent — kept reserved so a future explicit-save command can claim
    // it without redoing keymap discovery.
    ['mod+s', () => undefined, { preventDefault: true }],
    ['mod+shift+N', () => handleNewCaseRequest(), { preventDefault: true }],
  ]);

  const formState = useMemo(() => toFormState(state, encounter), [state, encounter]);

  const carotidColorFn = useCallback(
    (id: string): { fill: string; stroke: string } => {
      const finding = state.findings[id as CarotidVesselFullId];
      const side = id.endsWith('-left') ? 'left' : id.endsWith('-right') ? 'right' : null;
      const nascetCat = side ? state.nascet[side] : undefined;
      const band = deriveCarotidCompetency(finding, nascetCat);
      return SEVERITY_COLORS[band];
    },
    [state.findings, state.nascet],
  );

  // Tooltip status text — the venous Competency enum doesn't apply here, so
  // surface the carotid severity band directly. Without this, AnatomyView
  // would say "Normal" on every vessel (Area 01 BLOCKER). i18n keys are
  // optional; falls back to the English band name if missing.
  const carotidTooltipText = useCallback(
    (id: string): string => {
      const finding = state.findings[id as CarotidVesselFullId];
      const side = id.endsWith('-left') ? 'left' : id.endsWith('-right') ? 'right' : null;
      const nascetCat = side ? state.nascet[side] : undefined;
      const band = deriveCarotidCompetency(finding, nascetCat);
      return t(`carotid.severity.${band}`, band);
    },
    [state.findings, state.nascet, t],
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
              { value: 'right', label: t('carotid.tabs.right', 'Right') },
              { value: 'bilateral', label: t('carotid.tabs.bilateral', 'Bilateral') },
              { value: 'left', label: t('carotid.tabs.left', 'Left') },
            ]}
          />
          <Group gap="xs">
            <EMRButton
              variant="secondary"
              size="sm"
              icon={IconStack2}
              onClick={handleOpenGallery}
              data-testid="carotid-template-gallery-trigger"
            >
              {t('carotid.templates.menuLabel', 'Templates')}
            </EMRButton>
            <button
              type="button"
              className={classes.newCaseButton}
              onClick={handleNewCaseRequest}
              aria-label={t('carotid.actions.newCase', '+ New case')}
            >
              <IconPlus size={16} />
              <span>{t('carotid.actions.newCase', '+ New case')}</span>
            </button>
          </Group>
        </Group>

        <CarotidSegmentTable
          findings={state.findings}
          view={state.view}
          onFindingChange={handleFindingChange}
        />

        <NASCETPicker
          findings={state.findings}
          value={state.nascet}
          onChange={handleNascetChange}
        />

        <Paper withBorder radius="md" shadow="sm" p="md">
          <Stack gap="sm">
            <div>
              <Title order={5} mb={2}>
                {t('carotid.anatomy.title', 'Carotid anatomy')}
              </Title>
              <Text size="sm" c="dimmed">
                {t(
                  'carotid.anatomy.subtitle',
                  'Vessel colors reflect severity (normal → occluded).',
                )}
              </Text>
            </div>
            <Group justify="center">
              <AnatomyView
                view="neck-carotid"
                segments={{}}
                size="lg"
                interactive={false}
                colorFn={carotidColorFn}
                tooltipText={carotidTooltipText}
                ariaLabel={t('carotid.anatomy.title', 'Carotid anatomy')}
              />
            </Group>
          </Stack>
        </Paper>

        <Stack gap="sm" className={classes.textSection}>
          <Textarea
            label={t('carotid.narrative.impression', 'Impression')}
            value={state.impression}
            onChange={(e) => handleImpressionChange(e.currentTarget.value)}
            autosize
            minRows={4}
            data-testid="carotid-impression"
          />
          <Textarea
            label={t('carotid.narrative.sonographerComments', 'Sonographer comments')}
            value={state.sonographerComments}
            onChange={(e) => handleSonographerChange(e.currentTarget.value)}
            autosize
            minRows={2}
            data-testid="carotid-sonographer"
          />
          <Textarea
            label={t('carotid.narrative.clinicianComments', 'Clinician comments')}
            value={state.clinicianComments}
            onChange={(e) => handleClinicianChange(e.currentTarget.value)}
            autosize
            minRows={2}
            data-testid="carotid-clinician"
          />
        </Stack>

        <RecommendationsBlock
          items={state.recommendations}
          onChange={handleRecommendationsChange}
        />

        <FormActions
          form={formState}
          lastSavedAt={lastSavedAt}
          hasUnsavedChanges={false}
          onSaveDraft={() => {
            // Encounter writes already flush on every reducer change.
            // `Save now` is a manual re-flush so the user gets a fresh
            // "saved at" timestamp on demand without relying on the
            // change-detection guard in the persist effect.
            if (encounter) {
              lastPersistedRef.current = state;
              setStudyState<CarotidFormStateV2>('carotid', state);
              setLastSavedAt(new Date());
            }
          }}
          baseFilename={`carotid-${state.studyDate || encounter?.header.encounterDate || 'report'}`}
        />
      </Stack>

      <ConfirmDialog
        opened={pendingTemplate !== null}
        onClose={() => setPendingTemplate(null)}
        title={t('carotid.actions.applyTemplateConfirmTitle', 'Apply template?')}
        message={t(
          'carotid.actions.applyTemplateConfirmBody',
          'This will replace current findings, NASCET classification, impression, and recommendations.',
        )}
        confirmLabel={t('carotid.actions.applyTemplate', 'Apply template')}
        cancelLabel={t('carotid.actions.cancel', 'Cancel')}
        onConfirm={handleTemplateConfirm}
      />

      <ConfirmDialog
        opened={newCaseOpen}
        onClose={() => setNewCaseOpen(false)}
        title={t('carotid.actions.newCaseConfirmTitle', 'Start a new case?')}
        message={t(
          'carotid.actions.newCaseConfirmBody',
          'This will erase all current data. Unsaved changes will be lost.',
        )}
        confirmLabel={t('carotid.actions.newCaseConfirm', 'Discard & start new')}
        cancelLabel={t('carotid.actions.cancel', 'Cancel')}
        onConfirm={handleNewCaseConfirm}
        destructive
      />

      <CarotidTemplateGallery
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
        title={t('carotid.templateGallery.deleteConfirmTitle', 'Delete template?')}
        message={t(
          'carotid.templateGallery.deleteConfirmBody',
          'This template will be removed from your library. This cannot be undone.',
        )}
        confirmLabel={t('carotid.templateGallery.deleteConfirm', 'Delete')}
        cancelLabel={t('carotid.actions.cancel', 'Cancel')}
        onConfirm={handleConfirmDeleteCustom}
        destructive
      />
    </div>
  );
});

export default CarotidForm;
