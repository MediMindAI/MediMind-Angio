/**
 * FooterSection — fixed footer rendered on every page.
 *
 * Content (left to right):
 *   org name + optional address · "Page N of M" · timestamp
 *
 * Uses @react-pdf's `render` callback on the Text element to compute the
 * page count strings dynamically per page.
 */
import type { ReactElement } from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { PDF_THEME, PDF_FONT_SIZES, PDF_FONT_FAMILY } from '../pdfTheme';

export interface FooterSectionProps {
  readonly orgName?: string;
  readonly orgAddress?: string;
  readonly timestamp: string;
  /** Label template for "Page X of Y" — e.g. "Page {current} of {total}". */
  readonly pageLabelTemplate: string;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 16,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: PDF_THEME.border,
    borderTopStyle: 'solid',
    paddingTop: 4,
    fontFamily: PDF_FONT_FAMILY,
  },
  cell: {
    fontSize: PDF_FONT_SIZES.footnote,
    color: PDF_THEME.textMuted,
    flexBasis: 0,
    flexGrow: 1,
  },
  center: {
    textAlign: 'center',
  },
  right: {
    textAlign: 'right',
  },
  orgName: {
    fontWeight: 'bold',
    color: PDF_THEME.text,
  },
});

export function FooterSection({
  orgName,
  orgAddress,
  timestamp,
  pageLabelTemplate,
}: FooterSectionProps): ReactElement {
  return (
    <View style={styles.container} fixed>
      <Text style={styles.cell}>
        {orgName ? <Text style={styles.orgName}>{orgName}</Text> : null}
        {orgName && orgAddress ? ' · ' : ''}
        {orgAddress ?? ''}
      </Text>
      <Text
        style={{ ...styles.cell, ...styles.center }}
        render={({ pageNumber, totalPages }) =>
          pageLabelTemplate
            .replace('{current}', String(pageNumber))
            .replace('{total}', String(totalPages))
        }
      />
      <Text style={{ ...styles.cell, ...styles.right }}>{timestamp}</Text>
    </View>
  );
}
