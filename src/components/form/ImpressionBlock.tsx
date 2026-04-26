// SPDX-License-Identifier: Apache-2.0
/**
 * ImpressionBlock — auto-generated impression with manual override.
 *
 * Behaviour:
 *   - On mount, and whenever `findings` change, compute a fresh narrative via
 *     `narrativeFromFindings`.
 *   - Pre-fill the textarea with the auto-generated impression the first
 *     time a narrative is produced, OR whenever the user clicks "Regenerate".
 *   - Once the user edits the textarea, set `edited = true` and stop overwriting
 *     it on every findings change. Show a badge and a "Regenerate from findings"
 *     action so the user can opt back in.
 */

import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { Box, Group, Text } from '@mantine/core';
import { IconFileAnalytics, IconRefresh } from '@tabler/icons-react';
import { EMRTextarea } from '../shared/EMRFormFields';
import { EMRButton, EMRBadge } from '../common';
import { buildLocalizedNarrative } from '../../services/narrativeService';
import type { VenousSegmentFindings } from '../studies/venous-le/config';
import { useTranslation } from '../../contexts/TranslationContext';
import classes from './ImpressionBlock.module.css';

export interface ImpressionBlockProps {
  /** Current per-segment findings — drives narrative. */
  readonly findings: VenousSegmentFindings;
  /** Current impression text (stored on the form). */
  readonly value: string;
  /** Whether the user has manually edited the auto-generated text. */
  readonly edited: boolean;
  /** Change handler — called when the textarea content changes. */
  readonly onChange: (next: string, edited: boolean) => void;
  /** Regenerate from findings — forcibly overwrites the textarea and clears edited. */
  readonly onRegenerate: (next: string) => void;
}

/** Compose the auto-generated impression block from a narrative. */
function composeAutoImpression(
  rightFindings: string,
  leftFindings: string,
  conclusions: ReadonlyArray<string>,
  rightHeading: string,
  leftHeading: string,
  conclusionsHeading: string,
): string {
  const parts: string[] = [];
  if (rightFindings) parts.push(`${rightHeading}\n${rightFindings}`);
  if (leftFindings) parts.push(`${leftHeading}\n${leftFindings}`);
  if (conclusions.length > 0) {
    parts.push(`${conclusionsHeading}\n${conclusions.map((c) => `• ${c}`).join('\n')}`);
  }
  return parts.join('\n\n').trim();
}

export const ImpressionBlock = memo(function ImpressionBlock({
  findings,
  value,
  edited,
  onChange,
  onRegenerate,
}: ImpressionBlockProps): React.ReactElement {
  const { t } = useTranslation();

  const rightHeading = t('venousLE.narrativeSections.rightFindings', 'Right lower extremity — findings');
  const leftHeading = t('venousLE.narrativeSections.leftFindings', 'Left lower extremity — findings');
  const conclusionsHeading = t('venousLE.narrativeSections.conclusions', 'Conclusions');

  // Compute fresh narrative whenever findings change — localized via active `t`.
  const autoText = useMemo(() => {
    const narrative = buildLocalizedNarrative(findings, t);
    return composeAutoImpression(
      narrative.rightFindings,
      narrative.leftFindings,
      narrative.conclusions,
      rightHeading,
      leftHeading,
      conclusionsHeading,
    );
  }, [findings, t, rightHeading, leftHeading, conclusionsHeading]);

  // Auto-fill: if the user has not edited, keep value synced with auto.
  // Compare against the actual stored `value` (not a ref) so we don't fire
  // an extra onChange when a parent re-render produces an identical autoText.
  const lastAutoRef = useRef<string>(autoText);
  useEffect(() => {
    if (!edited && autoText !== value) {
      lastAutoRef.current = autoText;
      onChange(autoText, false);
    } else if (!edited) {
      lastAutoRef.current = autoText;
    }
  }, [autoText, edited, value, onChange]);

  const handleChange = useCallback(
    (next: string): void => {
      // Mark as edited unless the new value matches the auto-generated one.
      const isEdited = next !== autoText && next.trim().length > 0;
      onChange(next, isEdited);
    },
    [autoText, onChange],
  );

  const handleRegenerate = useCallback((): void => {
    lastAutoRef.current = autoText;
    onRegenerate(autoText);
  }, [autoText, onRegenerate]);

  return (
    <section className={classes.card} aria-labelledby="impression-title">
      <header className={classes.head}>
        <Group gap="sm" align="center" wrap="nowrap">
          <Box className={classes.iconWrap} aria-hidden>
            <IconFileAnalytics size={20} stroke={1.75} />
          </Box>
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Text className={classes.title} id="impression-title">
              {t('venousLE.impression.title')}
            </Text>
            <Text className={classes.subtitle}>{t('venousLE.impression.subtitle')}</Text>
          </Box>
          <Group gap="xs" align="center" wrap="nowrap" style={{ flexShrink: 0 }}>
            {edited && (
              <EMRBadge variant="warning" size="sm">
                {t('venousLE.impression.editedBadge')}
              </EMRBadge>
            )}
            <EMRButton
              variant="onGradient"
              size="xs"
              icon={IconRefresh}
              onClick={handleRegenerate}
              data-testid="impression-regenerate"
            >
              {t('venousLE.impression.regenerate')}
            </EMRButton>
          </Group>
        </Group>
      </header>

      <div className={classes.body}>
        <EMRTextarea
          label=""
          placeholder={t('venousLE.impression.placeholder')}
          value={value}
          onChange={handleChange}
          autosize
          minRows={6}
          maxRows={24}
          size="md"
          data-testid="impression-textarea"
          fullWidth
        />
      </div>
    </section>
  );
});

export default ImpressionBlock;
