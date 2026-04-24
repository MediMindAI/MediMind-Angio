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
import { Grid, Stack, Group, SegmentedControl, Textarea } from '@mantine/core';
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
  ArterialLEFullSegmentId,
  ArterialSegmentFinding,
  ArterialSegmentFindings,
  SegmentalPressures,
} from './config';
import { SegmentalPressureTable } from './SegmentalPressureTable';
import { ArterialSegmentTable, type ArterialTableView } from './ArterialSegmentTable';
import {
  ARTERIAL_LE_TEMPLATES,
  findArterialTemplateById,
  type ArterialLETemplate,
} from './templates';
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
  | { type: 'APPLY_TEMPLATE'; template: ArterialLETemplate; impression: string; sonographerComments?: string }
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
      const viewFromScope: ArterialTableView =
        action.template.scope === 'bilateral' ? 'bilateral' : action.template.scope;
      return {
        ...state,
        findings: { ...action.template.findings },
        pressures: { ...action.template.pressures },
        view: viewFromScope,
        recommendations: action.template.recommendations
          ? [...action.template.recommendations]
          : [],
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

  const [pendingTemplate, setPendingTemplate] = useState<ArterialLETemplate | null>(null);
  const [newCaseOpen, setNewCaseOpen] = useState(false);

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

  const handleTemplateRequest = useCallback((tpl: ArterialLETemplate) => {
    setPendingTemplate(tpl);
  }, []);

  const handleTemplateConfirm = useCallback(() => {
    if (!pendingTemplate) return;
    const impression = t(pendingTemplate.impressionKey, pendingTemplate.impressionFallback);
    const sonographer = pendingTemplate.sonographerCommentsKey
      ? t(pendingTemplate.sonographerCommentsKey, pendingTemplate.sonographerCommentsFallback ?? '')
      : undefined;
    dispatch({
      type: 'APPLY_TEMPLATE',
      template: pendingTemplate,
      impression,
      sonographerComments: sonographer,
    });
    setPendingTemplate(null);
    notifications.show({
      title: t('arterialLE.actions.templateApplied', 'Template applied'),
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

  return (
    <div className={classes.wrap}>
      <Stack gap="md">
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
            <TemplateDropdown
              templates={ARTERIAL_LE_TEMPLATES}
              onPick={handleTemplateRequest}
            />
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
    </div>
  );
});

// ----------------------------------------------------------------------------
// Template dropdown — minimal MVP; template-gallery modal is a future upgrade.
// ----------------------------------------------------------------------------

function TemplateDropdown({
  templates,
  onPick,
}: {
  templates: ReadonlyArray<ArterialLETemplate>;
  onPick: (tpl: ArterialLETemplate) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <select
      className={classes.templateSelect}
      onChange={(e) => {
        const tpl = findArterialTemplateById(e.target.value);
        if (tpl) onPick(tpl);
        e.currentTarget.value = '';  // reset so re-selecting same tpl re-fires
      }}
      defaultValue=""
      aria-label={t('arterialLE.templates.menuLabel', 'Templates')}
    >
      <option value="" disabled>
        {t('arterialLE.templates.menuLabel', 'Templates')}
      </option>
      {templates.map((tpl) => (
        <option key={tpl.id} value={tpl.id}>
          {t(tpl.nameKey, tpl.nameFallback)}
        </option>
      ))}
    </select>
  );
}

export default ArterialLEForm;
