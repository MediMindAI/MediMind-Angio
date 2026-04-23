/**
 * RecommendationsSection — ordered list of clinician follow-up actions.
 *
 * Each recommendation renders as a numbered item with an optional priority
 * badge (Routine / Urgent / Stat) and optional follow-up interval pill.
 * Priority colors map to our semantic tokens — routine=accent, urgent=warning,
 * stat=error — so readers can triage at a glance.
 */
import type { ReactElement } from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import type { Recommendation } from '../../../types/form';
import { PDF_THEME, PDF_FONT_SIZES, PDF_FONT_FAMILY } from '../pdfTheme';

export interface RecommendationsSectionLabels {
  readonly heading: string;
  readonly priority: {
    readonly routine: string;
    readonly urgent: string;
    readonly stat: string;
  };
  readonly followUpPrefix: string;
}

export interface RecommendationsSectionProps {
  readonly recommendations: ReadonlyArray<Recommendation>;
  readonly labels: RecommendationsSectionLabels;
}

const priorityColors: Record<'routine' | 'urgent' | 'stat', string> = {
  routine: PDF_THEME.accent,
  urgent: PDF_THEME.warning,
  stat: PDF_THEME.error,
};

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
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  number: {
    fontSize: PDF_FONT_SIZES.body,
    fontWeight: 'bold',
    color: PDF_THEME.secondary,
    width: 16,
  },
  body: {
    flexGrow: 1,
    flexDirection: 'column',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 1,
  },
  text: {
    fontSize: PDF_FONT_SIZES.body,
    color: PDF_THEME.text,
    flexGrow: 1,
  },
  badge: {
    paddingVertical: 1,
    paddingHorizontal: 4,
    borderRadius: 2,
    fontSize: PDF_FONT_SIZES.footnote,
    color: '#ffffff',
    marginLeft: 6,
    fontWeight: 'bold',
  },
  followUp: {
    fontSize: PDF_FONT_SIZES.footnote,
    color: PDF_THEME.textMuted,
    marginTop: 1,
  },
});

export function RecommendationsSection({
  recommendations,
  labels,
}: RecommendationsSectionProps): ReactElement | null {
  if (recommendations.length === 0) return null;

  return (
    <View style={styles.block}>
      <Text style={styles.heading}>{labels.heading}</Text>
      {recommendations.map((rec, idx) => {
        const priorityLabel = rec.priority ? labels.priority[rec.priority] : undefined;
        const priorityColor = rec.priority ? priorityColors[rec.priority] : undefined;
        return (
          <View key={rec.id || `rec-${idx}`} style={styles.item}>
            <Text style={styles.number}>{idx + 1}.</Text>
            <View style={styles.body}>
              <View style={styles.row}>
                <Text style={styles.text}>{rec.text}</Text>
                {priorityLabel && priorityColor ? (
                  <Text
                    style={{
                      ...styles.badge,
                      backgroundColor: priorityColor,
                    }}
                  >
                    {priorityLabel}
                  </Text>
                ) : null}
              </View>
              {rec.followUpInterval ? (
                <Text style={styles.followUp}>
                  {labels.followUpPrefix} {rec.followUpInterval}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
