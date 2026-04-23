/**
 * ReportDocument — Phase 0 smoke-test PDF.
 *
 * This is intentionally tiny; its purpose is to prove two things end-to-end:
 *
 *   1. The NotoSansGeorgian font is registered and renders Georgian glyphs
 *      (U+10A0..U+10FF) correctly in the exported PDF.
 *   2. @react-pdf's `<Svg>` primitive works — colored rectangles and
 *      circles render, which is what the real anatomy diagrams will use.
 *
 * If either check fails visually, the upstream font or SVG pipeline is
 * broken and subsequent feature work will cascade-fail. Keep this
 * smoke-test file alive in the tree until Phase 1 replaces it with the
 * full report renderer.
 */

import type { ReactElement } from 'react';
import { Document, Page, Text, View, StyleSheet, Svg, Rect, Circle } from '@react-pdf/renderer';
import { PDF_THEME, PDF_FONT_SIZES, PDF_FONT_FAMILY } from './pdfTheme';

export interface ReportDocumentProps {
  /** i18n-ready label bag; smoke-test ignores keys and uses hardcoded strings. */
  readonly labels?: Readonly<Record<string, string>>;
  /** Opaque payload — smoke-test ignores data; the real renderer will consume it. */
  readonly data?: unknown;
}

// ---------------------------------------------------------------------------
// Styles (kept co-located so the smoke test file is fully self-contained)
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    backgroundColor: PDF_THEME.background,
    paddingTop: 40,
    paddingBottom: 40,
    paddingLeft: 40,
    paddingRight: 40,
    fontFamily: PDF_FONT_FAMILY,
    color: PDF_THEME.text,
    fontSize: PDF_FONT_SIZES.body,
  },
  header: {
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: PDF_THEME.primary,
    borderBottomStyle: 'solid',
    paddingBottom: 8,
  },
  title: {
    fontSize: PDF_FONT_SIZES.title,
    fontWeight: 'bold',
    color: PDF_THEME.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: PDF_FONT_SIZES.label,
    color: PDF_THEME.textMuted,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: PDF_FONT_SIZES.heading,
    fontWeight: 'bold',
    color: PDF_THEME.secondary,
    marginBottom: 6,
  },
  paragraph: {
    fontSize: PDF_FONT_SIZES.body,
    lineHeight: 1.5,
    marginBottom: 6,
  },
  svgWrapper: {
    alignItems: 'center',
    marginVertical: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: PDF_FONT_SIZES.footnote,
    color: PDF_THEME.textMuted,
    borderTopWidth: 1,
    borderTopColor: PDF_THEME.border,
    borderTopStyle: 'solid',
    paddingTop: 6,
  },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReportDocument(_props: ReportDocumentProps): ReactElement {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>MediMind Angio — Phase 0 Smoke Test</Text>
          <Text style={styles.subtitle}>Font &amp; SVG pipeline verification</Text>
        </View>

        {/* Georgian font test */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Georgian font check</Text>
          <Text style={styles.paragraph}>ანგიოლოგიური კვლევის ანგარიში</Text>
          <Text style={styles.paragraph}>
            (If the line above renders as glyphs rather than boxes, NotoSansGeorgian is registered correctly.)
          </Text>
        </View>

        {/* SVG primitive test */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>SVG primitive check</Text>
          <View style={styles.svgWrapper}>
            <Svg width={200} height={120} viewBox="0 0 200 120">
              {/* Rounded outer frame */}
              <Rect
                x={2}
                y={2}
                width={196}
                height={116}
                rx={8}
                ry={8}
                fill={PDF_THEME.primary}
                stroke={PDF_THEME.secondary}
                strokeWidth={2}
              />
              {/* Inner circle to verify circle primitive */}
              <Circle cx={100} cy={60} r={38} fill={PDF_THEME.accent} stroke="#ffffff" strokeWidth={3} />
              {/* Small accent dot */}
              <Circle cx={100} cy={60} r={8} fill="#ffffff" />
            </Svg>
          </View>
          <Text style={styles.paragraph}>
            If a deep-navy rounded rectangle with a bright-blue circle inside is visible, @react-pdf SVG primitives
            are working.
          </Text>
        </View>

        {/* Footer */}
        <Text style={styles.footer} fixed>
          Page 1 of 1
        </Text>
      </Page>
    </Document>
  );
}
