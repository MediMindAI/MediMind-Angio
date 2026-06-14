// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * TrendChart Constants
 *
 * Default values, colors, and configuration for the TrendChart component.
 *
 * @module components/common/TrendChart/constants
 */

import type { ChartPadding, TrendThresholds } from './types';

/**
 * Default chart padding
 */
export const CHART_PADDING: ChartPadding = {
  top: 25,
  right: 25,
  bottom: 45,
  left: 50,
};

/**
 * Default chart dimensions
 */
export const DEFAULT_CHART_WIDTH = 600;
export const DEFAULT_CHART_HEIGHT = 250;

/**
 * Point configuration
 */
export const POINT_CONFIG = {
  /** Default point radius */
  radius: 5,
  /** Radius when hovered */
  hoverRadius: 7,
  /** Stroke width around points */
  strokeWidth: 2,
  /** Larger invisible hit area for better click/hover targeting */
  hitAreaRadius: 15,
};

/**
 * Line configuration
 */
export const LINE_CONFIG = {
  /** Line stroke width */
  strokeWidth: 2.5,
  /** Stroke line cap style */
  strokeLinecap: 'round' as const,
  /** Stroke line join style */
  strokeLinejoin: 'round' as const,
};

/**
 * Zone colors with transparency (CSS rgba values)
 * Using EMR theme colors with appropriate opacity
 */
export const ZONE_COLORS = {
  good: 'rgba(56, 161, 105, 0.08)', // emr-success with low opacity
  warning: 'rgba(221, 107, 32, 0.08)', // emr-warning with low opacity
  critical: 'rgba(229, 62, 62, 0.08)', // emr-error with low opacity
};

/**
 * Status colors using CSS variables for theme support
 */
export const STATUS_COLORS = {
  good: 'var(--emr-success)',
  warning: 'var(--emr-warning)',
  critical: 'var(--emr-error)',
};

/**
 * Default thresholds for "lower is better" metrics (e.g., DSO)
 */
export const DEFAULT_THRESHOLDS_LOWER: TrendThresholds = {
  good: 40,
  warning: 50,
  critical: 60,
};

/**
 * Default thresholds for "higher is better" metrics (e.g., rates)
 */
export const DEFAULT_THRESHOLDS_HIGHER: TrendThresholds = {
  good: 95,
  warning: 90,
  critical: 85,
};

/**
 * Number of Y-axis ticks to display
 */
export const Y_AXIS_TICK_COUNT = 5;

/**
 * Grid line opacity
 */
export const GRID_OPACITY = 0.5;

/**
 * Target line configuration
 */
export const TARGET_LINE_CONFIG = {
  strokeWidth: 2,
  strokeDasharray: '6 3',
};

/**
 * Animation durations (in milliseconds)
 */
export const ANIMATION_DURATIONS = {
  lineDrawing: 800,
  pointScale: 150,
  tooltipFade: 150,
  zoneTransition: 200,
};

/**
 * Maximum X-axis labels before showing every nth label
 */
export const MAX_X_LABELS = 12;

/**
 * Currency symbol for currency formatting
 */
export const CURRENCY_SYMBOL = '$';
