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
import { PDF_THEME, PDF_FONT_SIZES, PDF_FONT_FAMILY, PDF_BAND_COLORS } from '../pdfTheme';
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

// Band tints sourced from `PDF_BAND_COLORS` (Wave 4.3 — single source of
// truth in `pdfTheme.ts`). NASCET only uses 4 of 5 bands (no `info`).

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
          backgroundColor: PDF_BAND_COLORS.neutral.bg,
          color: PDF_BAND_COLORS.neutral.fg,
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
        backgroundColor: PDF_BAND_COLORS[role].bg,
        color: PDF_BAND_COLORS[role].fg,
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
