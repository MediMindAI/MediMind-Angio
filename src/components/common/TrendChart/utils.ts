// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * TrendChart Utilities
 *
 * Helper functions for scale calculation, path generation, and formatting.
 *
 * @module components/common/TrendChart/utils
 */

import type {
  TrendDataPoint,
  TrendThresholds,
  ThresholdDirection,
  TrendStatus,
  YAxisFormat,
  ChartPadding,
  ChartScales,
} from './types';
import { Y_AXIS_TICK_COUNT, CURRENCY_SYMBOL } from './constants';
import { silentLog } from '../../../utils/silentLog';

/**
 * Calculate chart scales based on data and dimensions
 */
export function calculateScales(
  data: TrendDataPoint[],
  innerWidth: number,
  innerHeight: number,
  padding: ChartPadding,
  targetValue?: number,
  thresholds?: TrendThresholds,
  yAxisFormat?: YAxisFormat
): ChartScales {
  if (!data || data.length === 0) {
    return {
      xScale: () => padding.left,
      yScale: () => padding.top + innerHeight,
      minY: 0,
      maxY: 100,
    };
  }

  const values = data.map((d) => d.value);

  // Calculate min and max with some padding
  let dataMin = Math.min(...values);
  let dataMax = Math.max(...values);

  // Include target value in range calculation if provided
  if (targetValue !== undefined) {
    dataMin = Math.min(dataMin, targetValue);
    dataMax = Math.max(dataMax, targetValue);
  }

  // Include thresholds in range for zones to display correctly
  if (thresholds) {
    if (thresholds.good !== undefined) {
      dataMin = Math.min(dataMin, thresholds.good);
      dataMax = Math.max(dataMax, thresholds.good);
    }
    if (thresholds.warning !== undefined) {
      dataMin = Math.min(dataMin, thresholds.warning);
      dataMax = Math.max(dataMax, thresholds.warning);
    }
    if (thresholds.critical !== undefined) {
      dataMin = Math.min(dataMin, thresholds.critical);
      dataMax = Math.max(dataMax, thresholds.critical);
    }
  }

  // For percentage format, constrain to reasonable bounds
  if (yAxisFormat === 'percentage') {
    dataMin = Math.max(0, Math.min(dataMin, 80)); // At least show from 80%
    dataMax = Math.min(100, Math.max(dataMax, 100));
  }

  // Add padding to the range (10%)
  const range = dataMax - dataMin || 1;
  const minY = Math.max(0, dataMin - range * 0.1);
  const maxY = dataMax + range * 0.1;

  // Round to nice numbers
  const roundedMinY = yAxisFormat === 'percentage'
    ? Math.floor(minY / 5) * 5
    : Math.floor(minY);
  const roundedMaxY = yAxisFormat === 'percentage'
    ? Math.ceil(maxY / 5) * 5
    : Math.ceil(maxY);

  const xScale = (index: number): number => {
    const dataPoints = data.length - 1 || 1;
    return padding.left + (index / dataPoints) * innerWidth;
  };

  const yScale = (value: number): number => {
    const normalizedValue = (value - roundedMinY) / (roundedMaxY - roundedMinY || 1);
    return padding.top + innerHeight - normalizedValue * innerHeight;
  };

  return { xScale, yScale, minY: roundedMinY, maxY: roundedMaxY };
}

/**
 * Generate Y-axis tick values
 */
export function generateYTicks(minY: number, maxY: number, tickCount: number = Y_AXIS_TICK_COUNT): number[] {
  const ticks: number[] = [];
  const range = maxY - minY;
  const step = range / (tickCount - 1);

  for (let i = 0; i < tickCount; i++) {
    ticks.push(Math.round(minY + step * i));
  }

  return ticks;
}

/**
 * Generate the line path for SVG
 */
export function generateLinePath(
  data: TrendDataPoint[],
  xScale: (index: number) => number,
  yScale: (value: number) => number
): string {
  if (!data || data.length === 0) return '';

  return data
    .map((point, index) => {
      const x = xScale(index);
      const y = yScale(point.value);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}

/**
 * Generate the area path for gradient fill under the line
 */
export function generateAreaPath(
  data: TrendDataPoint[],
  xScale: (index: number) => number,
  yScale: (value: number) => number,
  padding: ChartPadding,
  innerHeight: number,
  chartWidth: number
): string {
  if (!data || data.length === 0) return '';

  const linePoints = data
    .map((point, index) => `${xScale(index)} ${yScale(point.value)}`)
    .join(' L ');

  const bottomY = padding.top + innerHeight;
  const startX = padding.left;
  const endX = chartWidth - padding.right;

  return `M ${startX} ${bottomY} L ${linePoints} L ${endX} ${bottomY} Z`;
}

/**
 * Get status based on value and thresholds
 */
export function getStatus(
  value: number,
  thresholds: TrendThresholds | undefined,
  direction: ThresholdDirection
): TrendStatus {
  if (!thresholds) return 'good';

  if (direction === 'lower-is-better') {
    // Lower values are better (e.g., DSO days)
    if (value <= thresholds.good) return 'good';
    if (thresholds.warning !== undefined && value <= thresholds.warning) return 'warning';
    return 'critical';
  } else {
    // Higher values are better (e.g., clean claim rate)
    if (value >= thresholds.good) return 'good';
    if (thresholds.warning !== undefined && value >= thresholds.warning) return 'warning';
    return 'critical';
  }
}

/**
 * Format date for short X-axis display (e.g., "Jan", "Feb")
 */
export function formatDateShort(dateStr: string, locale = 'ka-GE'): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale, { month: 'short' });
  } catch (err) {
    silentLog('TrendChart', 'formatDate', err);
    return dateStr;
  }
}

/**
 * Format date with day for X-axis (e.g., "Jan 15")
 */
export function formatDateWithDay(dateStr: string, locale = 'ka-GE'): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  } catch (err) {
    silentLog('TrendChart', 'formatDate', err);
    return dateStr;
  }
}

/**
 * Format date for full tooltip display (e.g., "January 2024")
 */
export function formatDateFull(dateStr: string, locale = 'ka-GE'): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  } catch (err) {
    silentLog('TrendChart', 'formatDate', err);
    return dateStr;
  }
}

/**
 * Format value based on axis format
 */
export function formatValue(value: number, format: YAxisFormat): string {
  switch (format) {
    case 'percentage':
      return `${value.toFixed(1)}%`;
    case 'days':
      return `${Math.round(value)} days`;
    case 'currency':
      return `${CURRENCY_SYMBOL}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'number':
    default:
      return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  }
}

/**
 * Format value for Y-axis tick labels (shorter format)
 */
export function formatYAxisTick(value: number, format: YAxisFormat): string {
  switch (format) {
    case 'percentage':
      return `${Math.round(value)}%`;
    case 'days':
      return `${Math.round(value)}`;
    case 'currency':
      return `${CURRENCY_SYMBOL}${value.toLocaleString()}`;
    case 'number':
    default:
      return value.toLocaleString();
  }
}

/**
 * Determine if X-axis label should be shown based on data density
 */
export function shouldShowXLabel(index: number, totalPoints: number, maxLabels: number): boolean {
  if (totalPoints <= maxLabels) return true;
  const step = Math.ceil(totalPoints / maxLabels);
  return index % step === 0;
}

/**
 * Calculate stroke-dasharray for line animation
 */
export function calculateDashArray(linePath: string): { dashArray: string; dashOffset: number } {
  // Approximate path length based on point count
  const pointCount = (linePath.match(/L/g) || []).length + 1;
  const approximateLength = pointCount * 50; // Rough estimate

  return {
    dashArray: `${approximateLength}`,
    dashOffset: approximateLength,
  };
}

/**
 * Generate a unique ID for SVG elements
 */
export function generateChartId(prefix: string = 'trend-chart'): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
}
