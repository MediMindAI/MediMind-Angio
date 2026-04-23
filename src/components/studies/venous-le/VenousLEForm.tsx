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
import { useTranslation } from '../../../contexts/TranslationContext';
import { AnatomyView, AnatomyLegend } from '../../anatomy';
import type { Competency, SegmentId } from '../../../types/anatomy';
import type { CeapClassification } from '../../../types/ceap';
import type { FormState, Recommendation, StudyHeader as StudyHeaderShape } from '../../../types/form';
import { useAutoSave, loadDraft } from '../../../hooks/useAutoSave';
import { StudyHeader, type StudyHeaderValue } from '../../form/StudyHeader';
import { SegmentTable, type SegmentTableView } from '../../form/SegmentTable';
import { ReflexTimeTable } from '../../form/ReflexTimeTable';
import { ImpressionBlock } from '../../form/ImpressionBlock';
import { CEAPPicker } from '../../form/CEAPPicker';
import { RecommendationsBlock } from '../../form/RecommendationsBlock';
import { FormActions } from '../../form/FormActions';
import {
  VENOUS_LE_SEGMENTS,
  deriveCompetency,
  type VenousLEFullSegmentId,
  type VenousLESegmentBase,
  type VenousSegmentFinding,
  type VenousSegmentFindings,
} from './config';
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
}

const STUDY_ID = 'venousLEBilateral';
const TODAY_ISO = new Date().toISOString().slice(0, 10);

const INITIAL_STATE: VenousFormStateV1 = {
  studyType: 'venousLEBilateral',
  header: {
    patientName: '',
    studyDate: TODAY_ISO,
  },
  findings: {},
  view: 'right',
  impression: '',
  impressionEdited: false,
  ceap: undefined,
  recommendations: [],
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
  };
  return {
    studyType: 'venousLEBilateral',
    header: headerOut,
    narrative: {
      indication: s.header.indication,
      impression: s.impression,
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
// Main component
// ============================================================================

export const VenousLEForm = memo(function VenousLEForm(): React.ReactElement {
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [highlightId, setHighlightId] = useState<VenousLEFullSegmentId | null>(null);

  // Hydrate from draft on mount (one-shot).
  useEffect(() => {
    const draft = loadDraft<VenousFormStateV1>(STUDY_ID);
    if (draft && draft.studyType === 'venousLEBilateral') {
      dispatch({ type: 'HYDRATE', value: draft });
    }
  }, []);

  // Auto-save.
  const { lastSavedAt, hasUnsavedChanges, saveNow } = useAutoSave<VenousFormStateV1>(
    STUDY_ID,
    state,
    { debounceMs: 1500 },
  );

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

      <div className={classes.container}>
        <Stack gap="md">
          <StudyHeader value={state.header} onChange={handleHeader} />

          <Grid gutter={{ base: 'sm', lg: 'md' }}>
            <Grid.Col span={{ base: 12, lg: 5 }}>
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
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
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
            </Grid.Col>

            <Grid.Col span={{ base: 12, lg: 7 }}>
              <SegmentTable
                view={state.view}
                onViewChange={handleView}
                findings={state.findings}
                onFindingChange={handleFinding}
                highlightId={highlightId}
                onHighlight={handleRowHighlight}
              />
            </Grid.Col>
          </Grid>

          <ReflexTimeTable findings={state.findings} onFindingChange={handleFinding} />

          <ImpressionBlock
            findings={state.findings}
            value={state.impression}
            edited={state.impressionEdited}
            onChange={handleImpression}
            onRegenerate={handleImpressionRegenerate}
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
    </div>
  );
});

export default VenousLEForm;
