/**
 * PatientBlock — two-row grid of patient + encounter metadata.
 *
 * Corestudycast shows 10–12 metadata fields in two compact rows. We follow
 * the same grid: Name / MRN / DOB / Age / Gender · Study Time / Reading
 * Group / Referring Physician / Equipment / Quality / Codes.
 *
 * The fields are driven by whatever's present on `StudyHeader` — any
 * missing ones simply show an em-dash.
 */
import type { ReactElement } from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { PDF_THEME, PDF_FONT_SIZES, PDF_FONT_FAMILY } from '../pdfTheme';
import type { StudyHeader } from '../../../types/form';

export interface PatientBlockLabels {
  readonly patientName: string;
  readonly mrn: string;
  readonly dob: string;
  readonly age: string;
  readonly gender: string;
  readonly studyDate: string;
  readonly operator: string;
  readonly referring: string;
  readonly institution: string;
  readonly accession: string;
  // Phase 1.5 Corestudycast additions (all optional for backwards compat)
  readonly medications?: string;
  readonly patientPosition?: string;
  readonly icd10Codes?: string;
  readonly cptCode?: string;
  readonly informedConsent?: string;
  readonly informedConsentYes?: string;
  readonly informedConsentNo?: string;
  /** Localized labels for `patientPosition` enum values. */
  readonly positionLabels?: Readonly<Record<string, string>>;
}

export interface PatientBlockProps {
  readonly header: StudyHeader;
  readonly labels: PatientBlockLabels;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8fafc',
    borderWidth: 0.5,
    borderColor: PDF_THEME.border,
    borderStyle: 'solid',
    borderRadius: 2,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 10,
    fontFamily: PDF_FONT_FAMILY,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  cell: {
    flexDirection: 'column',
    flexGrow: 1,
    flexBasis: 0,
    paddingHorizontal: 4,
  },
  label: {
    fontSize: PDF_FONT_SIZES.footnote,
    color: PDF_THEME.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: PDF_FONT_SIZES.label,
    color: PDF_THEME.text,
    fontWeight: 'bold',
    marginTop: 1,
  },
});

function computeAgeYears(isoDob: string | undefined, refDate: string): string {
  if (!isoDob) return '—';
  const dob = new Date(isoDob);
  const ref = new Date(refDate);
  if (Number.isNaN(dob.getTime()) || Number.isNaN(ref.getTime())) return '—';
  let years = ref.getFullYear() - dob.getFullYear();
  const m = ref.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < dob.getDate())) {
    years -= 1;
  }
  return years >= 0 ? `${years}y` : '—';
}

function fieldValue(value: string | undefined): string {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : '—';
}

function Cell({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): ReactElement {
  return (
    <View style={styles.cell}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export function PatientBlock({ header, labels }: PatientBlockProps): ReactElement {
  const age = computeAgeYears(header.patientBirthDate, header.studyDate);

  // Derive the Phase 1.5 row values.
  const positionKey = header.patientPosition;
  const positionDisplay = positionKey
    ? labels.positionLabels?.[positionKey] ?? positionKey
    : undefined;
  const icd10Display =
    header.icd10Codes && header.icd10Codes.length > 0
      ? header.icd10Codes.map((c) => c.code).join(', ')
      : undefined;
  const cptDisplay = header.cptCode
    ? `${header.cptCode.code} — ${header.cptCode.display}`
    : undefined;
  const consentDisplay =
    header.informedConsent === true
      ? `${labels.informedConsentYes ?? 'Yes'}${
          header.informedConsentSignedAt ? ` (${header.informedConsentSignedAt})` : ''
        }`
      : header.informedConsent === false
      ? labels.informedConsentNo ?? 'No'
      : undefined;
  const medicationsDisplay = header.medications;

  const hasExtraRow1 = !!(
    labels.patientPosition ||
    labels.icd10Codes ||
    labels.cptCode ||
    labels.informedConsent
  ) &&
    (positionDisplay || icd10Display || cptDisplay || consentDisplay);
  const hasMedicationsRow = !!labels.medications && !!medicationsDisplay;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Cell label={labels.patientName} value={fieldValue(header.patientName)} />
        <Cell label={labels.mrn} value={fieldValue(header.patientId)} />
        <Cell label={labels.dob} value={fieldValue(header.patientBirthDate)} />
        <Cell label={labels.age} value={age} />
        <Cell label={labels.gender} value={fieldValue(header.patientGender)} />
      </View>
      <View style={styles.row}>
        <Cell label={labels.studyDate} value={fieldValue(header.studyDate)} />
        <Cell label={labels.operator} value={fieldValue(header.operatorName)} />
        <Cell label={labels.referring} value={fieldValue(header.referringPhysician)} />
        <Cell label={labels.institution} value={fieldValue(header.institution)} />
        <Cell label={labels.accession} value={fieldValue(header.accessionNumber)} />
      </View>
      {hasExtraRow1 ? (
        <View style={styles.row}>
          {labels.patientPosition ? (
            <Cell label={labels.patientPosition} value={fieldValue(positionDisplay)} />
          ) : null}
          {labels.cptCode ? (
            <Cell label={labels.cptCode} value={fieldValue(cptDisplay)} />
          ) : null}
          {labels.icd10Codes ? (
            <Cell label={labels.icd10Codes} value={fieldValue(icd10Display)} />
          ) : null}
          {labels.informedConsent ? (
            <Cell label={labels.informedConsent} value={fieldValue(consentDisplay)} />
          ) : null}
        </View>
      ) : null}
      {hasMedicationsRow ? (
        <View style={styles.row}>
          <Cell label={labels.medications!} value={fieldValue(medicationsDisplay)} />
        </View>
      ) : null}
    </View>
  );
}
