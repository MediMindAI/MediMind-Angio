// SPDX-License-Identifier: Apache-2.0
/**
 * NASCETSummaryBlock — compact 2-row NASCET-classification panel for PDF.
 *
 * Plain-language: NASCET is the grading system for carotid-artery narrowing.
 * This block shows Right ICA on row 1, Left ICA on row 2, each with a
 * severity-tinted chip for the category.
 */
import type { ReactElement } from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { PDF_THEME, PDF_FONT_SIZES, PDF_FONT_FAMILY } from '../pdfTheme';
import type {
  CarotidNascetClassification,
  NascetCategory,
} from '../../studies/carotid/config';
import { nascetCategoryColorRole } from '../../studies/carotid/stenosisCalculator';

export interface NASCETSummaryLabels {
  readonly title: string;
  readonly rightIca: string;
  readonly leftIca: string;
  readonly categoryName: Record<NascetCategory, string>;
  readonly noneLabel: string;
}

export interface NASCETSummaryBlockProps {
  readonly nascet: CarotidNascetClassification;
  readonly labels: NASCETSummaryLabels;
}

const BAND_BG: Record<'success' | 'warning' | 'error' | 'neutral', string> = {
  success: '#bbf7d0',
  warning: '#fde68a',
  error: '#fecaca',
  neutral: '#e5e7eb',
};

const BAND_FG: Record<'success' | 'warning' | 'error' | 'neutral', string> = {
  success: '#166534',
  warning: '#92400e',
  error: '#991b1b',
  neutral: '#374151',
};

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 4,
    marginBottom: 6,
    fontFamily: PDF_FONT_FAMILY,
  },
  titleBar: {
    backgroundColor: PDF_THEME.primary,
    color: '#ffffff',
    paddingVertical: 3,
    paddingHorizontal: 6,
    fontSize: PDF_FONT_SIZES.label,
    fontWeight: 'bold',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_THEME.border,
    borderBottomStyle: 'solid',
  },
  rowLabel: {
    fontSize: PDF_FONT_SIZES.label,
    fontWeight: 'bold',
    color: PDF_THEME.text,
    width: '30%',
  },
  chip: {
    fontSize: PDF_FONT_SIZES.label,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
});

function chipFor(cat: NascetCategory | undefined, labels: NASCETSummaryLabels): ReactElement {
  if (!cat) {
    return (
      <Text
        style={{
          ...styles.chip,
          backgroundColor: BAND_BG.neutral,
          color: BAND_FG.neutral,
        }}
      >
        {labels.noneLabel}
      </Text>
    );
  }
  const role = nascetCategoryColorRole(cat);
  return (
    <Text
      style={{
        ...styles.chip,
        backgroundColor: BAND_BG[role],
        color: BAND_FG[role],
      }}
    >
      {labels.categoryName[cat]}
    </Text>
  );
}

export function NASCETSummaryBlock({
  nascet,
  labels,
}: NASCETSummaryBlockProps): ReactElement {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.titleBar}>{labels.title}</Text>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{labels.rightIca}</Text>
        {chipFor(nascet.right, labels)}
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{labels.leftIca}</Text>
        {chipFor(nascet.left, labels)}
      </View>
    </View>
  );
}

export default NASCETSummaryBlock;
