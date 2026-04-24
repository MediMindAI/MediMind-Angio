// SPDX-License-Identifier: Apache-2.0
/**
 * CarotidForm — bilateral carotid-vertebral-subclavian duplex container.
 *
 * Layout: StudyHeader · SegmentedControl (view) · CarotidSegmentTable ·
 * NASCETPicker · Impression/Sonographer/Clinician textareas ·
 * RecommendationsBlock · FormActions.
 */

import { memo, useCallback, useMemo, useReducer, useState } from 'react';
import { Stack, Group, SegmentedControl, Textarea } from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconPlus } from '@tabler/icons-react';
import { useTranslation } from '../../../contexts/TranslationContext';
import type { FormState, Recommendation, StudyHeader as StudyHeaderShape } from '../../../types/form';
import { useAutoSave, loadDraft } from '../../../hooks/useAutoSave';
import { ConfirmDialog } from '../../common';
import { StudyHeader, type StudyHeaderValue } from '../../form/StudyHeader';
import { RecommendationsBlock } from '../../form/RecommendationsBlock';
import { FormActions } from '../../form/FormActions';
import { defaultCptForStudy, cptDisplay } from '../../../constants/vascular-cpt';
import type {
  CarotidFindings,
  CarotidNascetClassification,
  CarotidVesselFinding,
  CarotidVesselFullId,
} from './config';
import { CarotidSegmentTable, type CarotidTableView } from './CarotidSegmentTable';
import { NASCETPicker } from './NASCETPicker';
import { CAROTID_TEMPLATES, findCarotidTemplateById, type CarotidTemplate } from './templates';
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
  | { type: 'APPLY_TEMPLATE'; template: CarotidTemplate; impression: string }
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
        findings: { ...action.template.findings },
        nascet: { ...action.template.nascet },
        view: action.template.scope === 'bilateral' ? 'bilateral' : action.template.scope,
        impression: action.impression,
        impressionEdited: true,
        recommendations: action.template.recommendations
          ? [...action.template.recommendations]
          : [],
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

  const [pendingTemplate, setPendingTemplate] = useState<CarotidTemplate | null>(null);
  const [newCaseOpen, setNewCaseOpen] = useState(false);

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

  const handleTemplateRequest = useCallback((tpl: CarotidTemplate) => {
    setPendingTemplate(tpl);
  }, []);

  const handleTemplateConfirm = useCallback(() => {
    if (!pendingTemplate) return;
    const impression = t(pendingTemplate.impressionKey, pendingTemplate.impressionFallback);
    dispatch({
      type: 'APPLY_TEMPLATE',
      template: pendingTemplate,
      impression,
    });
    setPendingTemplate(null);
    notifications.show({
      title: t('carotid.actions.templateApplied', 'Template applied'),
      message: t(pendingTemplate.nameKey, pendingTemplate.nameFallback),
      color: 'blue',
    });
  }, [pendingTemplate, t]);

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
            <select
              className={classes.templateSelect}
              onChange={(e) => {
                const tpl = findCarotidTemplateById(e.target.value);
                if (tpl) handleTemplateRequest(tpl);
                e.currentTarget.value = '';
              }}
              defaultValue=""
              aria-label={t('carotid.templates.menuLabel', 'Templates')}
            >
              <option value="" disabled>
                {t('carotid.templates.menuLabel', 'Templates')}
              </option>
              {CAROTID_TEMPLATES.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {t(tpl.nameKey, tpl.nameFallback)}
                </option>
              ))}
            </select>
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
    </div>
  );
});

export default CarotidForm;
