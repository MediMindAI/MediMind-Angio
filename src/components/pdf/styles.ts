/**
 * Shared StyleSheet — the base styles every PDF section consumes.
 *
 * We centralize styles here (rather than co-locating in each section) so
 * rhythm + spacing stay consistent across the document. Each section can
 * still define per-component overrides for layout specifics.
 */
import { StyleSheet } from '@react-pdf/renderer';
import { PDF_THEME, PDF_FONT_SIZES, PDF_FONT_FAMILY } from './pdfTheme';

export const baseStyles = StyleSheet.create({
  page: {
    backgroundColor: PDF_THEME.background,
    color: PDF_THEME.text,
    fontFamily: PDF_FONT_FAMILY,
    fontSize: PDF_FONT_SIZES.body,
    paddingTop: 40,
    paddingBottom: 48, // leave room for the fixed footer
    paddingLeft: 36,
    paddingRight: 36,
  },
  // --- Headings
  h1: {
    fontSize: PDF_FONT_SIZES.title,
    fontWeight: 'bold',
    color: PDF_THEME.primary,
  },
  h2: {
    fontSize: PDF_FONT_SIZES.heading,
    fontWeight: 'bold',
    color: PDF_THEME.primary,
    marginBottom: 6,
  },
  h3: {
    fontSize: PDF_FONT_SIZES.body,
    fontWeight: 'bold',
    color: PDF_THEME.secondary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: PDF_FONT_SIZES.label,
    color: PDF_THEME.textMuted,
  },
  // --- Body
  paragraph: {
    fontSize: PDF_FONT_SIZES.body,
    lineHeight: 1.45,
    marginBottom: 6,
  },
  muted: {
    color: PDF_THEME.textMuted,
  },
  // --- Sections
  section: {
    marginBottom: 12,
  },
  // --- Table cells (used by FindingsTable + PatientBlock)
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: PDF_THEME.primary,
    color: '#ffffff',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  tableSubHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    color: PDF_THEME.text,
    paddingVertical: 3,
    paddingHorizontal: 6,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_THEME.border,
    borderBottomStyle: 'solid',
  },
  tableRowStriped: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_THEME.border,
    borderBottomStyle: 'solid',
    backgroundColor: '#f8fafc',
  },
  tableCell: {
    fontSize: PDF_FONT_SIZES.label,
    paddingHorizontal: 2,
  },
  // --- Badges / pills
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    fontSize: PDF_FONT_SIZES.footnote,
    color: '#ffffff',
  },
});
