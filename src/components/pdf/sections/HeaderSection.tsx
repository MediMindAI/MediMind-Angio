/**
 * HeaderSection — the top band of every report.
 *
 * Visual: a solid navy strip with the clinic logo on the left, the report
 * title and subtitle in the middle, and the issue date on the right. Below
 * the strip sits a thinner accent underline.
 *
 * Plain-language: this is the "letterhead" at the top of the PDF.
 */
import type { ReactElement } from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { PDF_THEME, PDF_FONT_SIZES, PDF_FONT_FAMILY } from '../pdfTheme';

export interface HeaderSectionProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly issueDate: string;
  /** Localized "Issued" label rendered above the issue date. Defaults to "Issued". */
  readonly issuedLabel?: string;
  readonly orgName?: string;
}

const styles = StyleSheet.create({
  band: {
    backgroundColor: PDF_THEME.primary,
    color: '#ffffff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontFamily: PDF_FONT_FAMILY,
  },
  accentBar: {
    height: 3,
    backgroundColor: PDF_THEME.accent,
    marginBottom: 10,
  },
  left: {
    flexDirection: 'column',
    flexGrow: 1,
    maxWidth: '70%',
  },
  right: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: PDF_FONT_SIZES.label,
    color: '#bee3f8',
    marginTop: 2,
  },
  dateLabel: {
    fontSize: PDF_FONT_SIZES.footnote,
    color: '#bee3f8',
  },
  dateValue: {
    fontSize: PDF_FONT_SIZES.label,
    color: '#ffffff',
    fontWeight: 'bold',
    marginTop: 2,
  },
  orgName: {
    fontSize: PDF_FONT_SIZES.footnote,
    color: '#bee3f8',
    marginTop: 2,
  },
});

export function HeaderSection(props: HeaderSectionProps): ReactElement {
  return (
    <View>
      <View style={styles.band} fixed>
        <View style={styles.left}>
          <Text style={styles.title}>{props.title}</Text>
          {props.subtitle ? <Text style={styles.subtitle}>{props.subtitle}</Text> : null}
          {props.orgName ? <Text style={styles.orgName}>{props.orgName}</Text> : null}
        </View>
        <View style={styles.right}>
          <Text style={styles.dateLabel}>{props.issuedLabel ?? 'Issued'}</Text>
          <Text style={styles.dateValue}>{props.issueDate}</Text>
        </View>
      </View>
      <View style={styles.accentBar} fixed />
    </View>
  );
}

/**
 * PreliminaryWatermark — large rotated text stamp for draft reports.
 * Rendered as an absolute-positioned layer so it sits over the page
 * content without disturbing flow.
 */
export function PreliminaryWatermark({ label }: { readonly label: string }): ReactElement {
  return (
    <View
      fixed
      style={{
        position: 'absolute',
        top: '40%',
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.1,
        transform: 'rotate(-30deg)',
        zIndex: -1,
      }}
    >
      <Text
        style={{
          fontFamily: PDF_FONT_FAMILY,
          fontSize: 96,
          fontWeight: 'bold',
          color: PDF_THEME.error,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
