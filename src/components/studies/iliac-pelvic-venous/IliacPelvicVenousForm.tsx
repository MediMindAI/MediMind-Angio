// SPDX-License-Identifier: Apache-2.0
/**
 * IliacPelvicVenousForm — iliac & pelvic venous duplex (pelvic venous disorders).
 *
 * Shaped like a standard pelvic venous duplex report (clinician feedback
 * 2026-11): clinical context, one IVC / RIGHT / LEFT vein table with the same
 * columns on every row, LEFT gonadal vein (diameter + reflux), a STATIC
 * illustration the clinician free-draws + text-labels on, optional SVP / CEAP,
 * and a conclusion followed by ONE free-text comments box.
 *
 * Mirrors CarotidForm for the encounter-pivot plumbing: per-study reducer state
 * persisted via `useEncounter().setStudyState('iliacPelvicVenous', state)`, with
 * `stateToFormState` projecting the zone findings under the conventional
 * `parameters.segmentFindings` key the FHIR/narrative/PDF readers expect.
 */

import { memo, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Stack, Group, Grid, Menu } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconStack2, IconRefresh } from '@tabler/icons-react';
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
import { ConfirmDialog, EMRButton } from '../../common';
import { EncounterContextBanner } from '../../layout/EncounterContextBanner';
import { BackToStudiesButton } from '../../layout/BackToStudiesButton';
import { FormActions } from '../../form/FormActions';
import { CEAPPicker } from '../../form/CEAPPicker';
import { SVPPicker } from '../../form/SVPPicker';
import { defaultCptForStudy, cptDisplay } from '../../../constants/vascular-cpt';
import { localDateToIso } from '../../../services/dateHelpers';
import { numInputToNumber as toNum } from '../../../utils/numberInput';
import { buildLocalizedNarrativeFromForm } from '../../../services/narrativeService';
import {
  type IliacContext,
  type IliacPelvicVenousFindings,
  type IliacCavalFinding,
  type IliacCavalFindings,
  type IliacCavalFullId,
  type GonadalVeinFinding,
  type Sex,
  type Symptom,
  type RiskFactor,
  type Approach,
  type StudyPositionValue,
  SEX_VALUES,
  SYMPTOM_VALUES,
  RISK_FACTOR_VALUES,
  APPROACH_VALUES,
  POSITION_VALUES,
  ILIAC_THRESHOLDS,
  ILIAC_CAVAL_ROW_ORDER,
  pickCurrentIliacFindings,
  joinIliacComments,
} from './config';
import { IliacZoneCard } from './IliacZoneCard';
import { IliacCavalTable } from './IliacCavalTable';
import { ILIAC_PELVIC_VENOUS_TEMPLATES, NORMAL_CAVAL, type IliacTemplate } from './templates';
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
  readonly impression: string;
  readonly impressionEdited: boolean;
  /** The ONE free-text box under the conclusion (rides as `clinicianComments`). */
  readonly clinicianComments: string;
  readonly ceap?: CeapClassification;
  readonly svp?: SvpClassification;
  readonly drawings: ReadonlyArray<DrawingStroke>;
}

type Action =
  | { type: 'SET_CONTEXT'; patch: Partial<IliacContext> }
  | { type: 'SET_CAVAL_FINDING'; id: IliacCavalFullId; patch: Partial<IliacCavalFinding> }
  | { type: 'SET_ALL_NORMAL' }
  | { type: 'SET_GONADAL_LEFT'; patch: Partial<GonadalVeinFinding> }
  | { type: 'SET_IMPRESSION'; impression: string }
  | { type: 'SET_CLINICIAN'; comments: string }
  | { type: 'SET_CEAP'; ceap: CeapClassification | undefined }
  | { type: 'SET_SVP'; svp: SvpClassification | undefined }
  | {
      type: 'APPLY_TEMPLATE';
      context: IliacContext;
      findings: IliacPelvicVenousFindings;
      impression: string;
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

/**
 * Sex comes from the patient details entered on the intake page; never a
 * guessed default (a silent 'female' was recorded for male patients too).
 * Decided under founder delegation 2026-11-12 (sign-off S8).
 */
function sexFromHeader(gender: string | undefined): Sex | undefined {
  return gender === 'female' || gender === 'male' || gender === 'other' ? gender : undefined;
}

function initialState(sex?: Sex): IliacPelvicVenousFormStateV2 {
  return {
    schemaVersion: 2,
    studyType: 'iliacPelvicVenous',
    studyDate: localDateToIso(new Date()) ?? '',
    cptCode: defaultIliacCpt(),
    context: sex ? { sex } : {},
    findings: {},
    impression: '',
    impressionEdited: false,
    clinicianComments: '',
    drawings: [],
  };
}

/** Exported for unit tests only. */
export function reducer(
  state: IliacPelvicVenousFormStateV2,
  action: Action,
): IliacPelvicVenousFormStateV2 {
  switch (action.type) {
    case 'SET_CONTEXT':
      return { ...state, context: { ...state.context, ...action.patch } };
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
    case 'SET_ALL_NORMAL': {
      // Copied from VenousLEForm's SET_ALL_NORMAL (UX-ANGIO-011). Values are the
      // normal template's (S5: patent / full / competent; respirophasic on the
      // iliac + femoral rows), merged over each row so a phasicity / velocity /
      // AP diameter the clinician already measured survives — phasicity only
      // fills where it is still blank.
      const prevCaval = state.findings.caval ?? {};
      const nextCaval: Partial<Record<IliacCavalFullId, IliacCavalFinding>> = { ...prevCaval };
      for (const id of ILIAC_CAVAL_ROW_ORDER) {
        const prev = prevCaval[id];
        nextCaval[id] = {
          ...prev,
          ...NORMAL_CAVAL[id],
          ...(prev?.phasicity ? { phasicity: prev.phasicity } : {}),
        };
      }
      return { ...state, findings: { ...state.findings, caval: nextCaval } };
    }
    case 'SET_GONADAL_LEFT':
      return {
        ...state,
        findings: {
          ...state.findings,
          gonadal: {
            ...state.findings.gonadal,
            left: { ...state.findings.gonadal?.left, ...action.patch },
          },
        },
      };
    case 'SET_IMPRESSION':
      return { ...state, impression: action.impression, impressionEdited: true };
    case 'SET_CLINICIAN':
      return { ...state, clinicianComments: action.comments };
    case 'SET_CEAP':
      return { ...state, ceap: action.ceap };
    case 'SET_SVP':
      return { ...state, svp: action.svp };
    case 'APPLY_TEMPLATE':
      return {
        ...state,
        context: { ...action.context },
        findings: structuredCloneFindings(action.findings),
        impression: action.impression,
        impressionEdited: true,
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
      // Clearing the findings keeps the patient's sex (a demographic, not a finding).
      return { ...initialState(state.context.sex) };
    case 'HYDRATE':
      return action.state;
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

/**
 * True when "all normal" would change a value the clinician already set on any
 * row (e.g. an occluded or incompetent segment) — that case asks first, like a
 * template does. Blank fields and values that already read normal never ask.
 */
export function allNormalOverwritesFindings(caval: IliacCavalFindings): boolean {
  return ILIAC_CAVAL_ROW_ORDER.some((id) => {
    const row = caval[id];
    const normal = NORMAL_CAVAL[id];
    if (!row || !normal) return false;
    // Phasicity is never overwritten by "all normal" (it only fills blanks).
    return (Object.keys(normal) as Array<keyof IliacCavalFinding>).some(
      (k) => k !== 'phasicity' && row[k] !== undefined && row[k] !== normal[k],
    );
  });
}

/** Deep-ish clone so a frozen template seed can't be shared by reference. */
function structuredCloneFindings(f: IliacPelvicVenousFindings): IliacPelvicVenousFindings {
  return {
    caval: f.caval
      ? Object.fromEntries(Object.entries(f.caval).map(([k, v]) => [k, { ...v }]))
      : undefined,
    gonadal: f.gonadal?.left ? { left: { ...f.gonadal.left } } : undefined,
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

/** Fields older drafts carried that the simplified form no longer shows. */
interface LegacyIliacFields {
  readonly header?: unknown;
  readonly cavalView?: unknown;
  readonly sonographerComments?: string;
  readonly recommendations?: ReadonlyArray<Recommendation>;
}

function normalizeHydratedState(raw: IliacPelvicVenousFormStateV2): IliacPelvicVenousFormStateV2 {
  // Strip removed fields so they can't ride into the PDF/FHIR unseen (incl. removed
  // findings zones + the removed ovarian table rows). Text the clinician already
  // wrote (old sonographer comments / recommendations) is folded into the single
  // comments box instead of being lost.
  const {
    header: _h,
    cavalView: _v,
    sonographerComments,
    recommendations,
    ...rest
  } = raw as IliacPelvicVenousFormStateV2 & LegacyIliacFields;
  void _h;
  void _v;
  const base: IliacPelvicVenousFormStateV2 = {
    ...initialState(),
    ...rest,
    findings: pickCurrentIliacFindings(rest.findings),
    drawings: rest.drawings ?? [],
  };
  const legacyText = joinIliacComments([
    base.clinicianComments,
    sonographerComments,
    ...(recommendations ?? []).map((r) => r.text),
  ]);
  return { ...base, schemaVersion: 2, clinicianComments: legacyText };
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
      clinicianComments: s.clinicianComments || undefined,
    },
    recommendations: [],
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
    return initialState(sexFromHeader(encounter?.header.patientGender));
  });

  useEffect(() => {
    const fromEncounter = encounter?.studies?.iliacPelvicVenous;
    if (!isHydratableState(fromEncounter)) return;
    if (JSON.stringify(fromEncounter) === JSON.stringify(state)) return;
    dispatch({ type: 'HYDRATE', state: normalizeHydratedState(fromEncounter) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounter?.studies?.iliacPelvicVenous]);

  // Save time + failure are read by FormActions from EncounterContext
  // (UX-ANGIO-002 L3b): the form no longer keeps its own copy.
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
  }, [encounter, setStudyState, state]);

  const [pendingTemplate, setPendingTemplate] = useState<IliacTemplate | null>(null);
  const [newCaseOpen, setNewCaseOpen] = useState(false);
  const [allNormalConfirmOpen, setAllNormalConfirmOpen] = useState(false);

  const formState = useMemo(() => stateToFormState(state, encounter), [state, encounter]);

  // Export gate (audit M7): an untouched form would otherwise emit a confident
  // "normal" report. Require at least one finding / symptom / written conclusion
  // before PDF/FHIR export is allowed. SVP and CEAP are optional and never gate.
  const hasAnyFindings = useMemo(() => {
    const f = state.findings;
    const hasCaval = Object.values(f.caval ?? {}).some(
      (row) => row && Object.values(row).some((v) => v !== undefined),
    );
    const left = f.gonadal?.left;
    return (
      hasCaval ||
      !!(left && (left.diameterMm !== undefined || left.refluxPresent !== undefined)) ||
      !!(state.context.symptoms && state.context.symptoms.length > 0) ||
      state.impression.trim().length > 0
    );
  }, [state.findings, state.context.symptoms, state.impression]);

  // ---- Handlers ----
  const setContext = useCallback((patch: Partial<IliacContext>) => {
    dispatch({ type: 'SET_CONTEXT', patch });
  }, []);
  const setCavalFinding = useCallback((id: IliacCavalFullId, patch: Partial<IliacCavalFinding>) => {
    dispatch({ type: 'SET_CAVAL_FINDING', id, patch });
  }, []);
  const handleSetAllNormal = useCallback(() => {
    if (allNormalOverwritesFindings(state.findings.caval ?? {})) {
      setAllNormalConfirmOpen(true);
      return;
    }
    dispatch({ type: 'SET_ALL_NORMAL' });
  }, [state.findings.caval]);
  const handleConfirmAllNormal = useCallback(() => {
    dispatch({ type: 'SET_ALL_NORMAL' });
    setAllNormalConfirmOpen(false);
  }, []);
  const setGonadalLeft = useCallback((patch: Partial<GonadalVeinFinding>) => {
    dispatch({ type: 'SET_GONADAL_LEFT', patch });
  }, []);
  const handleCeap = useCallback((ceap: CeapClassification | undefined) => {
    dispatch({ type: 'SET_CEAP', ceap });
  }, []);
  const handleSvp = useCallback((svp: SvpClassification | undefined) => {
    dispatch({ type: 'SET_SVP', svp });
  }, []);
  const handleCommitStroke = useCallback((stroke: DrawingStroke) => {
    dispatch({ type: 'COMMIT_STROKE', stroke });
  }, []);
  const handleEraseStroke = useCallback((strokeId: string) => {
    dispatch({ type: 'ERASE_STROKE', strokeId });
  }, []);
  const handleUndoStroke = useCallback(() => dispatch({ type: 'UNDO_STROKE' }), []);
  const handleClearDrawings = useCallback(() => dispatch({ type: 'CLEAR_DRAWINGS' }), []);

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
    dispatch({
      type: 'APPLY_TEMPLATE',
      // A template fills findings, never demographics: keep the patient's sex.
      context: { ...pendingTemplate.context, sex: state.context.sex },
      findings: pendingTemplate.findings,
      impression: t(pendingTemplate.impressionKey, pendingTemplate.impressionFallback),
    });
    notifications.show({
      title: t('iliacPelvicVenous.actions.templateApplied', 'Template applied'),
      message: t(pendingTemplate.nameKey, pendingTemplate.nameFallback),
      color: 'blue',
    });
    setPendingTemplate(null);
  }, [pendingTemplate, state.context.sex, t]);

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

  const gonadalLeft = state.findings.gonadal?.left ?? {};

  return (
    <Stack gap="md" className={classes.wrap} data-testid="iliac-pelvic-venous-form">
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
          {t('iliacPelvicVenous.actions.newCase', 'New case')}
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
              label={t('iliacPelvicVenous.field.riskFactors', 'Comorbidities')}
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

      {/* Table + diagram (UX-ANGIO-025 L4): stacked below 1280px; from 1280px the
          diagram sits in a sticky rail beside the vein table (see .module.css).
          DOM order is unchanged, so the stacked order is exactly as before. */}
      <div className={classes.tableDiagramLayout}>
        <div className={classes.tableColumn}>
          {/* Iliac & caval — IVC / RIGHT / LEFT, same columns on every row */}
          <IliacZoneCard
            title={t('iliacPelvicVenous.zone.caval.title', 'Iliac & caval veins')}
            testId="iliac-zone-caval"
          >
            <IliacCavalTable
              findings={state.findings.caval ?? {}}
              onChange={setCavalFinding}
              onSetAllNormal={handleSetAllNormal}
            />
          </IliacZoneCard>

          {/* Gonadal vein — LEFT only (diameter + reflux) */}
          <IliacZoneCard
            title={t('iliacPelvicVenous.zone.gonadal.title', 'Left gonadal (ovarian) vein')}
            testId="iliac-zone-gonadal"
          >
            <Grid>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <EMRNumberInput
                  label={t('iliacPelvicVenous.field.diameterMm', 'Diameter (mm)')}
                  value={gonadalLeft.diameterMm ?? ''}
                  onChange={(v) => setGonadalLeft({ diameterMm: toNum(v) })}
                  min={0}
                  max={30}
                  step={0.1}
                  decimalScale={1}
                  data-testid="iliac-gonadal-left-diameter"
                  error={
                    (gonadalLeft.diameterMm ?? 0) > ILIAC_THRESHOLDS.gonadalDiameterMm
                      ? t('iliacPelvicVenous.warn.gonadalDia5', '> 5 mm')
                      : undefined
                  }
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <EMRSelect
                  label={t('iliacPelvicVenous.field.reflux', 'Reflux')}
                  data={[
                    { value: 'yes', label: t('iliacPelvicVenous.reflux.yes', 'Present') },
                    { value: 'no', label: t('iliacPelvicVenous.reflux.no', 'Absent') },
                  ]}
                  value={
                    gonadalLeft.refluxPresent === undefined ? null : gonadalLeft.refluxPresent ? 'yes' : 'no'
                  }
                  onChange={(v) =>
                    setGonadalLeft({ refluxPresent: v === 'yes' ? true : v === 'no' ? false : undefined })
                  }
                  data-testid="iliac-gonadal-left-reflux"
                />
              </Grid.Col>
            </Grid>
          </IliacZoneCard>
        </div>

        {/* Diagram — static illustration, free-draw + text (no coloring) */}
        <div className={classes.diagramRail}>
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
        </div>
      </div>

      {/* Classification — SVP + CEAP, both optional (never gate save/export). One
          standard deck; the "optional" note is its subtitle, not a loose line. */}
      <IliacZoneCard
        title={t('iliacPelvicVenous.zone.classification.title', 'SVP / CEAP')}
        subtitle={t('iliacPelvicVenous.classification.optional', 'SVP and CEAP are optional.')}
        testId="iliac-zone-classification"
      >
        <Stack gap="sm">
          <SVPPicker value={state.svp} onChange={handleSvp} />
          <CEAPPicker value={state.ceap} onChange={handleCeap} />
        </Stack>
      </IliacZoneCard>

      {/* Conclusion + ONE free-text comments box */}
      <IliacZoneCard
        title={t('iliacPelvicVenous.zone.impression.title', 'Conclusion')}
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
            label={t('iliacPelvicVenous.narrative.comments', 'Comments')}
            value={state.clinicianComments}
            onChange={(v) => dispatch({ type: 'SET_CLINICIAN', comments: v })}
            autosize
            minRows={3}
            data-testid="iliac-comments"
          />
        </Stack>
      </IliacZoneCard>

      <FormActions
        form={formState}
        onSaveDraft={() => {
          if (encounter) {
            lastPersistedRef.current = state;
            setStudyState<IliacPelvicVenousFormStateV2>('iliacPelvicVenous', state);
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
          'This will replace current findings and conclusion.',
        )}
        confirmLabel={t('iliacPelvicVenous.actions.applyTemplate', 'Apply template')}
        cancelLabel={t('iliacPelvicVenous.actions.cancel', 'Cancel')}
        onConfirm={handleApplyTemplate}
      />

      <ConfirmDialog
        opened={allNormalConfirmOpen}
        onClose={() => setAllNormalConfirmOpen(false)}
        title={t('iliacPelvicVenous.actions.allNormalConfirmTitle', 'Set every vein to normal?')}
        message={t(
          'iliacPelvicVenous.actions.allNormalConfirmBody',
          'Some veins already have an abnormal value. This sets every vein to patent, full filling and competent. Phasicity, velocity and diameter stay as entered.',
        )}
        confirmLabel={t('iliacPelvicVenous.actions.allNormalConfirm', 'Set all normal')}
        cancelLabel={t('iliacPelvicVenous.actions.cancel', 'Cancel')}
        onConfirm={handleConfirmAllNormal}
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
