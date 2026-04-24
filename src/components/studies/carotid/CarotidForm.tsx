// SPDX-License-Identifier: Apache-2.0
/**
 * CarotidForm — bilateral carotid-vertebral-subclavian duplex container.
 *
 * Layout: StudyHeader · SegmentedControl (view) · CarotidSegmentTable ·
 * NASCETPicker · Impression/Sonographer/Clinician textareas ·
 * RecommendationsBlock · FormActions.
 */

import { memo, useCallback, useMemo, useReducer, useState } from 'react';
import { Stack, Group, Paper, SegmentedControl, Text, Textarea, Title } from '@mantine/core';
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

interface CarotidFormStateV1 {
  readonly studyType: 'carotid';
  readonly header: StudyHeaderValue;
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
  | { type: 'SET_HEADER'; header: StudyHeaderValue }
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
  | { type: 'RESET'; header: StudyHeaderValue };

function defaultHeader(): StudyHeaderValue {
  const cpt = defaultCptForStudy('carotid');
  return {
    patientName: '',
    studyDate: new Date().toISOString().slice(0, 10),
    indication: '',
    cptCode: { code: cpt.code, display: cptDisplay(cpt, 'en') },
  };
}

function initialState(): CarotidFormStateV1 {
  return {
    studyType: 'carotid',
    header: defaultHeader(),
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

function reducer(state: CarotidFormStateV1, action: Action): CarotidFormStateV1 {
  switch (action.type) {
    case 'SET_HEADER':
      return { ...state, header: action.header };
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
      };
    case 'RESET':
      return { ...initialState(), header: action.header };
  }
}

function toFormState(s: CarotidFormStateV1): FormState {
  return {
    studyType: 'carotid',
    header: s.header as StudyHeaderShape,
    segments: [],
    narrative: {
      impression: s.impression,
      sonographerComments: s.sonographerComments,
      clinicianComments: s.clinicianComments,
    },
    recommendations: s.recommendations,
    parameters: {
      segmentFindings: s.findings as unknown as string,
      nascet: s.nascet as unknown as string,
    },
  };
}

export const CarotidForm = memo(function CarotidForm(): React.ReactElement {
  const { t } = useTranslation();

  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const persisted = loadDraft<CarotidFormStateV1>(STUDY_ID);
    return persisted ?? initialState();
  });

  const { lastSavedAt, hasUnsavedChanges, saveNow, clearDraft } = useAutoSave<CarotidFormStateV1>(
    STUDY_ID,
    state,
  );

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

  const handleHeaderChange = useCallback((next: StudyHeaderValue) => {
    dispatch({ type: 'SET_HEADER', header: next });
  }, []);

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
    const keepHeader: StudyHeaderValue = {
      ...defaultHeader(),
      operatorName: state.header.operatorName,
      institution: state.header.institution,
    };
    dispatch({ type: 'RESET', header: keepHeader });
    clearDraft();
    setNewCaseOpen(false);
    notifications.show({
      title: t('carotid.actions.newCaseToastTitle', 'New case started'),
      message: t('carotid.actions.newCaseToastMessage', 'All data cleared.'),
      color: 'green',
    });
  }, [state.header.operatorName, state.header.institution, clearDraft, t]);

  useHotkeys([
    ['mod+s', () => saveNow(), { preventDefault: true }],
    ['mod+shift+N', () => handleNewCaseRequest(), { preventDefault: true }],
  ]);

  const formState = useMemo(() => toFormState(state), [state]);

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

  return (
    <div className={classes.wrap}>
      <Stack gap="md">
        <StudyHeader value={state.header} onChange={handleHeaderChange} />

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
          hasUnsavedChanges={hasUnsavedChanges}
          onSaveDraft={saveNow}
          baseFilename={`carotid-${state.header.studyDate || 'report'}`}
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
