// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * TrendChartTooltip Component
 *
 * Floating tooltip that displays data point details on hover.
 *
 * @module components/common/TrendChart/TrendChartTooltip
 */

import React from 'react';
import { Paper, Stack, Group, Text } from '@mantine/core';
import type { TrendChartTooltipProps } from './types';
import { formatDateFull, formatValue } from './utils';
import styles from './TrendChart.module.css';

/**
 * Status badge styles based on status
 */
const STATUS_BADGE_CLASSES: Record<string, string | undefined> = {
  good: styles.tooltipBadgeGood,
  warning: styles.tooltipBadgeWarning,
  critical: styles.tooltipBadgeCritical,
};

/**
 * TrendChartTooltip - Floating tooltip for data point details
 *
 * Features:
 * - Date display in full format
 * - Formatted value based on axis type
 * - Status badge with color coding
 * - Smooth fade-in animation
 * - Dark mode support
 *
 * @example
 * ```tsx
 * <TrendChartTooltip
 *   point={{ date: '2024-01-15', value: 42.5 }}
 *   position={{ x: 150, y: 80 }}
 *   status="good"
 *   yAxisFormat="days"
 *   visible={hoveredPoint !== null}
 * />
 * ```
 */
export function TrendChartTooltip({
  point,
  position,
  status,
  yAxisFormat,
  visible,
}: TrendChartTooltipProps): React.ReactElement | null {
  if (!visible || !point) {
    return null;
  }

  const formattedDate = formatDateFull(point.date);
  const formattedValue = formatValue(point.value, yAxisFormat);
  const badgeClass = STATUS_BADGE_CLASSES[status] || STATUS_BADGE_CLASSES.good;

  return (
    <Paper
      className={styles.tooltip}
      style={{
        left: position.x + 15,
        top: position.y - 50,
      }}
      p="xs"
      data-testid="trend-chart-tooltip"
    >
      <Stack gap={6}>
        <Text className={styles.tooltipDate} size="xs">
          {formattedDate}
        </Text>
        <Group gap="xs" align="center">
          <Text className={styles.tooltipValue}>
            {formattedValue}
          </Text>
          <span className={`${styles.tooltipBadge} ${badgeClass}`}>
            {status}
          </span>
        </Group>

        {/* Display metadata if available */}
        {point.metadata && Object.keys(point.metadata).length > 0 && (
          <Stack gap={2} mt={4}>
            {Object.entries(point.metadata).map(([key, value]) => (
              <Group key={key} gap="xs" justify="space-between">
                <Text size="xs" c="dimmed">
                  {key}:
                </Text>
                <Text size="xs" fw={500}>
                  {typeof value === 'number' ? value.toLocaleString() : value}
                </Text>
              </Group>
            ))}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

export default TrendChartTooltip;
