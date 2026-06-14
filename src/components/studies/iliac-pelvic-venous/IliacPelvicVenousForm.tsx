// SPDX-License-Identifier: Apache-2.0
/**
 * IliacPelvicVenousForm — iliac & pelvic venous duplex (pelvic venous disorders).
 *
 * The most structurally complex study: FIVE heterogeneous zones (renal vein /
 * iliac-caval / gonadal / pelvic plexus / escape points) instead of one uniform
 * segment table, plus the SVP classification (with CEAP linked) and a STATIC
 * illustration the clinician free-draws + text-labels on (no competency coloring).
 *
 * Mirrors CarotidForm for the encounter-pivot plumbing: per-study reducer state
 * persisted via `useEncounter().setStudyState('iliacPelvicVenous', state)`, with
 * `stateToFormState` projecting the zone findings under the conventional
 * `parameters.segmentFindings` key the FHIR/narrative/PDF readers expect.
 */

import { memo, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Stack, Group, Grid, Text, Menu } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconStack2, IconTrash, IconRefresh } from '@tabler/icons-react';
import {
  EMRSelect,
  EMRNumberInput,
  EMRCheckbox,
  EMRMultiSelect,
  EMRTextarea,
} from '../../shared/EMRFormFields';
import { AnatomyDiagramSection } from '../../anatomy/AnatomyDiagramSection';
import type { DrawingStroke } from '../../../types/drawing';
import { useTranslation } from '../../../contexts/TranslationContext';
import { useEncounter } from '../../../contexts/EncounterContext';
import type {
  CptCode,
  FormState,
  Recommendation,
  StudyHeader as StudyHeaderShape,
} from '../../../types/form';
import type { CeapClassification } from '../../../types/ceap';
import type { SvpClassification } from '../../../types/svp';
import type { PatientPosition } from '../../../types/patient-position';
import type { EncounterDraft } from '../../../types/encounter';
import { loadDraft } from '../../../hooks/useAutoSave';
import { ConfirmDialog, EMRButton, EMRCard, EMRIconButton } from '../../common';
import { EncounterContextBanner } from '../../layout/EncounterContextBanner';
import { BackToStudiesButton } from '../../layout/BackToStudiesButton';
import { RecommendationsBlock } from '../../form/RecommendationsBlock';
import { FormActions } from '../../form/FormActions';
import { CEAPPicker } from '../../form/CEAPPicker';
import { SVPPicker } from '../../form/SVPPicker';
import { defaultCptForStudy, cptDisplay } from '../../../constants/vascular-cpt';
import { localDateToIso } from '../../../services/dateHelpers';
import { makeId } from '../../../utils/idHelpers';
import { numInputToNumber as toNum } from '../../../utils/numberInput';
import { buildLocalizedNarrativeFromForm } from '../../../services/narrativeService';
import {
  type IliacContext,
  type IliacPelvicVenousFindings,
  type IliacCavalFinding,
  type IliacCavalFullId,
  type CavalLevel,
  type RenalVeinFinding,
  type LrvLevel,
  type VesselLevelMeasurement,
  type GonadalVeinFinding,
  type PelvicPlexusFinding,
  type EscapePoint,
  type EscapePointType,
  type ExtrapelvicVarices,
  type SmasFinding,
  type MalsFinding,
  type Side,
  type Sex,
  type Symptom,
  type RiskFactor,
  type Approach,
  type StudyPositionValue,
  type RefluxTrigger,
  type RefluxType,
  type FlowDirection,
  type Tortuosity,
  SEX_VALUES,
  SYMPTOM_VALUES,
  RISK_FACTOR_VALUES,
  APPROACH_VALUES,
  POSITION_VALUES,
  LRV_LEVELS,
  REFLUX_TRIGGER_VALUES,
  REFLUX_TYPE_VALUES,
  FLOW_DIRECTION_VALUES,
  TORTUOSITY_VALUES,
  ESCAPE_POINT_VALUES,
  ILIAC_THRESHOLDS,
  deriveCavalVelocityRatio,
  migrateIliacFindingsV1toV2,
} from './config';
import { IliacZoneCard } from './IliacZoneCard';
import { IliacCavalTable, type CavalView } from './IliacCavalTable';
import { ILIAC_PELVIC_VENOUS_TEMPLATES, type IliacTemplate } from './templates';
import classes from './IliacPelvicVenousForm.module.css';

const STUDY_ID = 'iliacPelvicVenous';

type StudyQuality = 'excellent' | 'good' | 'suboptimal' | 'limited';

interface IliacStudyFields {
  readonly studyDate?: string;
  readonly studyTime?: string;
  readonly accessionNumber?: string;
  readonly cptCode?: CptCode;
  readonly patientPosition?: PatientPosition;
  readonly quality?: StudyQuality;
}

export interface IliacPelvicVenousFormStateV2 extends IliacStudyFields {
  readonly schemaVersion: 2;
  readonly studyType: 'iliacPelvicVenous';
  readonly context: IliacContext;
  readonly findings: IliacPelvicVenousFindings;
  readonly cavalView: CavalView;
  readonly impression: string;
  readonly impressionEdited: boolean;
  readonly sonographerComments: string;
  readonly clinicianComments: string;
  readonly ceap?: CeapClassification;
  readonly svp?: SvpClassification;
  readonly recommendations: ReadonlyArray<Recommendation>;
  readonly drawings: ReadonlyArray<DrawingStroke>;
}

type Action =
  | { type: 'SET_CONTEXT'; patch: Partial<IliacContext> }
  | { type: 'SET_RENAL'; patch: Partial<RenalVeinFinding> }
  | { type: 'SET_CAVAL_VIEW'; view: CavalView }
  | { type: 'SET_CAVAL_FINDING'; id: IliacCavalFullId; patch: Partial<IliacCavalFinding> }
  | { type: 'SET_CAVAL_LEVEL'; id: IliacCavalFullId; level: CavalLevel; patch: Partial<VesselLevelMeasurement> }
  | { type: 'SET_RENAL_LEVEL'; level: LrvLevel; patch: Partial<VesselLevelMeasurement> }
  | { type: 'SET_SMAS'; patch: Partial<SmasFinding> }
  | { type: 'SET_MALS'; patch: Partial<MalsFinding> }
  | { type: 'SET_GONADAL'; side: Side; patch: Partial<GonadalVeinFinding> }
  | { type: 'SET_PLEXUS'; side: Side; patch: Partial<PelvicPlexusFinding> }
  | { type: 'ADD_ESCAPE_POINT'; point: EscapePoint }
  | { type: 'UPDATE_ESCAPE_POINT'; id: string; patch: Partial<EscapePoint> }
  | { type: 'REMOVE_ESCAPE_POINT'; id: string }
  | { type: 'SET_EXTRAPELVIC'; patch: Partial<ExtrapelvicVarices> }
  | { type: 'SET_IMPRESSION'; impression: string }
  | { type: 'SET_SONOGRAPHER'; comments: string }
  | { type: 'SET_CLINICIAN'; comments: string }
  | { type: 'SET_CEAP'; ceap: CeapClassification | undefined }
  | { type: 'SET_SVP'; svp: SvpClassification | undefined }
  | { type: 'SET_RECOMMENDATIONS'; recommendations: ReadonlyArray<Recommendation> }
  | {
      type: 'APPLY_TEMPLATE';
      context: IliacContext;
      findings: IliacPelvicVenousFindings;
      impression: string;
      recommendations: ReadonlyArray<Recommendation>;
    }
  | { type: 'COMMIT_STROKE'; stroke: DrawingStroke }
  | { type: 'ERASE_STROKE'; strokeId: string }
  | { type: 'UNDO_STROKE' }
  | { type: 'CLEAR_DRAWINGS' }
  | { type: 'RESET' }
  | { type: 'HYDRATE'; state: IliacPelvicVenousFormStateV2 };

function defaultIliacCpt(): CptCode {
  const cpt = defaultCptForStudy('iliacPelvicVenous');
  return { code: cpt.code, display: cptDisplay(cpt, 'en') };
}

function initialState(): IliacPelvicVenousFormStateV2 {
  return {
    schemaVersion: 2,
    studyType: 'iliacPelvicVenous',
    studyDate: localDateToIso(new Date()) ?? '',
    cptCode: defaultIliacCpt(),
    context: { sex: 'female' },
    findings: {},
    cavalView: 'bilateral',
    impression: '',
    impressionEdited: false,
    sonographerComments: '',
    clinicianComments: '',
    recommendations: [],
    drawings: [],
  };
}

/** Merge a per-side zone record, dropping the side key when the merge empties it. */
function mergeSide<T extends object>(
  prev: Partial<Record<Side, T>> | undefined,
  side: Side,
  patch: Partial<T>,
): Partial<Record<Side, T>> {
  const next = { ...(prev ?? {}) };
  next[side] = { ...(next[side] ?? ({} as T)), ...patch };
  return next;
}

function reducer(
  state: IliacPelvicVenousFormStateV2,
  action: Action,
): IliacPelvicVenousFormStateV2 {
  switch (action.type) {
    case 'SET_CONTEXT':
      return { ...state, context: { ...state.context, ...action.patch } };
    case 'SET_RENAL':
      return {
        ...state,
        findings: { ...state.findings, renal: { ...state.findings.renal, ...action.patch } },
      };
    case 'SET_CAVAL_VIEW':
      return { ...state, cavalView: action.view };
    case 'SET_CAVAL_FINDING': {
      const prevCaval = state.findings.caval ?? {};
      const prev = prevCaval[action.id] ?? {};
      return {
        ...state,
        findings: {
          ...state.findings,
          caval: { ...prevCaval, [action.id]: { ...prev, ...action.patch } },
        },
      };
    }
    case 'SET_CAVAL_LEVEL': {
      const prevCaval = state.findings.caval ?? {};
      const prevFinding = prevCaval[action.id] ?? {};
      const prevLevels = prevFinding.levels ?? {};
      const merged: IliacCavalFinding = {
        ...prevFinding,
        levels: {
          ...prevLevels,
          [action.level]: { ...(prevLevels[action.level] ?? {}), ...action.patch },
        },
      };
      // Keep the flat ratio in sync so FHIR/PDF/narrative (which read
      // velocityRatio) stay correct; the derive returns undefined with < 2
      // measured levels, leaving any prior manual value untouched.
      const derived = deriveCavalVelocityRatio(merged);
      const next = derived !== undefined ? { ...merged, velocityRatio: derived } : merged;
      return {
        ...state,
        findings: { ...state.findings, caval: { ...prevCaval, [action.id]: next } },
      };
    }
    case 'SET_RENAL_LEVEL': {
      const prevRenal = state.findings.renal ?? {};
      const prevLevels = prevRenal.levels ?? {};
      return {
        ...state,
        findings: {
          ...state.findings,
          renal: {
            ...prevRenal,
            levels: {
              ...prevLevels,
              [action.level]: { ...(prevLevels[action.level] ?? {}), ...action.patch },
            },
          },
        },
      };
    }
    case 'SET_SMAS':
      return {
        ...state,
        findings: {
          ...state.findings,
          specialConsiderations: {
            ...state.findings.specialConsiderations,
            smas: { ...state.findings.specialConsiderations?.smas, ...action.patch },
          },
        },
      };
    case 'SET_MALS':
      return {
        ...state,
        findings: {
          ...state.findings,
          specialConsiderations: {
            ...state.findings.specialConsiderations,
            mals: { ...state.findings.specialConsiderations?.mals, ...action.patch },
          },
        },
      };
    case 'SET_GONADAL':
      return {
        ...state,
        findings: {
          ...state.findings,
          gonadal: mergeSide(state.findings.gonadal, action.side, action.patch),
        },
      };
    case 'SET_PLEXUS':
      return {
        ...state,
        findings: {
          ...state.findings,
          plexus: mergeSide(state.findings.plexus, action.side, action.patch),
        },
      };
    case 'ADD_ESCAPE_POINT':
      return {
        ...state,
        findings: {
          ...state.findings,
          escapePoints: [...(state.findings.escapePoints ?? []), action.point],
        },
      };
    case 'UPDATE_ESCAPE_POINT':
      return {
        ...state,
        findings: {
          ...state.findings,
          escapePoints: (state.findings.escapePoints ?? []).map((p) =>
            p.id === action.id ? { ...p, ...action.patch } : p,
          ),
        },
      };
    case 'REMOVE_ESCAPE_POINT':
      return {
        ...state,
        findings: {
          ...state.findings,
          escapePoints: (state.findings.escapePoints ?? []).filter((p) => p.id !== action.id),
        },
      };
    case 'SET_EXTRAPELVIC':
      return {
        ...state,
        findings: {
          ...state.findings,
          extrapelvic: { ...state.findings.extrapelvic, ...action.patch },
        },
      };
    case 'SET_IMPRESSION':
      return { ...state, impression: action.impression, impressionEdited: true };
    case 'SET_SONOGRAPHER':
      return { ...state, sonographerComments: action.comments };
    case 'SET_CLINICIAN':
      return { ...state, clinicianComments: action.comments };
    case 'SET_CEAP':
      return { ...state, ceap: action.ceap };
    case 'SET_SVP':
      return { ...state, svp: action.svp };
    case 'SET_RECOMMENDATIONS':
      return { ...state, recommendations: action.recommendations };
    case 'APPLY_TEMPLATE':
      return {
        ...state,
        context: { ...action.context },
        findings: structuredCloneFindings(action.findings),
        impression: action.impression,
        impressionEdited: true,
        recommendations: [...action.recommendations],
        // PHI hygiene — never carry a clinician interpretation across cases.
        clinicianComments: '',
      };
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
    case 'RESET':
      return { ...initialState() };
    case 'HYDRATE':
      return action.state;
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

/** Deep-ish clone so a frozen template seed can't be shared by reference. */
function structuredCloneFindings(f: IliacPelvicVenousFindings): IliacPelvicVenousFindings {
  return {
    renal: f.renal ? { ...f.renal } : undefined,
    caval: f.caval
      ? Object.fromEntries(Object.entries(f.caval).map(([k, v]) => [k, { ...v }]))
      : undefined,
    gonadal: f.gonadal
      ? { left: f.gonadal.left ? { ...f.gonadal.left } : undefined, right: f.gonadal.right ? { ...f.gonadal.right } : undefined }
      : undefined,
    plexus: f.plexus
      ? { left: f.plexus.left ? { ...f.plexus.left } : undefined, right: f.plexus.right ? { ...f.plexus.right } : undefined }
      : undefined,
    escapePoints: f.escapePoints ? f.escapePoints.map((p) => ({ ...p })) : undefined,
    extrapelvic: f.extrapelvic ? { ...f.extrapelvic } : undefined,
    specialConsiderations: f.specialConsiderations
      ? {
          smas: f.specialConsiderations.smas ? { ...f.specialConsiderations.smas } : undefined,
          mals: f.specialConsiderations.mals ? { ...f.specialConsiderations.mals } : undefined,
        }
      : undefined,
  };
}

function isHydratableState(value: unknown): value is IliacPelvicVenousFormStateV2 {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { schemaVersion?: unknown; studyType?: unknown };
  // Accept BOTH V1 and V2 — a V1 draft is migrated (not rejected → wiped) by
  // normalizeHydratedState. Rejecting stale V1 would silently lose a clinician's
  // in-flight encounter.
  return (
    (v.schemaVersion === 1 || v.schemaVersion === 2) && v.studyType === 'iliacPelvicVenous'
  );
}

function normalizeHydratedState(raw: IliacPelvicVenousFormStateV2): IliacPelvicVenousFormStateV2 {
  const legacy = raw as IliacPelvicVenousFormStateV2 & { header?: unknown };
  let base: IliacPelvicVenousFormStateV2;
  if ('header' in legacy) {
    const { header: _h, ...rest } = legacy;
    void _h;
    base = { ...initialState(), ...(rest as Partial<IliacPelvicVenousFormStateV2>) };
  } else {
    // Backfill any fields a partial/older blob is missing (cavalView, svp, ceap,
    // drawings) by spreading over a fresh initialState (audit L2). JSON has no
    // `undefined`, so present-but-undefined overwrites are not a concern here.
    base = { ...initialState(), ...raw, drawings: raw.drawings ?? [] };
  }
  // V1→V2 findings migration (caval per-level shape + renal SMA-angle → SMAS) and
  // version stamp. Idempotent, so re-hydrating a V2 draft is a no-op.
  return { ...base, schemaVersion: 2, findings: migrateIliacFindingsV1toV2(base.findings) };
}

export function stateToFormState(
  s: IliacPelvicVenousFormStateV2,
  encounter: EncounterDraft | null,
): FormState {
  const eh = encounter?.header;
  const composed = {
    patientName: eh?.patientName ?? '',
    patientId: eh?.patientId,
    patientBirthDate: eh?.patientBirthDate,
    patientGender: eh?.patientGender,
    operatorName: eh?.operatorName,
    referringPhysician: eh?.referringPhysician,
    institution: eh?.institution,
    medications: eh?.medications,
    informedConsent: eh?.informedConsent,
    informedConsentSignedAt: eh?.informedConsentSignedAt,
    icd10Codes: eh?.icd10Codes,
    studyDate: s.studyDate || eh?.encounterDate || '',
    studyTime: s.studyTime,
    accessionNumber: s.accessionNumber,
    cptCode: s.cptCode,
    patientPosition: s.patientPosition,
    quality: s.quality,
  };
  return {
    studyType: 'iliacPelvicVenous',
    header: composed as StudyHeaderShape,
    segments: [],
    narrative: {
      indication: eh?.indicationNotes,
      impression: s.impression,
      sonographerComments: s.sonographerComments || undefined,
      clinicianComments: s.clinicianComments || undefined,
    },
    recommendations: s.recommendations,
    ceap: s.ceap,
    svp: s.svp,
    parameters: {
      segmentFindings: s.findings,
      drawings: s.drawings,
      context: s.context,
    },
  };
}

export const IliacPelvicVenousForm = memo(function IliacPelvicVenousForm(): React.ReactElement {
  const { t } = useTranslation();
  const { encounter, setStudyState } = useEncounter();

  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const fromEncounter = encounter?.studies?.iliacPelvicVenous;
    if (isHydratableState(fromEncounter)) return normalizeHydratedState(fromEncounter);
    const persisted = loadDraft<IliacPelvicVenousFormStateV2>(STUDY_ID);
    if (isHydratableState(persisted)) return normalizeHydratedState(persisted);
    return initialState();
  });

  useEffect(() => {
    const fromEncounter = encounter?.studies?.iliacPelvicVenous;
    if (!isHydratableState(fromEncounter)) return;
    if (JSON.stringify(fromEncounter) === JSON.stringify(state)) return;
    dispatch({ type: 'HYDRATE', state: normalizeHydratedState(fromEncounter) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounter?.studies?.iliacPelvicVenous]);

  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const lastPersistedRef = useRef<IliacPelvicVenousFormStateV2 | null>(null);
  useEffect(() => {
    if (!encounter) return;
    if (lastPersistedRef.current === null) {
      lastPersistedRef.current = state;
      return;
    }
    if (lastPersistedRef.current === state) return;
    lastPersistedRef.current = state;
    setStudyState<IliacPelvicVenousFormStateV2>('iliacPelvicVenous', state);
    setLastSavedAt(new Date());
  }, [encounter, setStudyState, state]);

  const [pendingTemplate, setPendingTemplate] = useState<IliacTemplate | null>(null);
  const [newCaseOpen, setNewCaseOpen] = useState(false);

  const formState = useMemo(() => stateToFormState(state, encounter), [state, encounter]);

  // Export gate (audit M7): an untouched form would otherwise emit a confident
  // "normal" report. Require at least one finding / SVP entry / symptom before
  // PDF/FHIR export is allowed.
  const hasAnyFindings = useMemo(() => {
    const f = state.findings;
    const svp = state.svp;
    return (
      !!(f.renal && Object.keys(f.renal).length > 0) ||
      !!(f.caval && Object.keys(f.caval).length > 0) ||
      !!(f.gonadal && Object.keys(f.gonadal).length > 0) ||
      !!(f.plexus && Object.keys(f.plexus).length > 0) ||
      !!(f.escapePoints && f.escapePoints.length > 0) ||
      !!(f.extrapelvic && Object.values(f.extrapelvic).some(Boolean)) ||
      !!(
        f.specialConsiderations &&
        ((f.specialConsiderations.smas &&
          Object.keys(f.specialConsiderations.smas).length > 0) ||
          (f.specialConsiderations.mals &&
            Object.keys(f.specialConsiderations.mals).length > 0))
      ) ||
      !!(state.context.symptoms && state.context.symptoms.length > 0) ||
      !!(
        svp &&
        (svp.s.some((x) => x !== 'S0') || svp.v.some((x) => x !== 'V0') || svp.p.length > 0)
      )
    );
  }, [state.findings, state.svp, state.context.symptoms]);

  // ---- Handlers ----
  const setContext = useCallback((patch: Partial<IliacContext>) => {
    dispatch({ type: 'SET_CONTEXT', patch });
  }, []);
  const setRenal = useCallback((patch: Partial<RenalVeinFinding>) => {
    dispatch({ type: 'SET_RENAL', patch });
  }, []);
  const setRenalLevel = useCallback((level: LrvLevel, patch: Partial<VesselLevelMeasurement>) => {
    dispatch({ type: 'SET_RENAL_LEVEL', level, patch });
  }, []);
  const setCavalView = useCallback((view: CavalView) => {
    dispatch({ type: 'SET_CAVAL_VIEW', view });
  }, []);
  const setCavalFinding = useCallback((id: IliacCavalFullId, patch: Partial<IliacCavalFinding>) => {
    dispatch({ type: 'SET_CAVAL_FINDING', id, patch });
  }, []);
  const setCavalLevel = useCallback(
    (id: IliacCavalFullId, level: CavalLevel, patch: Partial<VesselLevelMeasurement>) => {
      dispatch({ type: 'SET_CAVAL_LEVEL', id, level, patch });
    },
    [],
  );
  const setGonadal = useCallback((side: Side, patch: Partial<GonadalVeinFinding>) => {
    dispatch({ type: 'SET_GONADAL', side, patch });
  }, []);
  const setPlexus = useCallback((side: Side, patch: Partial<PelvicPlexusFinding>) => {
    dispatch({ type: 'SET_PLEXUS', side, patch });
  }, []);
  const setExtrapelvic = useCallback((patch: Partial<ExtrapelvicVarices>) => {
    dispatch({ type: 'SET_EXTRAPELVIC', patch });
  }, []);
  const setSmas = useCallback((patch: Partial<SmasFinding>) => {
    dispatch({ type: 'SET_SMAS', patch });
  }, []);
  const setMals = useCallback((patch: Partial<MalsFinding>) => {
    dispatch({ type: 'SET_MALS', patch });
  }, []);
  const handleCeap = useCallback((ceap: CeapClassification | undefined) => {
    dispatch({ type: 'SET_CEAP', ceap });
  }, []);
  const handleSvp = useCallback((svp: SvpClassification | undefined) => {
    dispatch({ type: 'SET_SVP', svp });
  }, []);
  const handleRecommendations = useCallback((next: ReadonlyArray<Recommendation>) => {
    dispatch({ type: 'SET_RECOMMENDATIONS', recommendations: next });
  }, []);

  const handleCommitStroke = useCallback((stroke: DrawingStroke) => {
    dispatch({ type: 'COMMIT_STROKE', stroke });
  }, []);
  const handleEraseStroke = useCallback((strokeId: string) => {
    dispatch({ type: 'ERASE_STROKE', strokeId });
  }, []);
  const handleUndoStroke = useCallback(() => dispatch({ type: 'UNDO_STROKE' }), []);
  const handleClearDrawings = useCallback(() => dispatch({ type: 'CLEAR_DRAWINGS' }), []);

  const addEscapePoint = useCallback(() => {
    dispatch({
      type: 'ADD_ESCAPE_POINT',
      point: { id: makeId('ep'), type: 'perineal', side: 'left' },
    });
  }, []);

  const handleGenerateImpression = useCallback(() => {
    const ln = buildLocalizedNarrativeFromForm(formState, t);
    const text = [ln.rightFindings, ln.leftFindings, ...ln.conclusions]
      .map((s) => s.trim())
      .filter(Boolean)
      .join('\n');
    dispatch({ type: 'SET_IMPRESSION', impression: text });
  }, [formState, t]);

  const handleApplyTemplate = useCallback(() => {
    if (!pendingTemplate) return;
    const recommendations: Recommendation[] = (pendingTemplate.recommendations ?? []).map((r) => ({
      id: makeId('rec'),
      text: r.textFallback,
      textKey: r.textKey,
    }));
    dispatch({
      type: 'APPLY_TEMPLATE',
      context: pendingTemplate.context ?? { sex: 'female' },
      findings: pendingTemplate.findings,
      impression: t(pendingTemplate.impressionKey, pendingTemplate.impressionFallback),
      recommendations,
    });
    notifications.show({
      title: t('iliacPelvicVenous.actions.templateApplied', 'Template applied'),
      message: t(pendingTemplate.nameKey, pendingTemplate.nameFallback),
      color: 'blue',
    });
    setPendingTemplate(null);
  }, [pendingTemplate, t]);

  const handleNewCaseConfirm = useCallback(() => {
    dispatch({ type: 'RESET' });
    setNewCaseOpen(false);
    notifications.show({
      title: t('iliacPelvicVenous.actions.newCaseToastTitle', 'New case started'),
      message: t('iliacPelvicVenous.actions.newCaseToastMessage', 'All data cleared.'),
      color: 'green',
    });
  }, [t]);

  // Select option builder
  const opts = useCallback(
    (values: ReadonlyArray<string>, ns: string) =>
      values.map((v) => ({ value: v, label: t(`iliacPelvicVenous.${ns}.${v}`, v) })),
    [t],
  );

  const renal = state.findings.renal ?? {};
  const smas = state.findings.specialConsiderations?.smas ?? {};
  const mals = state.findings.specialConsiderations?.mals ?? {};

  return (
    <Stack gap="md" data-testid="iliac-pelvic-venous-form">
      <BackToStudiesButton />
      <EncounterContextBanner />

      <Group justify="flex-end" gap="xs">
        <Menu shadow="md" width={300} position="bottom-end">
          <Menu.Target>
            <EMRButton variant="secondary" size="sm" icon={IconStack2}>
              {t('iliacPelvicVenous.templates.menuLabel', 'Templates')}
            </EMRButton>
          </Menu.Target>
          <Menu.Dropdown>
            {ILIAC_PELVIC_VENOUS_TEMPLATES.map((tpl) => (
              <Menu.Item key={tpl.id} onClick={() => setPendingTemplate(tpl)}>
                {t(tpl.nameKey, tpl.nameFallback)}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
        <EMRButton
          variant="secondary"
          size="sm"
          icon={IconPlus}
          onClick={() => setNewCaseOpen(true)}
        >
          {t('iliacPelvicVenous.actions.newCase', '+ New case')}
        </EMRButton>
      </Group>

      {/* Zone 0 — context / technique */}
      <IliacZoneCard
        title={t('iliacPelvicVenous.zone.context.title', 'Clinical context & technique')}
        testId="iliac-zone-context"
      >
        <Grid>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <EMRSelect
              label={t('iliacPelvicVenous.field.sex', 'Sex')}
              data={opts(SEX_VALUES, 'sex')}
              value={state.context.sex ?? null}
              onChange={(v) => setContext({ sex: (v as Sex) ?? undefined })}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 8 }}>
            <EMRMultiSelect
              label={t('iliacPelvicVenous.field.symptoms', 'Symptoms')}
              data={opts(SYMPTOM_VALUES, 'symptom')}
              value={[...(state.context.symptoms ?? [])]}
              onChange={(v) => setContext({ symptoms: v as Symptom[] })}
              searchable
              clearable
            />
          </Grid.Col>
          <Grid.Col span={12}>
            <EMRMultiSelect
              label={t('iliacPelvicVenous.field.riskFactors', 'Risk factors')}
              data={opts(RISK_FACTOR_VALUES, 'riskFactor')}
              value={[...(state.context.riskFactors ?? [])]}
              onChange={(v) => setContext({ riskFactors: v as RiskFactor[] })}
              searchable
              clearable
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <EMRMultiSelect
              label={t('iliacPelvicVenous.field.approaches', 'Approaches used')}
              data={opts(APPROACH_VALUES, 'approach')}
              value={[...(state.context.approaches ?? [])]}
              onChange={(v) => setContext({ approaches: v as Approach[] })}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <EMRMultiSelect
              label={t('iliacPelvicVenous.field.positions', 'Patient positions')}
              data={opts(POSITION_VALUES, 'position')}
              value={[...(state.context.positions ?? [])]}
              onChange={(v) => setContext({ positions: v as StudyPositionValue[] })}
            />
          </Grid.Col>
          <Grid.Col span={12}>
            <EMRCheckbox
              label={t('iliacPelvicVenous.field.valsalva', 'Valsalva performed')}
              checked={state.context.valsalvaPerformed ?? false}
              onChange={(checked) => setContext({ valsalvaPerformed: checked })}
            />
          </Grid.Col>
        </Grid>
      </IliacZoneCard>

      {/* Zone 1 — left renal vein (nutcracker) */}
      <IliacZoneCard
        title={t('iliacPelvicVenous.zone.renal.title', 'Left renal vein (nutcracker screening)')}
        subtitle={t(
          'iliacPelvicVenous.zone.renal.subtitle',
          'Ultrasound is screening only — confirm with CT/MR venography.',
        )}
        testId="iliac-zone-renal"
      >
        <Grid>
          <Grid.Col span={{ base: 6, sm: 4 }}>
            <EMRNumberInput
              label={t('iliacPelvicVenous.field.peakVelocityRatio', 'Peak-velocity ratio')}
              value={renal.peakVelocityRatio ?? ''}
              onChange={(v) => setRenal({ peakVelocityRatio: toNum(v) })}
              min={0}
              max={20}
              step={0.1}
              decimalScale={1}
              error={
                (renal.peakVelocityRatio ?? 0) >= ILIAC_THRESHOLDS.renalPeakVelocityRatio
                  ? t('iliacPelvicVenous.warn.ratio7', '≥ 7.0')
                  : undefined
              }
            />
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 4 }}>
            <EMRNumberInput
              label={t('iliacPelvicVenous.field.apDiameterRatio', 'AP-diameter ratio')}
              value={renal.apDiameterRatio ?? ''}
              onChange={(v) => setRenal({ apDiameterRatio: toNum(v) })}
              min={0}
              max={20}
              step={0.1}
              decimalScale={1}
              error={
                (renal.apDiameterRatio ?? 0) >= ILIAC_THRESHOLDS.renalApDiameterRatio
                  ? t('iliacPelvicVenous.warn.ratio5', '≥ 5')
                  : undefined
              }
            />
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 4 }}>
            <EMRNumberInput
              label={t('iliacPelvicVenous.field.hilarDiameterMm', 'Hilar (distal) LRV diameter (mm)')}
              value={renal.levels?.distal?.diameterMm ?? ''}
              onChange={(v) => setRenalLevel('distal', { diameterMm: toNum(v) })}
              min={0}
              max={30}
              step={0.1}
              decimalScale={1}
            />
          </Grid.Col>
          <Grid.Col span={12}>
            <Text className={classes.fieldHint}>
              {t(
                'iliacPelvicVenous.field.lrvLevels',
                'LRV velocities (cm/s) — proximal (IVC) · mid (pre-aortic) · distal (hilum)',
              )}
            </Text>
            <Group gap="sm" grow>
              {LRV_LEVELS.map((lvl) => (
                <EMRNumberInput
                  key={lvl}
                  label={t(`iliacPelvicVenous.level.${lvl}`, lvl)}
                  value={renal.levels?.[lvl]?.velocityCmS ?? ''}
                  onChange={(v) => setRenalLevel(lvl, { velocityCmS: toNum(v) })}
                  min={0}
                  max={400}
                  step={1}
                  data-testid={`iliac-renal-vel-${lvl}`}
                />
              ))}
            </Group>
          </Grid.Col>
          <Grid.Col span={12}>
            <div className={classes.flagGroup}>
              <EMRCheckbox
                label={t('iliacPelvicVenous.field.beakSign', 'Beak sign')}
                checked={renal.beakSign ?? false}
                onChange={(checked) => setRenal({ beakSign: checked })}
              />
              <EMRCheckbox
                label={t('iliacPelvicVenous.field.hilarVarices', 'Renal hilar varices')}
                checked={renal.hilarVarices ?? false}
                onChange={(checked) => setRenal({ hilarVarices: checked })}
              />
              <EMRCheckbox
                label={t('iliacPelvicVenous.field.retroAortic', 'Retro-aortic left renal vein')}
                checked={renal.retroAortic ?? false}
                onChange={(checked) => setRenal({ retroAortic: checked })}
              />
              <EMRCheckbox
                label={t('iliacPelvicVenous.field.confirmImaging', 'Confirmatory imaging recommended')}
                checked={renal.confirmatoryImagingRecommended ?? false}
                onChange={(checked) => setRenal({ confirmatoryImagingRecommended: checked })}
              />
            </div>
          </Grid.Col>
        </Grid>
      </IliacZoneCard>

      {/* Zone 2 — iliac & caval */}
      <IliacZoneCard
        title={t('iliacPelvicVenous.zone.caval.title', 'Iliac & caval veins (May-Thurner / DVT)')}
        subtitle={t(
          'iliacPelvicVenous.zone.caval.subtitle',
          'Obstruction is screening only — confirm with IVUS / CT venography.',
        )}
        testId="iliac-zone-caval"
      >
        <IliacCavalTable
          findings={state.findings.caval ?? {}}
          view={state.cavalView}
          onViewChange={setCavalView}
          onChange={setCavalFinding}
          onLevelChange={setCavalLevel}
        />
      </IliacZoneCard>

      {/* Zone 3 — gonadal veins (per side) */}
      <IliacZoneCard
        title={t('iliacPelvicVenous.zone.gonadal.title', 'Gonadal (ovarian) veins')}
        testId="iliac-zone-gonadal"
      >
        <Grid>
          {(['left', 'right'] as const).map((side) => {
            const g = state.findings.gonadal?.[side] ?? {};
            return (
              <Grid.Col span={{ base: 12, md: 6 }} key={side}>
                <EMRCard withBorder shadow="none" radius="var(--emr-border-radius-lg)" p="md">
                  <Stack gap="sm">
                    <span className={classes.sideHeader}>
                      {t(`iliacPelvicVenous.side.${side}`, side)}
                    </span>
                    <EMRNumberInput
                      label={t('iliacPelvicVenous.field.diameterMm', 'Diameter (mm)')}
                      value={g.diameterMm ?? ''}
                      onChange={(v) => setGonadal(side, { diameterMm: toNum(v) })}
                      min={0}
                      max={30}
                      step={0.1}
                      decimalScale={1}
                      error={
                        (g.diameterMm ?? 0) > ILIAC_THRESHOLDS.gonadalDiameterMm
                          ? t('iliacPelvicVenous.warn.gonadalDia5', '> 5 mm')
                          : undefined
                      }
                    />
                    <EMRCheckbox
                      label={t('iliacPelvicVenous.field.refluxPresent', 'Reflux present')}
                      checked={g.refluxPresent ?? false}
                      onChange={(checked) => setGonadal(side, { refluxPresent: checked })}
                    />
                    <Group gap="sm" grow>
                      <EMRSelect
                        label={t('iliacPelvicVenous.field.refluxTrigger', 'Trigger')}
                        data={opts(REFLUX_TRIGGER_VALUES, 'refluxTrigger')}
                        value={g.refluxTrigger ?? null}
                        onChange={(v) => setGonadal(side, { refluxTrigger: (v as RefluxTrigger) ?? undefined })}
                        clearable
                      />
                      <EMRSelect
                        label={t('iliacPelvicVenous.field.refluxType', 'Reflux type')}
                        data={opts(REFLUX_TYPE_VALUES, 'refluxType')}
                        value={g.refluxType ?? null}
                        onChange={(v) => setGonadal(side, { refluxType: (v as RefluxType) ?? undefined })}
                        clearable
                      />
                    </Group>
                    <Group gap="sm" grow>
                      <EMRNumberInput
                        label={t('iliacPelvicVenous.field.refluxDurationS', 'Reflux duration (s)')}
                        value={g.refluxDurationS ?? ''}
                        onChange={(v) => setGonadal(side, { refluxDurationS: toNum(v) })}
                        min={0}
                        max={30}
                        step={0.1}
                        decimalScale={1}
                        error={
                          (g.refluxDurationS ?? 0) > ILIAC_THRESHOLDS.refluxDurationS
                            ? t('iliacPelvicVenous.warn.dur1', '> 1 s')
                            : undefined
                        }
                      />
                      <EMRSelect
                        label={t('iliacPelvicVenous.field.flowDirection', 'Flow direction')}
                        data={opts(FLOW_DIRECTION_VALUES, 'flowDirection')}
                        value={g.flowDirection ?? null}
                        onChange={(v) => setGonadal(side, { flowDirection: (v as FlowDirection) ?? undefined })}
                        clearable
                      />
                    </Group>
                  </Stack>
                </EMRCard>
              </Grid.Col>
            );
          })}
        </Grid>
      </IliacZoneCard>

      {/* Zone 4 — pelvic plexus (per side) */}
      <IliacZoneCard
        title={t('iliacPelvicVenous.zone.plexus.title', 'Pelvic venous plexus')}
        testId="iliac-zone-plexus"
      >
        <Grid>
          {(['left', 'right'] as const).map((side) => {
            const p = state.findings.plexus?.[side] ?? {};
            return (
              <Grid.Col span={{ base: 12, md: 6 }} key={side}>
                <EMRCard withBorder shadow="none" radius="var(--emr-border-radius-lg)" p="md">
                  <Stack gap="sm">
                    <span className={classes.sideHeader}>
                      {t(`iliacPelvicVenous.side.${side}`, side)}
                    </span>
                    <Group gap="sm" grow>
                      <EMRNumberInput
                        label={t('iliacPelvicVenous.field.largestDiameterMm', 'Largest diameter (mm)')}
                        value={p.largestDiameterMm ?? ''}
                        onChange={(v) => setPlexus(side, { largestDiameterMm: toNum(v) })}
                        min={0}
                        max={30}
                        step={0.1}
                        decimalScale={1}
                        error={
                          (p.largestDiameterMm ?? 0) >= ILIAC_THRESHOLDS.plexusDiameterMm
                            ? t('iliacPelvicVenous.warn.dia5', '≥ 5 mm')
                            : undefined
                        }
                      />
                      <EMRNumberInput
                        label={t('iliacPelvicVenous.field.flowVelocityCmS', 'Flow velocity (cm/s)')}
                        value={p.flowVelocityCmS ?? ''}
                        onChange={(v) => setPlexus(side, { flowVelocityCmS: toNum(v) })}
                        min={0}
                        max={100}
                        step={1}
                      />
                    </Group>
                    <Group gap="sm" grow>
                      <EMRNumberInput
                        label={t('iliacPelvicVenous.field.refluxDurationS', 'Reflux duration (s)')}
                        value={p.refluxDurationS ?? ''}
                        onChange={(v) => setPlexus(side, { refluxDurationS: toNum(v) })}
                        min={0}
                        max={30}
                        step={0.1}
                        decimalScale={1}
                      />
                      <EMRSelect
                        label={t('iliacPelvicVenous.field.tortuosity', 'Tortuosity')}
                        data={opts(TORTUOSITY_VALUES, 'tortuosity')}
                        value={p.tortuosity ?? null}
                        onChange={(v) => setPlexus(side, { tortuosity: (v as Tortuosity) ?? undefined })}
                        clearable
                      />
                    </Group>
                    <div className={classes.flagGroup}>
                      <EMRCheckbox
                        label={t('iliacPelvicVenous.field.crossingVeins', 'Crossing (arcuate) veins')}
                        checked={p.crossingVeins ?? false}
                        onChange={(checked) => setPlexus(side, { crossingVeins: checked })}
                      />
                      <EMRCheckbox
                        label={t('iliacPelvicVenous.field.crossPelvicCollateral', 'Cross-pelvic collateral')}
                        checked={p.crossPelvicCollateral ?? false}
                        onChange={(checked) => setPlexus(side, { crossPelvicCollateral: checked })}
                      />
                    </div>
                  </Stack>
                </EMRCard>
              </Grid.Col>
            );
          })}
        </Grid>
      </IliacZoneCard>

      {/* Zone 5 — escape points + extrapelvic varices */}
      <IliacZoneCard
        title={t('iliacPelvicVenous.zone.escape.title', 'Escape points & extrapelvic varices')}
        testId="iliac-zone-escape"
      >
        <Stack gap="sm">
          <Group justify="space-between">
            <span className={classes.groupLabel}>
              {t('iliacPelvicVenous.field.escapePoints', 'Escape points')}
            </span>
            <EMRButton variant="secondary" size="xs" icon={IconPlus} onClick={addEscapePoint}>
              {t('iliacPelvicVenous.actions.addEscapePoint', 'Add')}
            </EMRButton>
          </Group>
          {(state.findings.escapePoints ?? []).map((ep) => (
            <div key={ep.id} className={classes.escapeRow}>
              <EMRSelect
                label={t('iliacPelvicVenous.field.escapePointType', 'Point')}
                data={opts(ESCAPE_POINT_VALUES, 'escapePoint')}
                value={ep.type}
                onChange={(v) =>
                  dispatch({
                    type: 'UPDATE_ESCAPE_POINT',
                    id: ep.id,
                    patch: { type: (v as EscapePointType) ?? 'perineal' },
                  })
                }
                fullWidth={false}
                style={{ width: 150 }}
              />
              <EMRSelect
                label={t('iliacPelvicVenous.field.side', 'Side')}
                data={[
                  { value: 'left', label: t('iliacPelvicVenous.side.left', 'Left') },
                  { value: 'right', label: t('iliacPelvicVenous.side.right', 'Right') },
                ]}
                value={ep.side}
                onChange={(v) =>
                  dispatch({
                    type: 'UPDATE_ESCAPE_POINT',
                    id: ep.id,
                    patch: { side: (v as Side) ?? 'left' },
                  })
                }
                fullWidth={false}
                style={{ width: 120 }}
              />
              <EMRNumberInput
                label={t('iliacPelvicVenous.field.diameterMm', 'Diameter (mm)')}
                value={ep.diameterMm ?? ''}
                onChange={(v) =>
                  dispatch({ type: 'UPDATE_ESCAPE_POINT', id: ep.id, patch: { diameterMm: toNum(v) } })
                }
                min={0}
                max={20}
                step={0.1}
                decimalScale={1}
                fullWidth={false}
                style={{ width: 130 }}
              />
              <EMRIconButton
                icon={IconTrash}
                color="red"
                variant="subtle"
                label={t('iliacPelvicVenous.actions.removeEscapePoint', 'Remove')}
                onClick={() => dispatch({ type: 'REMOVE_ESCAPE_POINT', id: ep.id })}
              />
            </div>
          ))}
          <span className={classes.groupLabel} style={{ marginTop: 6 }}>
            {t('iliacPelvicVenous.field.extrapelvic', 'Extrapelvic varices')}
          </span>
          <div className={classes.flagGroup}>
            {(
              [
                ['vulvar', 'Vulvar'],
                ['perineal', 'Perineal'],
                ['gluteal', 'Gluteal'],
                ['posteromedialThigh', 'Posteromedial thigh'],
                ['sciatic', 'Sciatic'],
              ] as const
            ).map(([key, fallback]) => (
              <EMRCheckbox
                key={key}
                label={t(`iliacPelvicVenous.extrapelvic.${key}`, fallback)}
                checked={state.findings.extrapelvic?.[key] ?? false}
                onChange={(checked) => setExtrapelvic({ [key]: checked })}
              />
            ))}
          </div>
        </Stack>
      </IliacZoneCard>

      {/* Zone 6 — special considerations (SMAS / MALS) */}
      <IliacZoneCard
        title={t('iliacPelvicVenous.zone.special.title', 'Special considerations (SMAS / MALS)')}
        subtitle={t(
          'iliacPelvicVenous.zone.special.subtitle',
          'Arterial compression syndromes — interrogate MALS in hypermobile patients regardless of referral.',
        )}
        testId="iliac-zone-special"
      >
        <Stack gap="sm">
          <span className={classes.groupLabel}>
            {t('iliacPelvicVenous.special.smas', 'SMA syndrome (SMAS)')}
          </span>
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <EMRNumberInput
                label={t('iliacPelvicVenous.field.smaAortaAngle', 'SMA–aorta angle (°)')}
                value={smas.smaAortaAngleDeg ?? ''}
                onChange={(v) => setSmas({ smaAortaAngleDeg: toNum(v) })}
                min={0}
                max={180}
                step={1}
                data-testid="iliac-smas-angle"
                error={
                  smas.smaAortaAngleDeg !== undefined &&
                  smas.smaAortaAngleDeg < ILIAC_THRESHOLDS.smasAortaAngleDeg
                    ? t('iliacPelvicVenous.warn.angle25', '< 25°')
                    : undefined
                }
              />
            </Grid.Col>
          </Grid>
          <span className={classes.groupLabel} style={{ marginTop: 6 }}>
            {t('iliacPelvicVenous.special.mals', 'Median arcuate ligament syndrome (MALS)')}
          </span>
          <Grid>
            <Grid.Col span={{ base: 6, sm: 3 }}>
              <EMRNumberInput
                label={t('iliacPelvicVenous.field.caInspiratoryPsv', 'Celiac PSV — inspiration (cm/s)')}
                value={mals.caInspiratoryPsvCmS ?? ''}
                onChange={(v) => setMals({ caInspiratoryPsvCmS: toNum(v) })}
                min={0}
                max={600}
                step={1}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 3 }}>
              <EMRNumberInput
                label={t('iliacPelvicVenous.field.caExpiratoryPsv', 'Celiac PSV — expiration (cm/s)')}
                value={mals.caExpiratoryPsvCmS ?? ''}
                onChange={(v) => setMals({ caExpiratoryPsvCmS: toNum(v) })}
                min={0}
                max={600}
                step={1}
                data-testid="iliac-mals-ca-exp"
                error={
                  (mals.caExpiratoryPsvCmS ?? 0) > ILIAC_THRESHOLDS.malsExpiratoryPsvCmS
                    ? t('iliacPelvicVenous.warn.psv200', '> 200 cm/s')
                    : undefined
                }
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 3 }}>
              <EMRNumberInput
                label={t('iliacPelvicVenous.field.chaPsv', 'Common hepatic artery PSV (cm/s)')}
                value={mals.chaPsvCmS ?? ''}
                onChange={(v) => setMals({ chaPsvCmS: toNum(v) })}
                min={0}
                max={600}
                step={1}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 3 }}>
              <EMRNumberInput
                label={t('iliacPelvicVenous.field.splenicPsv', 'Splenic artery PSV (cm/s)')}
                value={mals.splenicPsvCmS ?? ''}
                onChange={(v) => setMals({ splenicPsvCmS: toNum(v) })}
                min={0}
                max={600}
                step={1}
              />
            </Grid.Col>
            <Grid.Col span={12}>
              <EMRCheckbox
                label={t('iliacPelvicVenous.field.hookSign', 'Hook-shaped celiac artery')}
                checked={mals.hookSign ?? false}
                onChange={(checked) => setMals({ hookSign: checked })}
              />
            </Grid.Col>
          </Grid>
        </Stack>
      </IliacZoneCard>

      {/* Diagram — static illustration, free-draw + text (no coloring) */}
      <IliacZoneCard
        title={t('iliacPelvicVenous.zone.diagram.title', 'Pelvic venous map')}
        subtitle={t(
          'iliacPelvicVenous.zone.diagram.subtitle',
          'Draw findings and add text labels directly on the illustration.',
        )}
        testId="iliac-zone-diagram"
      >
        <AnatomyDiagramSection
          view="abdominal-pelvic"
          segments={{}}
          overlay={false}
          enableSegmentEdit={false}
          drawings={state.drawings}
          onCommitStroke={handleCommitStroke}
          onEraseStroke={handleEraseStroke}
          onUndo={handleUndoStroke}
          onClear={handleClearDrawings}
        />
      </IliacZoneCard>

      {/* Classification — SVP (primary) + CEAP link */}
      <SVPPicker value={state.svp} onChange={handleSvp} />
      <CEAPPicker value={state.ceap} onChange={handleCeap} />

      {/* Impression + comments */}
      <IliacZoneCard
        title={t('iliacPelvicVenous.zone.impression.title', 'Impression')}
        testId="iliac-zone-impression"
      >
        <Stack gap="sm">
          <Group justify="flex-end">
            <EMRButton
              variant="secondary"
              size="xs"
              icon={IconRefresh}
              onClick={handleGenerateImpression}
            >
              {t('iliacPelvicVenous.actions.generateImpression', 'Generate from findings')}
            </EMRButton>
          </Group>
          <EMRTextarea
            value={state.impression}
            onChange={(v) => dispatch({ type: 'SET_IMPRESSION', impression: v })}
            autosize
            minRows={4}
            data-testid="iliac-impression"
          />
          <EMRTextarea
            label={t('iliacPelvicVenous.narrative.sonographerComments', 'Sonographer comments')}
            value={state.sonographerComments}
            onChange={(v) => dispatch({ type: 'SET_SONOGRAPHER', comments: v })}
            autosize
            minRows={2}
          />
          <EMRTextarea
            label={t('iliacPelvicVenous.narrative.clinicianComments', 'Clinician comments')}
            value={state.clinicianComments}
            onChange={(v) => dispatch({ type: 'SET_CLINICIAN', comments: v })}
            autosize
            minRows={2}
            data-testid="iliac-clinician"
          />
        </Stack>
      </IliacZoneCard>

      <RecommendationsBlock items={state.recommendations} onChange={handleRecommendations} />

      <FormActions
        form={formState}
        lastSavedAt={lastSavedAt}
        hasUnsavedChanges={false}
        onSaveDraft={() => {
          if (encounter) {
            lastPersistedRef.current = state;
            setStudyState<IliacPelvicVenousFormStateV2>('iliacPelvicVenous', state);
            setLastSavedAt(new Date());
          }
        }}
        exportsDisabled={!hasAnyFindings}
        exportsDisabledReason={t(
          'iliacPelvicVenous.actions.enterFindingFirst',
          'Enter at least one finding before exporting.',
        )}
        baseFilename={`iliac-pelvic-${state.studyDate || encounter?.header.encounterDate || 'report'}`}
      />

      <ConfirmDialog
        opened={pendingTemplate !== null}
        onClose={() => setPendingTemplate(null)}
        title={t('iliacPelvicVenous.actions.applyTemplateConfirmTitle', 'Apply template?')}
        message={t(
          'iliacPelvicVenous.actions.applyTemplateConfirmBody',
          'This will replace current findings, impression, and recommendations.',
        )}
        confirmLabel={t('iliacPelvicVenous.actions.applyTemplate', 'Apply template')}
        cancelLabel={t('iliacPelvicVenous.actions.cancel', 'Cancel')}
        onConfirm={handleApplyTemplate}
      />

      <ConfirmDialog
        opened={newCaseOpen}
        onClose={() => setNewCaseOpen(false)}
        title={t('iliacPelvicVenous.actions.newCaseConfirmTitle', 'Start a new case?')}
        message={t(
          'iliacPelvicVenous.actions.newCaseConfirmBody',
          'This will erase all current data. Unsaved changes will be lost.',
        )}
        confirmLabel={t('iliacPelvicVenous.actions.newCaseConfirm', 'Discard & start new')}
        cancelLabel={t('iliacPelvicVenous.actions.cancel', 'Cancel')}
        onConfirm={handleNewCaseConfirm}
        destructive
      />
    </Stack>
  );
});

export default IliacPelvicVenousForm;
