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
 * Why this exists:
 *   Today every per-study form re-renders the same `<StudyHeader>` card
 *   asking for patient name, DOB, operator, ICD-10, etc. A clinician
 *   running 2-3 studies in one visit re-types every demographic. The
 *   plan field-split table moves all encounter-level fields here; per-
 *   study reducers shrink to study-clinical fields only (Phase 3b).
 *
 * Phase 2.b scope:
 *   - This component renders; routing is wired by Phase 3a.
 *   - On Start we navigate to `/encounter/{id}/{firstStudy}`. That route
 *     is registered by Phase 3a's `EncounterStudyWrapper`. In isolation
 *     testing (before 3a lands) the navigation 404s — that's expected.
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
import { Box, Grid, MultiSelect } from '@mantine/core';
import {
  IconUser,
  IconClipboardText,
  IconStethoscope,
  IconChecklist,
  IconUserPlus,
} from '@tabler/icons-react';
import {
  EMRTextInput,
  EMRTextarea,
  EMRSelect,
  EMRCheckbox,
  EMRDatePicker,
} from '../shared/EMRFormFields';
import { EMRButton } from '../common/EMRButton';
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
import classes from './EncounterIntake.module.css';

/** localStorage key for the persisted intake draft. */
const INTAKE_DRAFT_KEY = 'encounter-intake-draft';

/** Mutable form state shape. Mirrors `EncounterHeader` plus selectedStudyTypes. */
interface IntakeFormState {
  // Identity
  patientName: string;
  patientId: string;
  patientBirthDate: string | undefined;
  patientGender: EncounterHeader['patientGender'];
  // Visit context
  operatorName: string;
  referringPhysician: string;
  institution: string;
  encounterDate: string;
  medications: string;
  informedConsent: boolean;
  informedConsentSignedAt: string | undefined;
  // Indication
  icd10Codes: IndicationCode[];
  indicationNotes: string;
  // Studies
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
        // Stamp full ISO timestamp on first toggle to true; clear on uncheck.
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
    // Merge over defaults so missing fields fall back gracefully.
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

/**
 * Build an EncounterDraft from intake state. Trim trailing whitespace and
 * strip empty optionals so the persisted shape is clean.
 */
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
    informedConsentSignedAt: state.informedConsent
      ? state.informedConsentSignedAt
      : undefined,
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

export const EncounterIntake = memo(function EncounterIntake(): React.ReactElement {
  const { t, lang } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // `?edit=<encounterId>` puts the form into edit mode: pre-fill from the
  // stored encounter, and on Start update the existing encounter (preserving
  // its `studies` map + `encounterId`) instead of minting a new one. Read
  // once for the reducer's lazy initialiser; keep tracking via state so a
  // route change while mounted (e.g. user clicks "+ New patient") can flip
  // edit mode off without remounting.
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
  // mode flag and (b) async-refresh from IDB which is the source of truth
  // for the encounter store. The cancelled-flag pattern guards against a
  // slow IDB resolve clobbering state after the user already navigated
  // off the edit URL (e.g. clicked "+ New patient").
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
  // intake-draft would leak field edits between encounters when the
  // user clicks "+ New patient" later.
  useEffect(() => {
    if (editingEncounterId) return;
    persistIntakeDraft(state);
  }, [state, editingEncounterId]);

  // Probe the encounter store for any resumable encounters so we can show
  // the "Resume in-progress encounter" link.
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

  // Available studies (filtered by available + FormComponent presence — same
  // gate the App router uses).
  const availableStudies = useMemo(
    () => STUDY_PLUGINS.filter((p) => p.available && p.FormComponent),
    [],
  );

  // ----- Validation / submit -----
  const trimmedName = state.patientName.trim();
  const canStart = trimmedName.length > 0 && state.selectedStudyTypes.length > 0;
  const startHint = !trimmedName
    ? t('encounter.intake.actions.startDisabledNoName')
    : state.selectedStudyTypes.length === 0
    ? t('encounter.intake.actions.startDisabledNoStudies')
    : '';

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
      // Per Phase 2.b plan: a study type is required by `canStart`, so the
      // first selection is always defined.
      const firstStudy = draft.selectedStudyTypes[0];
      clearIntakeDraft();
      navigate(`/encounter/${draft.encounterId}/${firstStudy}`);
    } catch (err) {
      console.warn('[EncounterIntake] saveEncounter failed', err);
      setSubmitting(false);
    }
  }, [canStart, state, submitting, editingEncounterId, navigate]);

  /**
   * "+ New patient" — discard the current intake (whether edit-mode or a
   * partially-filled create-mode draft), drop the `?edit` query param, and
   * reset the form to defaults. Doesn't delete the underlying encounter
   * from the store; the user can still get back to it via the resume list.
   */
  const handleNewPatient = useCallback(() => {
    dispatch({ type: 'RESET' });
    clearIntakeDraft();
    setEditingEncounterId(null);
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  // Show the "+ New patient" button when:
  //   - the user is editing an existing encounter (always offer the escape
  //     hatch back to a fresh form), OR
  //   - the user has typed something into a fresh form and wants to
  //     start over without manually clearing each field.
  const canResetIntake =
    Boolean(editingEncounterId) || state.patientName.trim().length > 0;

  const handleResume = useCallback(() => {
    // For Phase 2.b we route to `/` — the StudyPicker upgrade will surface
    // the encounter list and resume controls. (Phase 3a will also flip `/`
    // to render `<EncounterIntake>` outright; for now we already ARE the
    // intake — the resume link just scrolls a clinician into the list.)
    navigate('/');
  }, [navigate]);

  // ----- Render -----
  return (
    <div className={classes.backdrop}>
      <div className={classes.container}>
        <header className={classes.pageHeader}>
          <h1 className={classes.pageTitle}>{t('encounter.intake.title')}</h1>
          <p className={classes.pageSubtitle}>{t('encounter.intake.subtitle')}</p>
        </header>

        {/* ---------------- Card 1: Identity ---------------- */}
        <section className={classes.card} aria-labelledby="intake-identity-title">
          <header className={classes.cardHeader}>
            <Box className={classes.cardHeaderIcon} aria-hidden>
              <IconUser size={18} stroke={1.75} />
            </Box>
            <h2 className={classes.cardHeaderTitle} id="intake-identity-title">
              {t('encounter.intake.identity.title')}
            </h2>
          </header>
          <div className={classes.cardBody}>
            <Grid gutter={{ base: 'sm', sm: 'md' }}>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <EMRTextInput
                  label={t('encounter.intake.identity.patientName')}
                  value={state.patientName}
                  onChange={(v) => setField('patientName', v)}
                  required
                  autoFocus
                  size="md"
                  data-testid="intake-patientName"
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <EMRTextInput
                  label={t('encounter.intake.identity.patientId')}
                  helpText={t('encounter.intake.identity.patientIdHelp')}
                  value={state.patientId}
                  onChange={(v) => setField('patientId', v)}
                  size="md"
                  data-testid="intake-patientId"
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <EMRDatePicker
                  label={t('encounter.intake.identity.patientBirthDate')}
                  value={isoToLocalDate(state.patientBirthDate)}
                  onChange={(d) => setField('patientBirthDate', localDateToIso(d))}
                  size="md"
                  data-testid="intake-birthDate"
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <EMRSelect
                  label={t('encounter.intake.identity.patientGender')}
                  value={state.patientGender ?? null}
                  onChange={(v) => setField('patientGender', (v as EncounterHeader['patientGender']) ?? undefined)}
                  data={genderOptions}
                  size="md"
                  data-testid="intake-gender"
                />
              </Grid.Col>
            </Grid>
          </div>
        </section>

        {/* ---------------- Card 2: Visit context ---------------- */}
        <section className={classes.card} aria-labelledby="intake-visit-title">
          <header className={classes.cardHeader}>
            <Box className={classes.cardHeaderIcon} aria-hidden>
              <IconClipboardText size={18} stroke={1.75} />
            </Box>
            <h2 className={classes.cardHeaderTitle} id="intake-visit-title">
              {t('encounter.intake.visit.title')}
            </h2>
          </header>
          <div className={classes.cardBody}>
            <Grid gutter={{ base: 'sm', sm: 'md' }}>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <EMRTextInput
                  label={t('encounter.intake.visit.operatorName')}
                  value={state.operatorName}
                  onChange={(v) => setField('operatorName', v)}
                  size="md"
                  data-testid="intake-operator"
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <EMRTextInput
                  label={t('encounter.intake.visit.referringPhysician')}
                  value={state.referringPhysician}
                  onChange={(v) => setField('referringPhysician', v)}
                  size="md"
                  data-testid="intake-referring"
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <EMRTextInput
                  label={t('encounter.intake.visit.institution')}
                  value={state.institution}
                  onChange={(v) => setField('institution', v)}
                  size="md"
                  data-testid="intake-institution"
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <EMRDatePicker
                  label={t('encounter.intake.visit.encounterDate')}
                  value={isoToLocalDate(state.encounterDate)}
                  onChange={(d) => setField('encounterDate', localDateToIso(d) ?? '')}
                  size="md"
                  data-testid="intake-encounterDate"
                />
              </Grid.Col>
              <Grid.Col span={12}>
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
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <EMRCheckbox
                  label={t('encounter.intake.visit.informedConsent')}
                  checked={state.informedConsent}
                  onChange={handleConsentToggle}
                  size="md"
                  data-testid="intake-informedConsent"
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <EMRDatePicker
                  label={t('encounter.intake.visit.informedConsentSignedAt')}
                  value={isoToLocalDate(state.informedConsentSignedAt)}
                  onChange={(d) => setField('informedConsentSignedAt', localDateToIso(d))}
                  size="md"
                  disabled={!state.informedConsent}
                  data-testid="intake-consentSignedAt"
                />
              </Grid.Col>
            </Grid>
          </div>
        </section>

        {/* ---------------- Card 3: Indication ---------------- */}
        <section className={classes.card} aria-labelledby="intake-indication-title">
          <header className={classes.cardHeader}>
            <Box className={classes.cardHeaderIcon} aria-hidden>
              <IconStethoscope size={18} stroke={1.75} />
            </Box>
            <h2 className={classes.cardHeaderTitle} id="intake-indication-title">
              {t('encounter.intake.indication.title')}
            </h2>
          </header>
          <div className={classes.cardBody}>
            <Grid gutter={{ base: 'sm', sm: 'md' }}>
              <Grid.Col span={12}>
                <Box className={classes.icd10Wrapper}>
                  <label className={classes.icd10Label} htmlFor="intake-icd10">
                    {t('encounter.intake.indication.icd10Label')}
                  </label>
                  <MultiSelect
                    id="intake-icd10"
                    data={icd10Options}
                    value={selectedIcd10CodeStrings}
                    onChange={handleIcd10Change}
                    placeholder={t('encounter.intake.indication.icd10Placeholder')}
                    searchable
                    clearable
                    hidePickedOptions
                    maxDropdownHeight={280}
                    comboboxProps={{ withinPortal: true, zIndex: 10000 }}
                    data-testid="intake-icd10"
                    size="md"
                  />
                </Box>
              </Grid.Col>
              <Grid.Col span={12}>
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
              </Grid.Col>
            </Grid>
          </div>
        </section>

        {/* ---------------- Card 4: Studies ---------------- */}
        <section className={classes.card} aria-labelledby="intake-studies-title">
          <header className={classes.cardHeader}>
            <Box className={classes.cardHeaderIcon} aria-hidden>
              <IconChecklist size={18} stroke={1.75} />
            </Box>
            <h2 className={classes.cardHeaderTitle} id="intake-studies-title">
              {t('encounter.intake.studies.title')}
            </h2>
          </header>
          <div className={classes.cardBody}>
            <p className={classes.studyHelper} style={{ marginTop: 0, marginBottom: 14 }}>
              {t('encounter.intake.studies.subtitle')}
            </p>
            <div className={classes.studyGrid} role="group" aria-labelledby="intake-studies-title">
              {availableStudies.map((plugin) => {
                const Icon = plugin.icon;
                // Map plugin.key to the canonical StudyType. Today only the
                // Phase-1 trio is `available && FormComponent`; their keys
                // are `venousLE`, `arterialLE`, `carotid`. We choose the
                // bilateral variant for venous to match the existing
                // route-based default. Carotid + arterialLE map 1:1.
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
                  <label
                    key={plugin.key}
                    className={cardClasses}
                    data-testid={`intake-study-${plugin.key}`}
                  >
                    <Box className={classes.studyCardIcon} aria-hidden>
                      <Icon size={20} stroke={1.75} />
                    </Box>
                    <span className={classes.studyCardLabel}>
                      {t(`${plugin.translationKey}.title`)}
                    </span>
                    <span className={classes.studyCardCheckSlot}>
                      <EMRCheckbox
                        checked={checked}
                        onChange={() => toggleStudy(studyType)}
                        size="md"
                        aria-label={t(`${plugin.translationKey}.title`)}
                        data-testid={`intake-study-checkbox-${plugin.key}`}
                      />
                    </span>
                  </label>
                );
              })}
            </div>
            {state.selectedStudyTypes.length === 0 && (
              <p className={classes.studyHelper}>
                {t('encounter.intake.studies.selectAtLeastOne')}
              </p>
            )}
          </div>
        </section>

        {/* ---------------- Sticky action row ---------------- */}
        <div className={classes.actionRow} role="group" aria-label={t('common.actionsRegion')}>
          {hasResumable ? (
            <button
              type="button"
              className={classes.actionRowResume}
              onClick={handleResume}
              data-testid="intake-resume-link"
            >
              {t('encounter.intake.actions.resume')}
            </button>
          ) : (
            <span aria-hidden />
          )}
          <span className={classes.actionRowSpacer} />
          {canResetIntake && (
            <EMRButton
              variant="secondary"
              size="md"
              icon={IconUserPlus}
              onClick={handleNewPatient}
              data-testid="intake-new-patient"
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
          >
            {editingEncounterId
              ? t('encounter.intake.actions.continue', 'Continue')
              : t('encounter.intake.actions.start')}
          </EMRButton>
          {!canStart && startHint && (
            <span className={classes.actionRowHint} data-testid="intake-start-hint">
              {startHint}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

export default EncounterIntake;
