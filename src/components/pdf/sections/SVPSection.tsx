// SPDX-License-Identifier: Apache-2.0
/**
 * SVPSection — prints the SVP (Symptoms–Varices–Pathophysiology) classification
 * in a compact block, mirroring CEAPSection. The P axis can carry several
 * segments, so its value renders one line per segment.
 */
import type { ReactElement } from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import type { SvpClassification } from '../../../types/svp';
import { formatSvpClassification, formatSegment, SVP_SEGMENT_ORDER } from '../../../services/svpService';
import { PDF_THEME, PDF_FONT_SIZES, PDF_FONT_FAMILY } from '../pdfTheme';

export interface SVPSectionLabels {
  readonly heading: string;
  readonly sAxis: string;
  readonly vAxis: string;
  readonly pAxis: string;
}

export interface SVPSectionProps {
  readonly svp: SvpClassification;
  readonly labels: SVPSectionLabels;
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
  axisLine: {
    flexDirection: 'row',
    marginBottom: 1,
  },
  axisLabel: {
    fontSize: PDF_FONT_SIZES.footnote,
    color: PDF_THEME.textMuted,
    fontWeight: 'bold',
    width: 16,
  },
  axisValue: {
    fontSize: PDF_FONT_SIZES.footnote,
    color: PDF_THEME.text,
    flexGrow: 1,
  },
});

export function SVPSection({ svp, labels }: SVPSectionProps): ReactElement {
  const sValue = svp.s.length > 0 ? svp.s.join(' ') : 'S0';
  const vValue = svp.v.length > 0 ? svp.v.join(' ') : 'V0';
  const pSegments = [...svp.p].sort(
    (a, b) => SVP_SEGMENT_ORDER.indexOf(a.segment) - SVP_SEGMENT_ORDER.indexOf(b.segment),
  );
  const pValue = pSegments.length > 0 ? pSegments.map(formatSegment).join('; ') : '—';

  return (
    <View style={styles.block}>
      <Text style={styles.heading}>{labels.heading}</Text>
      <Text style={styles.classification}>{formatSvpClassification(svp)}</Text>
      <View style={styles.axisLine}>
        <Text style={styles.axisLabel}>S</Text>
        <Text style={styles.axisValue}>
          {labels.sAxis}: {sValue}
        </Text>
      </View>
      <View style={styles.axisLine}>
        <Text style={styles.axisLabel}>V</Text>
        <Text style={styles.axisValue}>
          {labels.vAxis}: {vValue}
        </Text>
      </View>
      <View style={styles.axisLine}>
        <Text style={styles.axisLabel}>P</Text>
        <Text style={styles.axisValue}>
          {labels.pAxis}: {pValue}
        </Text>
      </View>
    </View>
  );
}
