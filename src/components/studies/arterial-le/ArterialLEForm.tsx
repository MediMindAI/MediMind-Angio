// SPDX-License-Identifier: Apache-2.0
/**
 * ArterialLEForm — Phase 2 orchestrator for bilateral lower-extremity
 * arterial duplex reporting.
 *
 * Layout (desktop):
 *   ┌─ StudyHeader ─────────────────────────────────┐
 *   ├─ SegmentalPressureTable ──┬─ ArterialSegmentTable ┤
 *   ├─ ImpressionBlock ───────────────────────────────┤
 *   ├─ RecommendationsBlock ──────────────────────────┤
 *   └─ FormActions (sticky) ──────────────────────────┘
 *
 * State lives in a single useReducer; auto-saves via useAutoSave.
 */

import { memo, useCallback, useMemo, useReducer, useState } from 'react';
import { Grid, Stack, Group, Paper, SegmentedControl, Text, Textarea, Title } from '@mantine/core';
import { AnatomyView } from '../../anatomy/AnatomyView';
import { SEVERITY_COLORS } from '../../../constants/theme-colors';
import { useHotkeys } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconStack2 } from '@tabler/icons-react';
import { useTranslation } from '../../../contexts/TranslationContext';
import type { FormState, Recommendation, StudyHeader as StudyHeaderShape } from '../../../types/form';
import { useAutoSave, loadDraft } from '../../../hooks/useAutoSave';
import { ConfirmDialog, EMRButton } from '../../common';
import { StudyHeader, type StudyHeaderValue } from '../../form/StudyHeader';
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
  ArterialLEFullSegmentId,
  ArterialSegmentFinding,
  ArterialSegmentFindings,
  SegmentalPressures,
} from './config';
import { deriveArterialCompetency } from './config';
import { SegmentalPressureTable } from './SegmentalPressureTable';
import { ArterialSegmentTable, type ArterialTableView } from './ArterialSegmentTable';
import {
  type ArterialLETemplate,
  type ArterialTemplateKind,
} from './templates';
import { ArterialTemplateGallery } from './ArterialTemplateGallery';
import { generateArterialNarrative } from './narrativeGenerator';
import classes from './ArterialLEForm.module.css';

const STUDY_ID = 'arterialLE';

// ============================================================================
// State shape
// ============================================================================

interface ArterialFormStateV1 {
  readonly studyType: 'arterialLE';
  readonly header: StudyHeaderValue;
  readonly findings: ArterialSegmentFindings;
  readonly pressures: SegmentalPressures;
  readonly view: ArterialTableView;
  readonly impression: string;
  readonly impressionEdited: boolean;
  readonly sonographerComments: string;
  readonly clinicianComments: string;
  readonly recommendations: ReadonlyArray<Recommendation>;
}

type Action =
  | { type: 'SET_HEADER'; header: StudyHeaderValue }
  | { type: 'SET_VIEW'; view: ArterialTableView }
  | { type: 'SET_FINDING'; id: ArterialLEFullSegmentId; patch: Partial<ArterialSegmentFinding> }
  | { type: 'SET_PRESSURES'; pressures: SegmentalPressures }
  | { type: 'SET_IMPRESSION'; impression: string }
  | { type: 'SET_SONOGRAPHER'; comments: string }
  | { type: 'SET_CLINICIAN'; comments: string }
  | { type: 'SET_RECOMMENDATIONS'; recommendations: ReadonlyArray<Recommendation> }
  | {
      type: 'APPLY_TEMPLATE';
      findings: ArterialSegmentFindings;
      pressures: SegmentalPressures;
      view: ArterialTableView;
      recommendations: ReadonlyArray<Recommendation>;
      impression: string;
      sonographerComments?: string;
    }
  | { type: 'RESET'; header: StudyHeaderValue };

function defaultHeader(): StudyHeaderValue {
  const cpt = defaultCptForStudy('arterialLE');
  return {
    patientName: '',
    studyDate: new Date().toISOString().slice(0, 10),
    indication: '',
    cptCode: {
      code: cpt.code,
      display: cptDisplay(cpt, 'en'),
    },
  };
}

function initialState(): ArterialFormStateV1 {
  return {
    studyType: 'arterialLE',
    header: defaultHeader(),
    findings: {},
    pressures: {},
    view: 'bilateral',
    impression: '',
    impressionEdited: false,
    sonographerComments: '',
    clinicianComments: '',
    recommendations: [],
  };
}

function reducer(state: ArterialFormStateV1, action: Action): ArterialFormStateV1 {
  switch (action.type) {
    case 'SET_HEADER':
      return { ...state, header: action.header };
    case 'SET_VIEW':
      return { ...state, view: action.view };
    case 'SET_FINDING': {
      const prev = state.findings[action.id] ?? {};
      const merged: ArterialSegmentFinding = { ...prev, ...action.patch };
      return { ...state, findings: { ...state.findings, [action.id]: merged } };
    }
    case 'SET_PRESSURES':
      return { ...state, pressures: action.pressures };
    case 'SET_IMPRESSION':
      return { ...state, impression: action.impression, impressionEdited: true };
    case 'SET_SONOGRAPHER':
      return { ...state, sonographerComments: action.comments };
    case 'SET_CLINICIAN':
      return { ...state, clinicianComments: action.comments };
    case 'SET_RECOMMENDATIONS':
      return { ...state, recommendations: action.recommendations };
    case 'APPLY_TEMPLATE': {
      return {
        ...state,
        findings: { ...action.findings },
        pressures: { ...action.pressures },
        view: action.view,
        recommendations: [...action.recommendations],
        impression: action.impression,
        impressionEdited: true,
        sonographerComments: action.sonographerComments ?? state.sonographerComments,
      };
    }
    case 'RESET':
      return { ...initialState(), header: action.header };
  }
}

// ============================================================================
// FormState shape for FormActions / FHIR / PDF
// ============================================================================

function toFormState(s: ArterialFormStateV1): FormState {
  return {
    studyType: 'arterialLE',
    header: s.header as StudyHeaderShape,
    segments: [],  // FHIR builder pulls from parameters for arterial
    narrative: {
      impression: s.impression,
      sonographerComments: s.sonographerComments,
      clinicianComments: s.clinicianComments,
    },
    recommendations: s.recommendations,
    parameters: {
      // Stash findings + pressures on parameters so FHIR/PDF can retrieve them.
      segmentFindings: s.findings as unknown as string,
      pressures: s.pressures as unknown as string,
    },
  };
}

// ============================================================================
// Component
// ============================================================================

export const ArterialLEForm = memo(function ArterialLEForm(): React.ReactElement {
  const { t } = useTranslation();

  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const persisted = loadDraft<ArterialFormStateV1>(STUDY_ID);
    return persisted ?? initialState();
  });

  const { lastSavedAt, hasUnsavedChanges, saveNow, clearDraft } = useAutoSave<ArterialFormStateV1>(
    STUDY_ID,
    state,
  );

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

  const handleHeaderChange = useCallback((next: StudyHeaderValue) => {
    dispatch({ type: 'SET_HEADER', header: next });
  }, []);

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
    const keepHeader: StudyHeaderValue = {
      ...defaultHeader(),
      operatorName: state.header.operatorName,
      institution: state.header.institution,
    };
    dispatch({ type: 'RESET', header: keepHeader });
    clearDraft();
    setNewCaseOpen(false);
    notifications.show({
      title: t('arterialLE.actions.newCaseToastTitle', 'New case started'),
      message: t('arterialLE.actions.newCaseToastMessage', 'All data cleared.'),
      color: 'green',
    });
  }, [state.header.operatorName, state.header.institution, clearDraft, t]);

  // --- Auto-impression (future: prompt user to regenerate) -------------------
  // Currently computed lazily on template apply / PDF render; not wired
  // into the textarea yet. Reserved for future "regenerate" button.
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  useMemo(
    () => generateArterialNarrative(state.findings, state.pressures),
    [state.findings, state.pressures],
  );

  // --- Hotkeys ---------------------------------------------------------------

  useHotkeys([
    ['mod+s', () => saveNow(), { preventDefault: true }],
    ['mod+shift+N', () => handleNewCaseRequest(), { preventDefault: true }],
  ]);

  // --- Render ----------------------------------------------------------------

  const formState = useMemo(() => toFormState(state), [state]);

  const arterialColorFn = useCallback(
    (id: string): { fill: string; stroke: string } => {
      const finding = state.findings[id as ArterialLEFullSegmentId];
      const band = deriveArterialCompetency(finding);
      return SEVERITY_COLORS[band];
    },
    [state.findings],
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

  return (
    <div className={classes.wrap}>
      <Stack gap="md">
        <BackToStudiesButton />
        <StudyHeader value={state.header} onChange={handleHeaderChange} />

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
            <Group justify="center">
              <AnatomyView
                view="le-arterial-anterior"
                segments={{}}
                size="lg"
                interactive={false}
                colorFn={arterialColorFn}
                tooltipText={arterialTooltipText}
                ariaLabel={t('arterialLE.anatomy.title', 'Arterial anatomy')}
              />
            </Group>
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
          baseFilename={`arterial-le-${state.header.studyDate || 'report'}`}
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
