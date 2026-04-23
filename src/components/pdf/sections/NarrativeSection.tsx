/**
 * NarrativeSection — the prose portion of the report (page 2 on most studies).
 *
 * Splits narrative into four sub-blocks — Indication / Technique / Findings /
 * Impression / Comments — any of which may be empty. Empty blocks are not
 * rendered so single-paragraph reports stay compact.
 *
 * If the caller has already generated per-side narrative paragraphs
 * (`rightFindings` / `leftFindings`), we show them as separate labelled
 * blocks above the aggregated narrative. This mirrors Corestudycast's
 * two-column prose layout.
 */
import type { ReactElement } from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import type { StudyNarrative } from '../../../types/form';
import { PDF_THEME, PDF_FONT_SIZES, PDF_FONT_FAMILY } from '../pdfTheme';

export interface NarrativeSectionLabels {
  readonly rightFindings: string;
  readonly leftFindings: string;
  readonly indication: string;
  readonly technique: string;
  readonly findings: string;
  readonly impression: string;
  readonly comments: string;
  readonly conclusions: string;
}

export interface NarrativeSectionProps {
  readonly narrative: StudyNarrative;
  readonly labels: NarrativeSectionLabels;
  /** Optional pre-formatted per-side prose blocks. */
  readonly rightFindings?: string;
  readonly leftFindings?: string;
  /** Optional bullet list of conclusions. */
  readonly conclusions?: ReadonlyArray<string>;
}

const styles = StyleSheet.create({
  block: {
    marginBottom: 8,
    fontFamily: PDF_FONT_FAMILY,
  },
  heading: {
    fontSize: PDF_FONT_SIZES.body,
    fontWeight: 'bold',
    color: PDF_THEME.primary,
    marginBottom: 3,
    borderBottomWidth: 0.75,
    borderBottomColor: PDF_THEME.border,
    borderBottomStyle: 'solid',
    paddingBottom: 2,
  },
  body: {
    fontSize: PDF_FONT_SIZES.body,
    lineHeight: 1.45,
    color: PDF_THEME.text,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 2,
    alignItems: 'flex-start',
  },
  bulletMarker: {
    fontSize: PDF_FONT_SIZES.body,
    color: PDF_THEME.secondary,
    marginRight: 4,
    width: 10,
  },
  bulletText: {
    fontSize: PDF_FONT_SIZES.body,
    color: PDF_THEME.text,
    flexGrow: 1,
  },
});

function ParagraphBlock({
  title,
  text,
}: {
  readonly title: string;
  readonly text: string | undefined;
}): ReactElement | null {
  const trimmed = (text ?? '').trim();
  if (trimmed.length === 0) return null;
  return (
    <View style={styles.block}>
      <Text style={styles.heading}>{title}</Text>
      <Text style={styles.body}>{trimmed}</Text>
    </View>
  );
}

function BulletList({
  title,
  items,
}: {
  readonly title: string;
  readonly items: ReadonlyArray<string>;
}): ReactElement | null {
  const nonEmpty = items.map((s) => s.trim()).filter((s) => s.length > 0);
  if (nonEmpty.length === 0) return null;
  return (
    <View style={styles.block}>
      <Text style={styles.heading}>{title}</Text>
      {nonEmpty.map((line, idx) => (
        <View key={`bullet-${idx}`} style={styles.bulletRow}>
          <Text style={styles.bulletMarker}>•</Text>
          <Text style={styles.bulletText}>{line}</Text>
        </View>
      ))}
    </View>
  );
}

export function NarrativeSection({
  narrative,
  labels,
  rightFindings,
  leftFindings,
  conclusions,
}: NarrativeSectionProps): ReactElement {
  return (
    <View>
      <ParagraphBlock title={labels.indication} text={narrative.indication} />
      <ParagraphBlock title={labels.technique} text={narrative.technique} />
      <ParagraphBlock title={labels.rightFindings} text={rightFindings} />
      <ParagraphBlock title={labels.leftFindings} text={leftFindings} />
      <ParagraphBlock title={labels.findings} text={narrative.findings} />
      <ParagraphBlock title={labels.impression} text={narrative.impression} />
      {conclusions && conclusions.length > 0 ? (
        <BulletList title={labels.conclusions} items={conclusions} />
      ) : null}
      <ParagraphBlock title={labels.comments} text={narrative.comments} />
    </View>
  );
}
