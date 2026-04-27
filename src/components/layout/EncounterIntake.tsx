// SPDX-License-Identifier: Apache-2.0
/**
 * EncounterIntake — landing-page intake form (Phase 2.b of the
 * encounter-pivot plan).
 *
 * Replaces the role of `<StudyPicker>` for the "fresh encounter" flow:
 * the clinician fills patient identity + visit context + indication
 * ONCE, picks the studies to perform, and clicks Start. We mint a UUID,
 * persist an `EncounterDraft` to the encounter store, and navigate to
 * the first selected study under `/encounter/{uuid}/{studyType}`.
 *
 * UI contract (post-redesign):
 *   - Two-column layout on lg+ screens (form + sticky live summary).
 *   - Single-column stack on md and below.
 *   - Zero raw `@mantine/core` imports — all primitives go through the
 *     project's EMR* component library.
 *
 * State management:
 *   Local `useReducer` for the intake form. We deliberately do NOT use
 *   `useEncounter()` here — there's no encounter yet until the user
 *   clicks Start; the encounter only exists in the store afterwards.
 *
 *   Auto-save: we mirror the form into localStorage under
 *   `encounter-intake-draft` so a clinician who fills 3 fields then
 *   refreshes doesn't lose their work. On Start, the intake draft is
 *   cleared and the real encounter is persisted via `saveEncounter`.
 */

import { memo, useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  IconUser,
  IconClipboardText,
  IconStethoscope,
  IconChecklist,
  IconCheck,
  IconArrowRight,
  IconCalendarEvent,
  IconActivity,
  IconHistory,
  IconUserPlus,
} from '@tabler/icons-react';
import {
  EMRTextInput,
  EMRTextarea,
  EMRSelect,
  EMRCheckbox,
  EMRDatePicker,
  EMRMultiSelect,
} from '../shared/EMRFormFields';
import { EMRButton } from '../common/EMRButton';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { useTranslation } from '../../contexts/TranslationContext';
import { localDateToIso, isoToLocalDate, nowIsoTimestamp } from '../../services/dateHelpers';
import { VASCULAR_ICD10_CODES, icd10Display } from '../../constants/vascular-icd10';
import { STUDY_PLUGINS } from '../studies';
import {
  saveEncounter,
  listEncounters,
  loadEncounter,
  loadEncounterSync,
} from '../../services/encounterStore';
import type { EncounterDraft, EncounterHeader } from '../../types/encounter';
import type { StudyType } from '../../types/study';
import type { IndicationCode } from '../../types/form';
import { OngoingVisitsPanel } from './OngoingVisitsPanel';
import classes from './EncounterIntake.module.css';

/** localStorage key for the persisted intake draft. */
const INTAKE_DRAFT_KEY = 'encounter-intake-draft';

/** Mutable form state shape. Mirrors `EncounterHeader` plus selectedStudyTypes. */
interface IntakeFormState {
  patientName: string;
  patientId: string;
  patientBirthDate: string | undefined;
  patientGender: EncounterHeader['patientGender'];
  operatorName: string;
  referringPhysician: string;
  institution: string;
  encounterDate: string;
  medications: string;
  informedConsent: boolean;
  informedConsentSignedAt: string | undefined;
  icd10Codes: IndicationCode[];
  indicationNotes: string;
  selectedStudyTypes: StudyType[];
}

type IntakeAction =
  | { type: 'SET_FIELD'; field: keyof IntakeFormState; value: unknown }
  | { type: 'TOGGLE_STUDY'; studyType: StudyType }
  | { type: 'SET_CONSENT'; checked: boolean }
  | { type: 'HYDRATE'; state: IntakeFormState }
  | { type: 'RESET' };

function defaultState(): IntakeFormState {
  return {
    patientName: '',
    patientId: '',
    patientBirthDate: undefined,
    patientGender: undefined,
    operatorName: '',
    referringPhysician: '',
    institution: '',
    encounterDate: localDateToIso(new Date()) ?? '',
    medications: '',
    informedConsent: false,
    informedConsentSignedAt: undefined,
    icd10Codes: [],
    indicationNotes: '',
    selectedStudyTypes: [],
  };
}

function reducer(state: IntakeFormState, action: IntakeAction): IntakeFormState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value } as IntakeFormState;
    case 'TOGGLE_STUDY': {
      const has = state.selectedStudyTypes.includes(action.studyType);
      return {
        ...state,
        selectedStudyTypes: has
          ? state.selectedStudyTypes.filter((s) => s !== action.studyType)
          : [...state.selectedStudyTypes, action.studyType],
      };
    }
    case 'SET_CONSENT':
      return {
        ...state,
        informedConsent: action.checked,
        informedConsentSignedAt: action.checked
          ? state.informedConsentSignedAt ?? nowIsoTimestamp()
          : undefined,
      };
    case 'HYDRATE':
      return action.state;
    case 'RESET':
      return defaultState();
    default:
      return state;
  }
}

function loadIntakeDraft(): IntakeFormState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(INTAKE_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<IntakeFormState>;
    return { ...defaultState(), ...parsed };
  } catch {
    return null;
  }
}

function persistIntakeDraft(state: IntakeFormState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(INTAKE_DRAFT_KEY, JSON.stringify(state));
  } catch {
    // ignore — best-effort cache
  }
}

function clearIntakeDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(INTAKE_DRAFT_KEY);
  } catch {
    // ignore
  }
}

/**
 * Map a stored EncounterDraft back into the intake-form's mutable shape so
 * the form pre-fills when the user navigates back via `?edit=<id>`. The
 * inverse of `buildEncounterDraftFromIntake` for header fields, plus the
 * `selectedStudyTypes` carry-over.
 */
function encounterToIntakeState(draft: EncounterDraft): IntakeFormState {
  const h = draft.header;
  return {
    patientName: h.patientName ?? '',
    patientId: h.patientId ?? '',
    patientBirthDate: h.patientBirthDate,
    patientGender: h.patientGender,
    operatorName: h.operatorName ?? '',
    referringPhysician: h.referringPhysician ?? '',
    institution: h.institution ?? '',
    encounterDate: h.encounterDate || (localDateToIso(new Date()) ?? ''),
    medications: h.medications ?? '',
    informedConsent: h.informedConsent ?? false,
    informedConsentSignedAt: h.informedConsentSignedAt,
    icd10Codes: [...(h.icd10Codes ?? [])],
    indicationNotes: h.indicationNotes ?? '',
    selectedStudyTypes: [...draft.selectedStudyTypes],
  };
}

function buildEncounterDraftFromIntake(state: IntakeFormState): EncounterDraft {
  const now = new Date().toISOString();
  const header: EncounterHeader = {
    patientName: state.patientName.trim(),
    patientId: state.patientId.trim() || undefined,
    patientBirthDate: state.patientBirthDate,
    patientGender: state.patientGender,
    operatorName: state.operatorName.trim() || undefined,
    referringPhysician: state.referringPhysician.trim() || undefined,
    institution: state.institution.trim() || undefined,
    medications: state.medications.trim() || undefined,
    informedConsent: state.informedConsent || undefined,
    informedConsentSignedAt: state.informedConsent ? state.informedConsentSignedAt : undefined,
    icd10Codes: state.icd10Codes.length > 0 ? state.icd10Codes : undefined,
    indicationNotes: state.indicationNotes.trim() || undefined,
    encounterDate: state.encounterDate || (localDateToIso(new Date()) ?? ''),
  };
  return {
    schemaVersion: 2,
    encounterId: crypto.randomUUID(),
    header,
    selectedStudyTypes: [...state.selectedStudyTypes],
    studies: {},
    createdAt: now,
    updatedAt: now,
  };
}

/** Compute the patient's age (years) from an ISO birth date. */
function ageFromIsoBirthDate(iso: string | undefined): number | undefined {
  if (!iso) return undefined;
  const birth = new Date(iso);
  if (Number.isNaN(birth.getTime())) return undefined;
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) years--;
  return years >= 0 ? years : undefined;
}

/** Build patient initials (max 2 chars) for the avatar pill. */
function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return (parts[0]?.[0] ?? '').toUpperCase();
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}

export const EncounterIntake = memo(function EncounterIntake(): React.ReactElement {
  const { t, lang } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // `?edit=<encounterId>` puts the form into edit mode: pre-fill from the
  // stored encounter, and on Continue update the existing encounter
  // (preserving its `studies` map + `encounterId`) instead of minting a
  // new one. The reducer's lazy initialiser reads it once at mount; the
  // useEffect below keeps editingEncounterId state in sync if the URL
  // changes after mount (e.g. via "+ New patient").
  const editIdFromUrl = searchParams.get('edit');

  const [state, dispatch] = useReducer(reducer, undefined, () => {
    if (editIdFromUrl) {
      const enc = loadEncounterSync(editIdFromUrl);
      if (enc) return encounterToIntakeState(enc);
    }
    return loadIntakeDraft() ?? defaultState();
  });
  const [editingEncounterId, setEditingEncounterId] = useState<string | null>(
    editIdFromUrl,
  );
  const [submitting, setSubmitting] = useState(false);
  const [hasResumable, setHasResumable] = useState(false);

  // When `?edit=<id>` changes (or appears after mount) we (a) flip the
  // mode flag and (b) async-refresh from IDB, the source of truth for
  // the encounter store. Cancelled-flag pattern guards against a slow
  // IDB resolve clobbering state after the user already navigated off
  // the edit URL (e.g. clicked "+ New patient").
  useEffect(() => {
    if (!editIdFromUrl) {
      setEditingEncounterId(null);
      return;
    }
    setEditingEncounterId(editIdFromUrl);
    let cancelled = false;
    loadEncounter(editIdFromUrl)
      .then((enc) => {
        if (cancelled || !enc) return;
        dispatch({ type: 'HYDRATE', state: encounterToIntakeState(enc) });
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('[EncounterIntake] loadEncounter failed', editIdFromUrl, err);
      });
    return () => {
      cancelled = true;
    };
  }, [editIdFromUrl]);

  // Persist intake draft on every change — but ONLY in create mode.
  // In edit mode the encounter store IS the source of truth; persisting
  // intake-draft here would leak field edits between encounters when the
  // user later clicks "+ New patient".
  useEffect(() => {
    if (editingEncounterId) return;
    persistIntakeDraft(state);
  }, [state, editingEncounterId]);

  useEffect(() => {
    let cancelled = false;
    listEncounters()
      .then((list) => {
        if (cancelled) return;
        setHasResumable(list.length > 0);
      })
      .catch(() => {
        if (cancelled) return;
        setHasResumable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ----- Field handlers -----
  const setField = useCallback(<K extends keyof IntakeFormState>(field: K, value: IntakeFormState[K]) => {
    dispatch({ type: 'SET_FIELD', field, value });
  }, []);

  const handleConsentToggle = useCallback((checked: boolean) => {
    dispatch({ type: 'SET_CONSENT', checked });
  }, []);

  const toggleStudy = useCallback((studyType: StudyType) => {
    dispatch({ type: 'TOGGLE_STUDY', studyType });
  }, []);

  // ----- Derived data -----
  const genderOptions = useMemo(
    () => [
      { value: 'male', label: t('encounter.intake.identity.genderMale') },
      { value: 'female', label: t('encounter.intake.identity.genderFemale') },
      { value: 'other', label: t('encounter.intake.identity.genderOther') },
      { value: 'unknown', label: t('encounter.intake.identity.genderUnknown') },
    ],
    [t],
  );

  const icd10Options = useMemo(
    () =>
      VASCULAR_ICD10_CODES.map((entry) => ({
        value: entry.code,
        label: `${entry.code} — ${icd10Display(entry, lang)}`,
      })),
    [lang],
  );

  const selectedIcd10CodeStrings = useMemo(
    () => state.icd10Codes.map((c) => c.code),
    [state.icd10Codes],
  );

  const handleIcd10Change = useCallback(
    (codes: string[]) => {
      const mapped: IndicationCode[] = codes.map((code) => {
        const entry = VASCULAR_ICD10_CODES.find((e) => e.code === code);
        return {
          code,
          display: entry ? icd10Display(entry, lang) : code,
        };
      });
      setField('icd10Codes', mapped);
    },
    [lang, setField],
  );

  const availableStudies = useMemo(
    () => STUDY_PLUGINS.filter((p) => p.available && p.FormComponent),
    [],
  );

  // ----- Step / progress derivation (drives the hero progress pills) -----
  const trimmedName = state.patientName.trim();
  const stepCompletion = useMemo(() => {
    return {
      identity: trimmedName.length > 0,
      visit: !!state.encounterDate,
      indication: state.icd10Codes.length > 0 || state.indicationNotes.trim().length > 0,
      studies: state.selectedStudyTypes.length > 0,
    };
  }, [trimmedName, state.encounterDate, state.icd10Codes, state.indicationNotes, state.selectedStudyTypes]);

  const completedStepCount = Object.values(stepCompletion).filter(Boolean).length;

  // ----- Validation / submit -----
  const canStart = trimmedName.length > 0 && state.selectedStudyTypes.length > 0;
  const startHint = !trimmedName
    ? t('encounter.intake.actions.startDisabledNoName')
    : state.selectedStudyTypes.length === 0
    ? t('encounter.intake.actions.startDisabledNoStudies')
    : '';

  // Show the "+ New patient" button only when there's something to clear:
  //   - we're editing an existing encounter (always offer the escape hatch), OR
  //   - the user has already typed a patient name into a fresh form.
  const canResetIntake =
    Boolean(editingEncounterId) || trimmedName.length > 0;
  const isEditMode = Boolean(editingEncounterId);

  const handleStart = useCallback(async () => {
    if (!canStart || submitting) return;
    setSubmitting(true);
    try {
      // EDIT MODE: update existing encounter, preserving encounterId,
      // createdAt, and the per-study `studies` map (the clinician may
      // have already filled findings on one of the studies).
      if (editingEncounterId) {
        const existing = await loadEncounter(editingEncounterId);
        const built = buildEncounterDraftFromIntake(state);
        const now = new Date().toISOString();
        const merged: EncounterDraft = {
          schemaVersion: 2,
          encounterId: editingEncounterId,
          header: built.header,
          selectedStudyTypes: [...state.selectedStudyTypes],
          studies: existing?.studies ?? {},
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        await saveEncounter(merged);
        const firstStudy = merged.selectedStudyTypes[0];
        // Don't clearIntakeDraft() in edit mode — the localStorage draft
        // is for brand-new encounters only; we never wrote into it here.
        navigate(`/encounter/${merged.encounterId}/${firstStudy}`);
        return;
      }

      // CREATE MODE: mint a fresh UUID, save, navigate.
      const draft = buildEncounterDraftFromIntake(state);
      await saveEncounter(draft);
      const firstStudy = draft.selectedStudyTypes[0];
      clearIntakeDraft();
      navigate(`/encounter/${draft.encounterId}/${firstStudy}`);
    } catch (err) {
      console.warn('[EncounterIntake] saveEncounter failed', err);
      setSubmitting(false);
    }
  }, [canStart, state, submitting, editingEncounterId, navigate]);

  /**
   * "+ New patient" — discards the current intake (whether edit-mode or
   * a partially-filled create-mode draft), drops the `?edit` query
   * param, and resets the form to defaults. Doesn't delete the
   * underlying encounter from the store; the user can still get back
   * to it via the Resume list.
   */
  const handleNewPatient = useCallback(() => {
    dispatch({ type: 'RESET' });
    clearIntakeDraft();
    setEditingEncounterId(null);
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const handleResume = useCallback(() => {
    navigate('/');
  }, [navigate]);

  // ----- Live summary derivations -----
  const initials = initialsFromName(trimmedName);
  const age = ageFromIsoBirthDate(state.patientBirthDate);
  const genderLabel = state.patientGender
    ? genderOptions.find((g) => g.value === state.patientGender)?.label
    : undefined;
  const formattedEncounterDate = useMemo(() => {
    if (!state.encounterDate) return '';
    const d = new Date(state.encounterDate);
    if (Number.isNaN(d.getTime())) return state.encounterDate;
    return d.toLocaleDateString(lang === 'ka' ? 'ka-GE' : lang === 'ru' ? 'ru-RU' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, [state.encounterDate, lang]);

  const selectedStudyLabels = useMemo(() => {
    return state.selectedStudyTypes.map((studyType) => {
      const plugin =
        availableStudies.find((p) =>
          p.key === 'venousLE' ? studyType === 'venousLEBilateral' : (p.key as StudyType) === studyType,
        ) ?? availableStudies[0];
      return {
        studyType,
        label: plugin ? t(`${plugin.translationKey}.title`) : studyType,
        Icon: plugin?.icon,
      };
    });
  }, [state.selectedStudyTypes, availableStudies, t]);

  const progressSteps: Array<{ key: keyof typeof stepCompletion; label: string }> = [
    { key: 'identity', label: t('encounter.intake.identity.title') },
    { key: 'visit', label: t('encounter.intake.visit.title') },
    { key: 'indication', label: t('encounter.intake.indication.title') },
    { key: 'studies', label: t('encounter.intake.studies.title') },
  ];

  // ----- Render -----
  return (
    <div className={classes.backdrop}>
      {/* ============== HERO BANNER ============== */}
      <div className={classes.hero}>
        <div className={classes.heroOrb} aria-hidden />
        <div className={classes.heroOrbAlt} aria-hidden />

        {/* Floating controls — language + theme toggles. Already styled
            for gradient backgrounds (white pill on translucent track). */}
        <div className={classes.heroControls}>
          <LanguageSwitcher />
          <ThemeToggle />
        </div>

        <div className={classes.heroInner}>
          <div className={classes.heroText}>
            <span className={classes.heroEyebrow}>
              <span className={classes.heroEyebrowDot} aria-hidden />
              {t('app.subtitle')}
            </span>
            <h1 className={classes.heroTitle}>{t('encounter.intake.title')}</h1>
            <p className={classes.heroSubtitle}>{t('encounter.intake.subtitle')}</p>
          </div>

          <div
            className={classes.heroProgress}
            role="group"
            aria-label={t('encounter.intake.title')}
          >
            <div className={classes.heroProgressMeta}>
              <span className={classes.heroProgressCount}>
                {completedStepCount}/{progressSteps.length}
              </span>
              <span className={classes.heroProgressLabel}>
                {t('encounter.intake.summary.progressLabel', 'Completed')}
              </span>
            </div>
            <div className={classes.heroProgressTrack}>
              {progressSteps.map((step, idx) => {
                const done = stepCompletion[step.key];
                return (
                  <div
                    key={step.key}
                    className={[
                      classes.heroProgressDot,
                      done ? classes.heroProgressDotDone : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    title={step.label}
                  >
                    <span className={classes.heroProgressDotIndex}>{idx + 1}</span>
                    {done && (
                      <span className={classes.heroProgressDotCheck} aria-hidden>
                        <IconCheck size={12} stroke={3} />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className={classes.container}>
        {/* ============== ONGOING VISITS (auto-hides when empty) ============== */}
        <OngoingVisitsPanel
          onChange={() => {
            // Re-probe `hasResumable` so the sticky-footer Resume link
            // disappears when the user clears all visits from the panel.
            void listEncounters()
              .then((list) => setHasResumable(list.length > 0))
              .catch(() => setHasResumable(false));
          }}
        />

        <div className={classes.layout}>
          {/* ============== FORM COLUMN ============== */}
          <div className={classes.formColumn}>
            {/* Card 1: Identity */}
            <section className={classes.card} aria-labelledby="intake-identity-title">
              <header className={classes.cardHeader}>
                <span className={classes.cardHeaderIcon} aria-hidden>
                  <IconUser size={18} stroke={1.75} />
                </span>
                <div className={classes.cardHeaderText}>
                  <span className={classes.cardHeaderEyebrow}>
                    {t('encounter.intake.stepLabel', 'Step')} 1
                  </span>
                  <h2 className={classes.cardHeaderTitle} id="intake-identity-title">
                    {t('encounter.intake.identity.title')}
                  </h2>
                </div>
                {stepCompletion.identity && (
                  <span className={classes.cardHeaderBadge} aria-hidden>
                    <IconCheck size={14} stroke={3} />
                  </span>
                )}
              </header>
              <div className={classes.cardBody}>
                <div className={classes.fieldGrid}>
                  <div className={classes.field}>
                    <EMRTextInput
                      label={t('encounter.intake.identity.patientName')}
                      value={state.patientName}
                      onChange={(v) => setField('patientName', v)}
                      required
                      autoFocus
                      size="md"
                      data-testid="intake-patientName"
                    />
                  </div>
                  <div className={classes.field}>
                    <EMRTextInput
                      label={t('encounter.intake.identity.patientId')}
                      helpText={t('encounter.intake.identity.patientIdHelp')}
                      value={state.patientId}
                      onChange={(v) => setField('patientId', v)}
                      size="md"
                      data-testid="intake-patientId"
                    />
                  </div>
                  <div className={classes.field}>
                    <EMRDatePicker
                      label={t('encounter.intake.identity.patientBirthDate')}
                      value={isoToLocalDate(state.patientBirthDate)}
                      onChange={(d) => setField('patientBirthDate', localDateToIso(d))}
                      size="md"
                      data-testid="intake-birthDate"
                    />
                  </div>
                  <div className={classes.field}>
                    <EMRSelect
                      label={t('encounter.intake.identity.patientGender')}
                      value={state.patientGender ?? null}
                      onChange={(v) =>
                        setField('patientGender', (v as EncounterHeader['patientGender']) ?? undefined)
                      }
                      data={genderOptions}
                      size="md"
                      data-testid="intake-gender"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Card 2: Visit context */}
            <section className={classes.card} aria-labelledby="intake-visit-title">
              <header className={classes.cardHeader}>
                <span className={classes.cardHeaderIcon} aria-hidden>
                  <IconClipboardText size={18} stroke={1.75} />
                </span>
                <div className={classes.cardHeaderText}>
                  <span className={classes.cardHeaderEyebrow}>
                    {t('encounter.intake.stepLabel', 'Step')} 2
                  </span>
                  <h2 className={classes.cardHeaderTitle} id="intake-visit-title">
                    {t('encounter.intake.visit.title')}
                  </h2>
                </div>
                {stepCompletion.visit && (
                  <span className={classes.cardHeaderBadge} aria-hidden>
                    <IconCheck size={14} stroke={3} />
                  </span>
                )}
              </header>
              <div className={classes.cardBody}>
                <div className={classes.fieldGrid}>
                  <div className={classes.field}>
                    <EMRTextInput
                      label={t('encounter.intake.visit.operatorName')}
                      value={state.operatorName}
                      onChange={(v) => setField('operatorName', v)}
                      size="md"
                      data-testid="intake-operator"
                    />
                  </div>
                  <div className={classes.field}>
                    <EMRTextInput
                      label={t('encounter.intake.visit.referringPhysician')}
                      value={state.referringPhysician}
                      onChange={(v) => setField('referringPhysician', v)}
                      size="md"
                      data-testid="intake-referring"
                    />
                  </div>
                  <div className={classes.field}>
                    <EMRTextInput
                      label={t('encounter.intake.visit.institution')}
                      value={state.institution}
                      onChange={(v) => setField('institution', v)}
                      size="md"
                      data-testid="intake-institution"
                    />
                  </div>
                  <div className={classes.field}>
                    <EMRDatePicker
                      label={t('encounter.intake.visit.encounterDate')}
                      value={isoToLocalDate(state.encounterDate)}
                      onChange={(d) => setField('encounterDate', localDateToIso(d) ?? '')}
                      size="md"
                      data-testid="intake-encounterDate"
                    />
                  </div>
                  <div className={`${classes.field} ${classes.fieldFull}`}>
                    <EMRTextarea
                      label={t('encounter.intake.visit.medications')}
                      placeholder={t('encounter.intake.visit.medicationsPlaceholder')}
                      value={state.medications}
                      onChange={(v) => setField('medications', v)}
                      minRows={2}
                      maxRows={4}
                      autosize
                      size="md"
                      data-testid="intake-medications"
                    />
                  </div>
                  <div className={`${classes.field} ${classes.fieldFull}`}>
                    <div className={classes.consentRow}>
                      <EMRCheckbox
                        label={t('encounter.intake.visit.informedConsent')}
                        checked={state.informedConsent}
                        onChange={handleConsentToggle}
                        size="md"
                        data-testid="intake-informedConsent"
                      />
                      <div className={classes.consentDate}>
                        <EMRDatePicker
                          label={t('encounter.intake.visit.informedConsentSignedAt')}
                          value={isoToLocalDate(state.informedConsentSignedAt)}
                          onChange={(d) =>
                            setField('informedConsentSignedAt', localDateToIso(d))
                          }
                          size="md"
                          disabled={!state.informedConsent}
                          data-testid="intake-consentSignedAt"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Card 3: Indication */}
            <section className={classes.card} aria-labelledby="intake-indication-title">
              <header className={classes.cardHeader}>
                <span className={classes.cardHeaderIcon} aria-hidden>
                  <IconStethoscope size={18} stroke={1.75} />
                </span>
                <div className={classes.cardHeaderText}>
                  <span className={classes.cardHeaderEyebrow}>
                    {t('encounter.intake.stepLabel', 'Step')} 3
                  </span>
                  <h2 className={classes.cardHeaderTitle} id="intake-indication-title">
                    {t('encounter.intake.indication.title')}
                  </h2>
                </div>
                {stepCompletion.indication && (
                  <span className={classes.cardHeaderBadge} aria-hidden>
                    <IconCheck size={14} stroke={3} />
                  </span>
                )}
              </header>
              <div className={classes.cardBody}>
                <div className={classes.fieldGrid}>
                  <div className={`${classes.field} ${classes.fieldFull}`}>
                    <EMRMultiSelect
                      label={t('encounter.intake.indication.icd10Label')}
                      placeholder={t('encounter.intake.indication.icd10Placeholder')}
                      data={icd10Options}
                      value={selectedIcd10CodeStrings}
                      onChange={handleIcd10Change}
                      searchable
                      hidePickedOptions
                      maxDropdownHeight={280}
                      size="md"
                      data-testid="intake-icd10"
                    />
                  </div>
                  <div className={`${classes.field} ${classes.fieldFull}`}>
                    <EMRTextarea
                      label={t('encounter.intake.indication.indicationNotes')}
                      placeholder={t('encounter.intake.indication.indicationNotesPlaceholder')}
                      value={state.indicationNotes}
                      onChange={(v) => setField('indicationNotes', v)}
                      minRows={2}
                      maxRows={4}
                      autosize
                      size="md"
                      data-testid="intake-indicationNotes"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Card 4: Studies */}
            <section className={classes.card} aria-labelledby="intake-studies-title">
              <header className={classes.cardHeader}>
                <span className={classes.cardHeaderIcon} aria-hidden>
                  <IconChecklist size={18} stroke={1.75} />
                </span>
                <div className={classes.cardHeaderText}>
                  <span className={classes.cardHeaderEyebrow}>
                    {t('encounter.intake.stepLabel', 'Step')} 4
                  </span>
                  <h2 className={classes.cardHeaderTitle} id="intake-studies-title">
                    {t('encounter.intake.studies.title')}
                  </h2>
                </div>
                {stepCompletion.studies && (
                  <span className={classes.cardHeaderBadge} aria-hidden>
                    <IconCheck size={14} stroke={3} />
                  </span>
                )}
              </header>
              <div className={classes.cardBody}>
                <p className={classes.studyHelper}>{t('encounter.intake.studies.subtitle')}</p>
                <div
                  className={classes.studyGrid}
                  role="group"
                  aria-labelledby="intake-studies-title"
                >
                  {availableStudies.map((plugin) => {
                    const Icon = plugin.icon;
                    const studyType: StudyType =
                      plugin.key === 'venousLE'
                        ? 'venousLEBilateral'
                        : (plugin.key as StudyType);
                    const checked = state.selectedStudyTypes.includes(studyType);
                    const cardClasses = [
                      classes.studyCard,
                      checked ? classes.studyCardSelected : '',
                    ]
                      .filter(Boolean)
                      .join(' ');
                    return (
                      <button
                        key={plugin.key}
                        type="button"
                        className={cardClasses}
                        onClick={() => toggleStudy(studyType)}
                        aria-pressed={checked}
                        data-testid={`intake-study-${plugin.key}`}
                      >
                        <span className={classes.studyCardIcon} aria-hidden>
                          <Icon size={22} stroke={1.75} />
                        </span>
                        <span className={classes.studyCardBody}>
                          <span className={classes.studyCardLabel}>
                            {t(`${plugin.translationKey}.title`)}
                          </span>
                          <span className={classes.studyCardHint}>
                            {checked
                              ? t('encounter.intake.studies.selected', 'Selected')
                              : t('encounter.intake.studies.tapToAdd', 'Tap to include')}
                          </span>
                        </span>
                        <span
                          className={classes.studyCardCheck}
                          aria-hidden
                          data-checked={checked}
                        >
                          <IconCheck size={14} stroke={3} />
                        </span>
                      </button>
                    );
                  })}
                </div>
                {state.selectedStudyTypes.length === 0 && (
                  <p className={classes.studyHelperWarn}>
                    {t('encounter.intake.studies.selectAtLeastOne')}
                  </p>
                )}
              </div>
            </section>
          </div>

          {/* ============== LIVE SUMMARY COLUMN ============== */}
          <aside className={classes.summaryColumn} aria-label={t('encounter.intake.title')}>
            <div className={classes.summaryCard}>
              <header className={classes.summaryHeader}>
                <span className={classes.summaryHeaderEyebrow}>
                  {t('encounter.intake.summary.eyebrow', 'Live preview')}
                </span>
                <h3 className={classes.summaryHeaderTitle}>
                  {t('encounter.intake.summary.title', 'Encounter summary')}
                </h3>
              </header>

              <div className={classes.summaryBody}>
                {/* Patient identity block */}
                <div className={classes.summaryPatient}>
                  <span
                    className={[
                      classes.summaryAvatar,
                      initials ? '' : classes.summaryAvatarEmpty,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-hidden
                  >
                    {initials || <IconUser size={20} stroke={1.75} />}
                  </span>
                  <div className={classes.summaryPatientText}>
                    <span className={classes.summaryPatientName}>
                      {trimmedName ||
                        t('encounter.intake.summary.placeholderName', 'New patient')}
                    </span>
                    <span className={classes.summaryPatientMeta}>
                      {[
                        genderLabel,
                        age != null
                          ? t('encounter.intake.summary.ageYears', '{age} y/o').replace(
                              '{age}',
                              String(age),
                            )
                          : null,
                        state.patientId ? `ID: ${state.patientId}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') ||
                        t('encounter.intake.summary.metaPlaceholder', 'Identity pending')}
                    </span>
                  </div>
                </div>

                {/* Encounter date row */}
                <div className={classes.summaryRow}>
                  <span className={classes.summaryRowIcon} aria-hidden>
                    <IconCalendarEvent size={16} stroke={1.75} />
                  </span>
                  <span className={classes.summaryRowLabel}>
                    {t('encounter.intake.visit.encounterDate')}
                  </span>
                  <span className={classes.summaryRowValue}>
                    {formattedEncounterDate || '—'}
                  </span>
                </div>

                {/* Operator */}
                {state.operatorName.trim() && (
                  <div className={classes.summaryRow}>
                    <span className={classes.summaryRowIcon} aria-hidden>
                      <IconUser size={16} stroke={1.75} />
                    </span>
                    <span className={classes.summaryRowLabel}>
                      {t('encounter.intake.visit.operatorName')}
                    </span>
                    <span className={classes.summaryRowValue}>{state.operatorName}</span>
                  </div>
                )}

                {/* ICD-10 chips */}
                <div className={classes.summarySection}>
                  <span className={classes.summarySectionLabel}>
                    {t('encounter.intake.indication.icd10Label')}
                  </span>
                  {state.icd10Codes.length === 0 ? (
                    <span className={classes.summaryEmpty}>
                      {t('encounter.intake.summary.icdEmpty', 'No ICD-10 codes yet')}
                    </span>
                  ) : (
                    <div className={classes.summaryChipRow}>
                      {state.icd10Codes.slice(0, 6).map((c) => (
                        <span key={c.code} className={classes.summaryChip} title={c.display}>
                          {c.code}
                        </span>
                      ))}
                      {state.icd10Codes.length > 6 && (
                        <span className={classes.summaryChipMore}>
                          +{state.icd10Codes.length - 6}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Selected studies */}
                <div className={classes.summarySection}>
                  <span className={classes.summarySectionLabel}>
                    {t('encounter.intake.studies.title')}
                  </span>
                  {selectedStudyLabels.length === 0 ? (
                    <span className={classes.summaryEmpty}>
                      {t('encounter.intake.summary.studiesEmpty', 'Select at least one study')}
                    </span>
                  ) : (
                    <ul className={classes.summaryStudyList}>
                      {selectedStudyLabels.map(({ studyType, label, Icon }) => (
                        <li key={studyType} className={classes.summaryStudyItem}>
                          <span className={classes.summaryStudyIcon} aria-hidden>
                            {Icon ? (
                              <Icon size={14} stroke={1.75} />
                            ) : (
                              <IconActivity size={14} stroke={1.75} />
                            )}
                          </span>
                          <span className={classes.summaryStudyLabel}>{label}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Status pill */}
                <div
                  className={[
                    classes.summaryStatus,
                    canStart ? classes.summaryStatusReady : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span className={classes.summaryStatusDot} aria-hidden />
                  <span className={classes.summaryStatusText}>
                    {canStart
                      ? t('encounter.intake.summary.ready', 'Ready to start encounter')
                      : startHint ||
                        t('encounter.intake.summary.notReady', 'Complete required fields to start')}
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* ============== STICKY FOOTER ============== */}
      <div className={classes.actionRow} role="group" aria-label={t('common.actionsRegion')}>
        <div className={classes.actionRowInner}>
          {hasResumable ? (
            <button
              type="button"
              className={classes.actionRowResume}
              onClick={handleResume}
              data-testid="intake-resume-link"
            >
              <IconHistory size={16} stroke={1.75} />
              <span>{t('encounter.intake.actions.resume')}</span>
            </button>
          ) : (
            <span aria-hidden />
          )}

          <div className={classes.actionRowRight}>
            {!canStart && startHint && (
              <span className={classes.actionRowHint} data-testid="intake-start-hint">
                {startHint}
              </span>
            )}
            {canResetIntake && (
              <EMRButton
                variant="secondary"
                size="md"
                onClick={handleNewPatient}
                data-testid="intake-new-patient"
                icon={IconUserPlus}
              >
                {t('encounter.intake.actions.newPatient', '+ New patient')}
              </EMRButton>
            )}
            <EMRButton
              variant="primary"
              size="md"
              disabled={!canStart || submitting}
              loading={submitting}
              onClick={() => void handleStart()}
              className={classes.actionRowButton}
              data-testid="intake-start"
              icon={IconArrowRight}
              iconPosition="right"
            >
              {isEditMode
                ? t('encounter.intake.actions.continue', 'Continue encounter')
                : t('encounter.intake.actions.start')}
            </EMRButton>
          </div>
        </div>
      </div>
    </div>
  );
});

export default EncounterIntake;
