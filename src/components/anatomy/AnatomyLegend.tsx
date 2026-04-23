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

export interface AnatomyLegendProps {
  /** Prefer horizontal layout (default: true). */
  horizontal?: boolean;
  /** Additional CSS class. */
  className?: string;
}

const COMPETENCIES: readonly Competency[] = [
  'normal',
  'ablated',
  'incompetent',
  'inconclusive',
] as const;

export function AnatomyLegend({
  horizontal = true,
  className,
}: AnatomyLegendProps): React.ReactElement {
  const { t } = useTranslation();
  const colors = useAnatomyColors();

  const items = COMPETENCIES.map((competency) => {
    const { fill, stroke } = colors[competency];
    const swatchStyle: CSSProperties = {
      width: '14px',
      height: '14px',
      backgroundColor: fill,
      border: `1.5px solid ${stroke}`,
      borderRadius: '2px',
      flexShrink: 0,
      display: 'inline-block',
    };
    return (
      <Group key={competency} gap={6} wrap="nowrap" align="center">
        <span aria-hidden="true" style={swatchStyle} />
        <Text
          style={{
            color: 'var(--emr-text-secondary)',
            fontSize: 'var(--emr-font-sm)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {t(`competency.${competency}`, competency)}
        </Text>
      </Group>
    );
  });

  if (horizontal) {
    return (
      <Group
        gap="md"
        wrap="wrap"
        justify="center"
        className={className}
        role="list"
        aria-label={t('anatomy.legend.label', 'Competency legend')}
      >
        {items}
      </Group>
    );
  }

  return (
    <Stack
      gap="xs"
      className={className}
      role="list"
      aria-label={t('anatomy.legend.label', 'Competency legend')}
    >
      {items}
    </Stack>
  );
}
