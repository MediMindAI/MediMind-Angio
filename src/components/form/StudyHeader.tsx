// SPDX-License-Identifier: Apache-2.0
/**
 * StudyHeader — patient + visit + operator metadata block.
 *
 * Renders a responsive card with a consistent Grid that collapses gracefully
 * from 3 columns on desktop to 1 column on mobile. All inputs are EMR
 * wrappers — zero raw Mantine form elements.
 *
 * The whole form grid is wrapped in a Mantine `<Collapse>` region so that
 * clinicians who don't need the identity fields can keep them collapsed and
 * focus on the diagram + segment table. Expand/collapse state is persisted
 * to `localStorage` under `venous-le.study-header.expanded` — first visit
 * renders collapsed.
 */

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Collapse, Grid, Group, MultiSelect, Text, UnstyledButton } from '@mantine/core';
import {
  IconChevronDown,
  IconChevronUp,
  IconClipboardText,
} from '@tabler/icons-react';
import {
  EMRTextInput,
  EMRDatePicker,
  EMRSelect,
  EMRTextarea,
  EMRCheckbox,
} from '../shared/EMRFormFields';
import type { StudyHeader as StudyHeaderShape, IndicationCode, CptCode } from '../../types/form';
import type { PatientPosition } from '../../types/patient-position';
import { PATIENT_POSITIONS } from '../../types/patient-position';
import { VASCULAR_ICD10_CODES, icd10Display } from '../../constants/vascular-icd10';
import { VASCULAR_CPT_CODES, cptDisplay } from '../../constants/vascular-cpt';
import { useTranslation } from '../../contexts/TranslationContext';
import { localDateToIso, isoToLocalDate, nowIsoTimestamp } from '../../services/dateHelpers';
import classes from './StudyHeader.module.css';

type StudyQuality = 'excellent' | 'good' | 'suboptimal' | 'limited';
type StudyProtocol = 'standard' | 'dvt' | 'reflux' | 'preop';

/** Extended header value used by VenousLEForm. Adds quality/protocol + time/indication. */
export interface StudyHeaderValue extends StudyHeaderShape {
  readonly studyTime?: string;
  readonly indication?: string;
  readonly quality?: StudyQuality;
  readonly protocol?: StudyProtocol;
}

export interface StudyHeaderProps {
  readonly value: StudyHeaderValue;
  readonly onChange: (next: StudyHeaderValue) => void;
}

const EXPANDED_STORAGE_KEY = 'venous-le.study-header.expanded';

/** Derive patient age (whole years) from an ISO birth date. */
function ageFromBirthDate(birthIso: string | undefined): number | null {
  if (!birthIso) return null;
  const dob = new Date(birthIso);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

function loadExpandedPref(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(EXPANDED_STORAGE_KEY);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
  } catch {
    // swallow — private-mode / quota errors are non-fatal
  }
  return false;
}

function persistExpandedPref(next: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(EXPANDED_STORAGE_KEY, next ? 'true' : 'false');
  } catch {
    // swallow
  }
}

export const StudyHeader = memo(function StudyHeader({
  value,
  onChange,
}: StudyHeaderProps): React.ReactElement {
  const { t, lang } = useTranslation();

  const [expanded, setExpanded] = useState<boolean>(() => loadExpandedPref());

  useEffect(() => {
    persistExpandedPref(expanded);
  }, [expanded]);

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const derivedAge = useMemo(() => ageFromBirthDate(value.patientBirthDate), [value.patientBirthDate]);

  const update = <K extends keyof StudyHeaderValue>(key: K, v: StudyHeaderValue[K]): void => {
    onChange({ ...value, [key]: v });
  };

  const genderOptions = useMemo(
    () => [
      { value: 'male', label: t('venousLE.header.genderMale') },
      { value: 'female', label: t('venousLE.header.genderFemale') },
      { value: 'other', label: t('venousLE.header.genderOther') },
      { value: 'unknown', label: t('venousLE.header.genderUnknown') },
    ],
    [t],
  );

  const qualityOptions = useMemo(
    () => [
      { value: 'excellent', label: t('venousLE.header.qualityExcellent') },
      { value: 'good', label: t('venousLE.header.qualityGood') },
      { value: 'suboptimal', label: t('venousLE.header.qualitySuboptimal') },
      { value: 'limited', label: t('venousLE.header.qualityLimited') },
    ],
    [t],
  );

  const protocolOptions = useMemo(
    () => [
      { value: 'standard', label: t('venousLE.header.protocolStandard') },
      { value: 'dvt', label: t('venousLE.header.protocolDvt') },
      { value: 'reflux', label: t('venousLE.header.protocolReflux') },
      { value: 'preop', label: t('venousLE.header.protocolPreop') },
    ],
    [t],
  );

  const positionOptions = useMemo(
    () =>
      PATIENT_POSITIONS.map((p) => ({
        value: p,
        label: t(`venousLE.header.position.${p}`, p),
      })),
    [t],
  );

  const icd10Options = useMemo(
    () =>
      VASCULAR_ICD10_CODES.map((e) => ({
        value: e.code,
        label: `${e.code} — ${icd10Display(e, lang)}`,
      })),
    [lang],
  );

  const cptOptions = useMemo(
    () =>
      VASCULAR_CPT_CODES.map((e) => ({
        value: e.code,
        label: `${e.code} — ${cptDisplay(e, lang)}`,
      })),
    [lang],
  );

  const selectedIcd10Codes = useMemo(
    () => (value.icd10Codes ?? []).map((c) => c.code),
    [value.icd10Codes],
  );

  const handleIcd10Change = (codes: string[]): void => {
    const mapped: IndicationCode[] = codes.map((code) => {
      const entry = VASCULAR_ICD10_CODES.find((e) => e.code === code);
      return {
        code,
        display: entry ? icd10Display(entry, lang) : code,
      };
    });
    update('icd10Codes', mapped);
  };

  const handleCptChange = (code: string | null): void => {
    if (!code) {
      update('cptCode', undefined);
      return;
    }
    const entry = VASCULAR_CPT_CODES.find((e) => e.code === code);
    const next: CptCode = {
      code,
      display: entry ? cptDisplay(entry, lang) : code,
    };
    update('cptCode', next);
  };

  const handleConsentCheckbox = (checked: boolean): void => {
    const nextValue: StudyHeaderValue = {
      ...value,
      informedConsent: checked,
      // Stamp the signed-at timestamp when the box is first checked. Use a
      // full ISO 8601 instant (with `Z`) so FHIR Consent.dateTime is a
      // well-defined moment and cannot drift across day boundaries when
      // re-interpreted by another timezone. Subsequent edits via the date
      // picker write a YYYY-MM-DD string; FHIR `dateTime` accepts both.
      informedConsentSignedAt: checked
        ? value.informedConsentSignedAt ?? nowIsoTimestamp()
        : undefined,
    };
    onChange(nextValue);
  };

  // Compact summary chip — shown in header bar whether collapsed or not,
  // so clinicians see the key identifying fields without expanding.
  const summaryPatient = value.patientName?.trim() ?? '';
  const summaryDate = value.studyDate?.trim() ?? '';
  const summaryPatientLabel = t('venousLE.studyHeader.summaryPatient', 'Patient');
  const summaryDateLabel = t('venousLE.studyHeader.summaryDate', 'Study date');
  const headerTitle = t('venousLE.studyHeader.title', 'Study Data');
  const toggleAriaLabel = expanded
    ? t('venousLE.studyHeader.toggleCollapse', 'Collapse study data')
    : t('venousLE.studyHeader.toggleExpand', 'Expand study data');

  return (
    <section className={classes.card} aria-labelledby="study-header-title">
      <UnstyledButton
        component="header"
        className={classes.head}
        onClick={toggleExpanded}
        aria-expanded={expanded}
        aria-controls="study-header-body"
        aria-label={toggleAriaLabel}
      >
        <Group gap="sm" align="center" wrap="nowrap" style={{ width: '100%' }}>
          <Box className={classes.iconWrap} aria-hidden>
            <IconClipboardText size={20} stroke={1.75} />
          </Box>
          <Box style={{ minWidth: 0, flex: 1 }}>
            <Text className={classes.title} c="inherit" id="study-header-title">
              {headerTitle}
            </Text>
            <Text className={classes.summary} c="inherit">
              <span className={classes.summaryField}>
                <span className={classes.summaryLabel}>{summaryPatientLabel}:</span>{' '}
                <span className={classes.summaryValue}>
                  {summaryPatient || '—'}
                </span>
              </span>
              <span className={classes.summarySeparator}>·</span>
              <span className={classes.summaryField}>
                <span className={classes.summaryLabel}>{summaryDateLabel}:</span>{' '}
                <span className={classes.summaryValue}>
                  {summaryDate || '—'}
                </span>
              </span>
            </Text>
          </Box>
          <Box className={classes.chevron} aria-hidden>
            {expanded ? (
              <IconChevronUp size={20} stroke={1.75} />
            ) : (
              <IconChevronDown size={20} stroke={1.75} />
            )}
          </Box>
        </Group>
      </UnstyledButton>

      <Collapse in={expanded} id="study-header-body">
        <div className={classes.body}>
          <Grid gutter={{ base: 'sm', sm: 'md' }}>
            {/* Row 1 — patient identity */}
            <Grid.Col span={{ base: 12, sm: 6, lg: 4 }}>
              <EMRTextInput
                label={t('venousLE.header.patientName')}
                placeholder="..."
                value={value.patientName ?? ''}
                onChange={(v) => update('patientName', v)}
                size="md"
                data-testid="header-patientName"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 3, lg: 2 }}>
              <EMRTextInput
                label={t('venousLE.header.patientId')}
                value={value.patientId ?? ''}
                onChange={(v) => update('patientId', v)}
                size="md"
                data-testid="header-patientId"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 3, lg: 2 }}>
              <EMRDatePicker
                label={t('venousLE.header.birthDate')}
                value={isoToLocalDate(value.patientBirthDate)}
                onChange={(d) => update('patientBirthDate', localDateToIso(d))}
                size="md"
                data-testid="header-birthDate"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 3, lg: 1 }}>
              <EMRTextInput
                label={t('venousLE.header.age')}
                value={derivedAge !== null ? String(derivedAge) : ''}
                readOnly
                size="md"
                data-testid="header-age"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 3, lg: 3 }}>
              <EMRSelect
                label={t('venousLE.header.gender')}
                value={value.patientGender ?? null}
                onChange={(v) =>
                  update('patientGender', (v as StudyHeaderShape['patientGender']) ?? undefined)
                }
                data={genderOptions}
                size="md"
                data-testid="header-gender"
              />
            </Grid.Col>

            {/* Row 2 — study metadata */}
            <Grid.Col span={{ base: 6, sm: 4, lg: 3 }}>
              <EMRDatePicker
                label={t('venousLE.header.studyDate')}
                value={isoToLocalDate(value.studyDate)}
                onChange={(d) => update('studyDate', localDateToIso(d) ?? '')}
                size="md"
                data-testid="header-studyDate"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 2, lg: 2 }}>
              <EMRTextInput
                label={t('venousLE.header.studyTime')}
                type="time"
                value={value.studyTime ?? ''}
                onChange={(v) => update('studyTime', v)}
                size="md"
                data-testid="header-studyTime"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
              <EMRTextInput
                label={t('venousLE.header.operator')}
                value={value.operatorName ?? ''}
                onChange={(v) => update('operatorName', v)}
                size="md"
                data-testid="header-operator"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, lg: 4 }}>
              <EMRTextInput
                label={t('venousLE.header.referringPhysician')}
                value={value.referringPhysician ?? ''}
                onChange={(v) => update('referringPhysician', v)}
                size="md"
                data-testid="header-referring"
              />
            </Grid.Col>

            {/* Row 3 — institution */}
            <Grid.Col span={{ base: 12, sm: 6, lg: 4 }}>
              <EMRTextInput
                label={t('venousLE.header.institution')}
                value={value.institution ?? ''}
                onChange={(v) => update('institution', v)}
                size="md"
                data-testid="header-institution"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 6, lg: 2 }}>
              <EMRTextInput
                label={t('venousLE.header.accession')}
                value={value.accessionNumber ?? ''}
                onChange={(v) => update('accessionNumber', v)}
                size="md"
                data-testid="header-accession"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 6, lg: 3 }}>
              <EMRSelect
                label={t('venousLE.header.quality')}
                value={value.quality ?? null}
                onChange={(v) => update('quality', (v as StudyQuality) ?? undefined)}
                data={qualityOptions}
                size="md"
                data-testid="header-quality"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
              <EMRSelect
                label={t('venousLE.header.protocol')}
                value={value.protocol ?? null}
                onChange={(v) => update('protocol', (v as StudyProtocol) ?? undefined)}
                data={protocolOptions}
                size="md"
                data-testid="header-protocol"
              />
            </Grid.Col>

            {/* Row 4 — Patient position + CPT */}
            <Grid.Col span={{ base: 12, sm: 6, lg: 6 }}>
              <EMRSelect
                label={t('venousLE.header.patientPosition')}
                value={value.patientPosition ?? null}
                onChange={(v) =>
                  update('patientPosition', (v as PatientPosition | null) ?? undefined)
                }
                data={positionOptions}
                size="md"
                searchable
                data-testid="header-patientPosition"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, lg: 6 }}>
              <EMRSelect
                label={t('venousLE.header.cptCode')}
                value={value.cptCode?.code ?? null}
                onChange={(v) => handleCptChange(v)}
                data={cptOptions}
                size="md"
                searchable
                data-testid="header-cptCode"
              />
            </Grid.Col>

            {/* Row 5 — full-width ICD-10 multi-select */}
            <Grid.Col span={12}>
              <Box className={classes.icd10Wrapper}>
                <label className={classes.icd10Label} htmlFor="header-icd10">
                  {t('venousLE.header.icd10Codes')}
                </label>
                <MultiSelect
                  id="header-icd10"
                  data={icd10Options}
                  value={selectedIcd10Codes as string[]}
                  onChange={(v) => handleIcd10Change(v)}
                  placeholder={t('venousLE.header.icd10Placeholder', 'Select ICD-10 codes…')}
                  searchable
                  clearable
                  hidePickedOptions
                  maxDropdownHeight={280}
                  comboboxProps={{ withinPortal: true, zIndex: 10000 }}
                  data-testid="header-icd10"
                  size="md"
                />
              </Box>
            </Grid.Col>

            {/* Row 6 — Medications */}
            <Grid.Col span={12}>
              <EMRTextarea
                label={t('venousLE.header.medications')}
                value={value.medications ?? ''}
                onChange={(v) => update('medications', v)}
                minRows={2}
                maxRows={3}
                autosize
                size="md"
                data-testid="header-medications"
              />
            </Grid.Col>

            {/* Row 7 — Informed Consent checkbox + signed-at */}
            <Grid.Col span={{ base: 12, sm: 6, lg: 6 }}>
              <Box className={classes.consentRow}>
                <EMRCheckbox
                  label={t('venousLE.header.informedConsent')}
                  checked={value.informedConsent === true}
                  onChange={(checked) => handleConsentCheckbox(checked)}
                  size="md"
                  data-testid="header-informedConsent"
                />
              </Box>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, lg: 6 }}>
              <EMRDatePicker
                label={t('venousLE.header.informedConsentSignedAt')}
                value={isoToLocalDate(value.informedConsentSignedAt)}
                onChange={(d) => update('informedConsentSignedAt', localDateToIso(d))}
                size="md"
                disabled={value.informedConsent !== true}
                data-testid="header-informedConsentSignedAt"
              />
            </Grid.Col>

            {/* Row 8 — legacy free-text indication (kept as supplemental note) */}
            <Grid.Col span={12}>
              <EMRTextarea
                label={t('venousLE.header.indicationNotes')}
                value={value.indication ?? ''}
                onChange={(v) => update('indication', v)}
                minRows={2}
                maxRows={3}
                autosize
                size="md"
                data-testid="header-indication"
              />
            </Grid.Col>
          </Grid>
        </div>
      </Collapse>
    </section>
  );
});

export default StudyHeader;
