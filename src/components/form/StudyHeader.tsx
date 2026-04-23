// SPDX-License-Identifier: Apache-2.0
/**
 * StudyHeader — patient + visit + operator metadata block.
 *
 * Renders a responsive card with a consistent Grid that collapses gracefully
 * from 3 columns on desktop to 1 column on mobile. All inputs are EMR
 * wrappers — zero raw Mantine form elements.
 */

import { memo, useMemo } from 'react';
import { Box, Grid, Group, MultiSelect, Text } from '@mantine/core';
import { IconClipboardText } from '@tabler/icons-react';
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

function isoDateToDate(iso: string | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateToIso(d: Date | null): string | undefined {
  if (!d) return undefined;
  return d.toISOString().slice(0, 10);
}

export const StudyHeader = memo(function StudyHeader({
  value,
  onChange,
}: StudyHeaderProps): React.ReactElement {
  const { t, lang } = useTranslation();

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
      // Stamp the signed-at timestamp when the box is first checked.
      informedConsentSignedAt: checked
        ? value.informedConsentSignedAt ?? new Date().toISOString().slice(0, 10)
        : undefined,
    };
    onChange(nextValue);
  };

  return (
    <section className={classes.card} aria-labelledby="study-header-title">
      <header className={classes.head}>
        <Group gap="sm" align="center" wrap="nowrap">
          <Box className={classes.iconWrap} aria-hidden>
            <IconClipboardText size={20} stroke={1.75} />
          </Box>
          <Box style={{ minWidth: 0 }}>
            <Text className={classes.title} id="study-header-title">
              {t('venousLE.header.title')}
            </Text>
          </Box>
        </Group>
      </header>

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
              value={isoDateToDate(value.patientBirthDate)}
              onChange={(d) => update('patientBirthDate', dateToIso(d))}
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
              value={isoDateToDate(value.studyDate)}
              onChange={(d) => update('studyDate', dateToIso(d) ?? '')}
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
              value={isoDateToDate(value.informedConsentSignedAt)}
              onChange={(d) => update('informedConsentSignedAt', dateToIso(d))}
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
    </section>
  );
});

export default StudyHeader;
