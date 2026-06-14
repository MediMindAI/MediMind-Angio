// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * TrendChart Component Exports
 *
 * Reusable line chart for trend visualization with threshold zones,
 * target lines, and interactive tooltips.
 *
 * @module components/common/TrendChart
 */

export { TrendChart } from './TrendChart';
export { TrendChartTooltip } from './TrendChartTooltip';
export type {
  TrendChartProps,
  TrendChartTooltipProps,
  TrendDataPoint,
  TrendThresholds,
  TrendStatus,
  ThresholdDirection,
  YAxisFormat,
  ChartPadding,
  TooltipPosition,
  ChartScales,
} from './types';

// Export utility functions for advanced usage
export {
  calculateScales,
  generateYTicks,
  generateLinePath,
  generateAreaPath,
  getStatus,
  formatDateShort,
  formatDateWithDay,
  formatDateFull,
  formatValue,
  formatYAxisTick,
  shouldShowXLabel,
} from './utils';

// Export constants for customization
export {
  CHART_PADDING,
  DEFAULT_CHART_WIDTH,
  DEFAULT_CHART_HEIGHT,
  POINT_CONFIG,
  LINE_CONFIG,
  ZONE_COLORS,
  STATUS_COLORS,
  TARGET_LINE_CONFIG,
  DEFAULT_THRESHOLDS_LOWER,
  DEFAULT_THRESHOLDS_HIGHER,
} from './constants';
