// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * TrendChart Types
 *
 * TypeScript interfaces for the reusable TrendChart component.
 *
 * @module components/common/TrendChart/types
 */

/**
 * A single data point in the trend chart
 */
export interface TrendDataPoint {
  /** Date string in ISO format (YYYY-MM-DD) or any parseable format */
  date: string;
  /** The numeric value for this data point */
  value: number;
  /** Optional metadata to display in tooltip */
  metadata?: Record<string, string | number>;
}

/**
 * Threshold configuration for coloring zones and data points
 */
export interface TrendThresholds {
  /** Value at or below/above which is considered "good" */
  good: number;
  /** Value that triggers warning status */
  warning?: number;
  /** Value that triggers critical status (optional, defaults to no critical zone) */
  critical?: number;
}

/**
 * Y-axis format options for displaying values
 */
export type YAxisFormat = 'number' | 'percentage' | 'days' | 'currency';

/**
 * Threshold direction determines how values are colored
 * - 'lower-is-better': Values below threshold are good (e.g., DSO days)
 * - 'higher-is-better': Values above threshold are good (e.g., clean claim rate)
 */
export type ThresholdDirection = 'lower-is-better' | 'higher-is-better';

/**
 * Status derived from comparing value against thresholds
 */
export type TrendStatus = 'good' | 'warning' | 'critical';

/**
 * Chart padding configuration
 */
export interface ChartPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Tooltip position
 */
export interface TooltipPosition {
  x: number;
  y: number;
}

/**
 * Props for the TrendChart component
 */
export interface TrendChartProps {
  /** Array of data points to display */
  data: TrendDataPoint[];

  /** Format for Y-axis values and tooltip */
  yAxisFormat: YAxisFormat;

  /** Optional thresholds for coloring zones and points */
  thresholds?: TrendThresholds;

  /** How to interpret threshold values */
  thresholdDirection?: ThresholdDirection;

  /** Target value to show as horizontal line */
  targetValue?: number;

  /** Label for the target line (defaults to "Target") */
  targetLabel?: string;

  /** Whether to show colored threshold zones (default: true) */
  showZones?: boolean;

  /** Whether to show the target line (default: true) */
  showTargetLine?: boolean;

  /** Whether to show data points (default: true) */
  showPoints?: boolean;

  /** Whether to show area fill under line (default: true) */
  showArea?: boolean;

  /** Whether to show tooltips on hover (default: true) */
  showTooltips?: boolean;

  /** Whether to animate line drawing on mount (default: true) */
  animate?: boolean;

  /** Chart height in pixels (default: 250) */
  height?: number;

  /** Chart width in pixels (auto-fill if not specified) */
  width?: number;

  /** Chart title */
  title?: string;

  /** Y-axis label */
  yAxisLabel?: string;

  /** Callback when a data point is clicked */
  onPointClick?: (point: TrendDataPoint, index: number) => void;

  /** Accessible label for screen readers */
  ariaLabel?: string;

  /** Additional CSS class name */
  className?: string;

  /** Test ID for automated testing */
  'data-testid'?: string;
}

/**
 * Props for the TrendChartTooltip component
 */
export interface TrendChartTooltipProps {
  /** The data point being displayed */
  point: TrendDataPoint;
  /** Position relative to container */
  position: TooltipPosition;
  /** Status for badge color */
  status: TrendStatus;
  /** Format for displaying value */
  yAxisFormat: YAxisFormat;
  /** Whether the tooltip is visible */
  visible: boolean;
}

/**
 * Scale functions returned by useChartScales hook
 */
export interface ChartScales {
  /** Convert data index to x position */
  xScale: (index: number) => number;
  /** Convert value to y position */
  yScale: (value: number) => number;
  /** Minimum Y value (for axis rendering) */
  minY: number;
  /** Maximum Y value (for axis rendering) */
  maxY: number;
}
