/**
 * AnatomyLegend — small key showing the four competency states and their
 * color swatches. Used underneath any `AnatomyView` so a reader can decode
 * what the colors mean at a glance.
 *
 * Layout: horizontal from sm breakpoint up, vertical stack below.
 */

import { Group, Stack, Text } from '@mantine/core';
import type { CSSProperties } from 'react';
import type { Competency } from '../../types/anatomy';
import { useTranslation } from '../../contexts/TranslationContext';
import { useAnatomyColors } from './useAnatomyColors';

/** One legend entry. `pattern` renders the diagonal grey/white stripe swatch. */
export interface AnatomyLegendItem {
  readonly key: string;
  readonly label: string;
  readonly fill: string;
  readonly stroke: string;
  readonly pattern?: boolean;
}

export interface AnatomyLegendProps {
  /** Prefer horizontal layout (default: true). */
  horizontal?: boolean;
  /** Additional CSS class. */
  className?: string;
  /**
   * Custom legend entries (e.g. carotid severity bands). When omitted, the
   * default venous competency legend is rendered.
   */
  items?: ReadonlyArray<AnatomyLegendItem>;
  /** Overrides the default aria-label. */
  ariaLabel?: string;
}

const COMPETENCIES: readonly Competency[] = [
  'normal',
  'occluded',
  'incompetent',
  'inconclusive',
  'ablated',
] as const;

export function AnatomyLegend({
  horizontal = true,
  className,
  items: customItems,
  ariaLabel,
}: AnatomyLegendProps): React.ReactElement {
  const { t } = useTranslation();
  const colors = useAnatomyColors();

  // Default (venous) legend, or caller-supplied entries (e.g. carotid severity).
  const entries: ReadonlyArray<AnatomyLegendItem> =
    customItems ??
    COMPETENCIES.map((competency) => ({
      key: competency,
      label: t(`competency.${competency}`, competency),
      fill: colors[competency].fill,
      stroke: colors[competency].stroke,
      // Inconclusive renders as stripes to match the anatomy fill pattern.
      pattern: competency === 'inconclusive',
    }));

  const items = entries.map((entry) => {
    const swatchStyle: CSSProperties = {
      width: '14px',
      height: '14px',
      backgroundColor: entry.pattern ? '#ffffff' : entry.fill,
      ...(entry.pattern
        ? {
            backgroundImage:
              'repeating-linear-gradient(45deg, #9ca3af 0 2px, #ffffff 2px 4px)',
          }
        : {}),
      border: `1.5px solid ${entry.stroke}`,
      borderRadius: '2px',
      flexShrink: 0,
      display: 'inline-block',
    };
    return (
      <Group key={entry.key} gap={6} wrap="nowrap" align="center">
        <span aria-hidden="true" style={swatchStyle} />
        <Text
          style={{
            color: 'var(--emr-text-secondary)',
            fontSize: 'var(--emr-font-sm)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {entry.label}
        </Text>
      </Group>
    );
  });

  const label = ariaLabel ?? t('anatomy.legend.label', 'Competency legend');

  if (horizontal) {
    return (
      <Group gap="md" wrap="wrap" justify="center" className={className} role="list" aria-label={label}>
        {items}
      </Group>
    );
  }

  return (
    <Stack gap="xs" className={className} role="list" aria-label={label}>
      {items}
    </Stack>
  );
}
