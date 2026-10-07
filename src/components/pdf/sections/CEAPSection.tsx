/**
 * CEAPSection — prints the CEAP 2020 classification in a compact block.
 *
 * Layout:
 *   CEAP Classification (2020)
 *   C2s, Ep, As,d, Pr
 *
 * The per-axis C/E/A/P explanation lines were removed on clinician request
 * (2026-10-07) — the code alone is what goes in the report.
 */
import type { ReactElement } from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import type { CeapClassification } from '../../../types/ceap';
import { PDF_THEME, PDF_FONT_SIZES, PDF_FONT_FAMILY } from '../pdfTheme';

export interface CEAPSectionLabels {
  readonly heading: string;
}

export interface CEAPSectionProps {
  readonly ceap: CeapClassification;
  readonly labels: CEAPSectionLabels;
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: '#f1f5f9',
    borderLeftWidth: 3,
    borderLeftColor: PDF_THEME.accent,
    borderLeftStyle: 'solid',
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 8,
    fontFamily: PDF_FONT_FAMILY,
  },
  heading: {
    fontSize: PDF_FONT_SIZES.body,
    fontWeight: 'bold',
    color: PDF_THEME.primary,
    marginBottom: 2,
  },
  classification: {
    fontSize: PDF_FONT_SIZES.heading,
    fontWeight: 'bold',
    color: PDF_THEME.secondary,
    marginBottom: 4,
    letterSpacing: 1,
  },
});

export function formatCeapClassification(ceap: CeapClassification): string {
  const modSuffix = ceap.modifiers && ceap.modifiers.length > 0 ? ceap.modifiers.join('') : '';
  const cPart = `${ceap.c}${modSuffix.includes('s') || modSuffix.includes('a') ? modSuffix : ''}`;
  const recurrent = modSuffix.includes('r') && !ceap.c.endsWith('r') ? 'r' : '';
  return `${cPart}${recurrent}, ${ceap.e}, ${ceap.a}, ${ceap.p}`;
}

export function CEAPSection({ ceap, labels }: CEAPSectionProps): ReactElement {
  return (
    <View style={styles.block}>
      <Text style={styles.heading}>{labels.heading}</Text>
      <Text style={styles.classification}>{formatCeapClassification(ceap)}</Text>
    </View>
  );
}
