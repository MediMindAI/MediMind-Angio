// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import React, { useMemo, type ReactNode } from 'react';
import { Box, Text, Stack } from '@mantine/core';
import styles from './EMRCircularGauge.module.css';

/**
 * Status types for EMRCircularGauge
 */
export type EMRCircularGaugeStatus = 'excellent' | 'good' | 'warning' | 'critical' | 'info';

/**
 * Variant types for EMRCircularGauge
 */
export type EMRCircularGaugeVariant = 'circle' | 'semicircle';

/**
 * Props for EMRCircularGauge component
 */
export interface EMRCircularGaugeProps {
  /** Current value to display on the gauge */
  value: number;
  /** Maximum value for the gauge scale (default: 100) */
  maxValue?: number;
  /** Optional target/benchmark value */
  targetValue?: number;
  /** Status determines the color of the progress arc */
  status: EMRCircularGaugeStatus;
  /** Variant of the gauge: 'circle' (360°) or 'semicircle' (180°) */
  variant?: EMRCircularGaugeVariant;
  /** Size of the gauge in pixels (minimum 120, default 150) */
  size?: number;
  /** Width of the progress stroke (default: size * 0.1 for circle, size * 0.08 for semicircle) */
  strokeWidth?: number;
  /** Custom display value (overrides calculated percentage) */
  displayValue?: string | number;
  /** Unit label shown below the value (e.g., "days", "%", "GEL") */
  unit?: string;
  /** Whether to show the status badge below the gauge (default: true) */
  showStatus?: boolean;
  /** Whether to show the target text below the gauge (default: true if targetValue is provided) */
  showTarget?: boolean;
  /** Custom label for the target (e.g., "Target", "Benchmark") */
  targetLabel?: string;
  /** Custom format for target display (e.g., "35 days", "96%") */
  targetFormat?: string;
  /** Whether to show scale markers (0%, 50%, 100%) - only for semicircle variant */
  showScaleMarkers?: boolean;
  /** Custom content to render in the center of the gauge */
  centerContent?: ReactNode;
  /** Accessible label for screen readers */
  ariaLabel?: string;
  /** Custom status label (overrides default based on status) */
  statusLabel?: string;
  /** Custom className for the container */
  className?: string;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * Get status color CSS variable
 */
function getStatusColor(status: EMRCircularGaugeStatus): string {
  switch (status) {
    case 'excellent':
      return 'var(--emr-success)';
    case 'good':
      return 'var(--emr-info)';
    case 'warning':
      return 'var(--emr-warning)';
    case 'critical':
      return 'var(--emr-error)';
    case 'info':
    default:
      return 'var(--emr-info)';
  }
}

/**
 * Get default status label
 */
function getDefaultStatusLabel(status: EMRCircularGaugeStatus): string {
  switch (status) {
    case 'excellent':
      return 'Excellent';
    case 'good':
      return 'Good';
    case 'warning':
      return 'Warning';
    case 'critical':
      return 'Critical';
    case 'info':
    default:
      return 'Info';
  }
}

/**
 * EMRCircularGauge - Reusable circular progress gauge component
 *
 * A clean, modern circular gauge that displays a value as a progress arc.
 * Features:
 * - Color-coded status (green/blue/yellow/red)
 * - Optional status badge below the gauge
 * - Optional target/benchmark text display
 * - Accessible meter role with ARIA attributes
 * - Dark mode support
 * - Smooth animations
 *
 * @example
 * ```tsx
 * // DSO Gauge
 * <EMRCircularGauge
 *   value={37}
 *   maxValue={100}
 *   targetValue={35}
 *   status="good"
 *   displayValue={37}
 *   unit="days"
 *   showStatus
 *   showTarget
 *   targetLabel="Target"
 *   targetFormat="35 days"
 * />
 *
 * // Collection Rate Gauge
 * <EMRCircularGauge
 *   value={94}
 *   maxValue={100}
 *   targetValue={96}
 *   status="warning"
 *   displayValue="94%"
 *   unit="Collection"
 *   showStatus
 *   showTarget
 *   targetLabel="Benchmark"
 *   targetFormat="96%"
 * />
 *
 * // Census Occupancy Gauge
 * <EMRCircularGauge
 *   value={78}
 *   maxValue={100}
 *   status="warning"
 *   displayValue="78%"
 *   unit="Occupancy"
 *   showStatus
 * />
 * ```
 */
export function EMRCircularGauge({
  value,
  maxValue = 100,
  targetValue,
  status,
  variant = 'circle',
  size = 150,
  strokeWidth,
  displayValue,
  unit,
  showStatus = true,
  showTarget,
  targetLabel = 'Target',
  targetFormat,
  showScaleMarkers = false,
  centerContent,
  ariaLabel,
  statusLabel,
  className,
  'data-testid': testId,
}: EMRCircularGaugeProps): React.ReactElement {
  const isSemicircle = variant === 'semicircle';

  // Ensure minimum size of 120px
  const gaugeSize = Math.max(120, size);
  // Different stroke width defaults: 10% for circle, 8% for semicircle
  const calculatedStrokeWidth = strokeWidth ?? (isSemicircle ? gaugeSize * 0.08 : gaugeSize * 0.1);
  const radius = (gaugeSize - calculatedStrokeWidth) / 2;

  // Full circle uses 2*PI*r, semicircle uses PI*r
  const circumference = isSemicircle ? Math.PI * radius : 2 * Math.PI * radius;

  // Calculate progress (capped at 100%)
  const progress = useMemo(() => {
    const clampedValue = Math.min(value, maxValue);
    return Math.max(0, Math.min(1, clampedValue / maxValue));
  }, [value, maxValue]);

  // Calculate stroke dashoffset for progress
  const strokeDashoffset = circumference * (1 - progress);

  // Get status color
  const statusColor = useMemo(() => getStatusColor(status), [status]);

  // Get status label
  const resolvedStatusLabel = statusLabel ?? getDefaultStatusLabel(status);

  // Determine if we should show target (default to true if targetValue is provided)
  const shouldShowTarget = showTarget ?? (targetValue !== undefined);

  // Format target display
  const targetDisplay = targetFormat ?? (targetValue !== undefined ? String(targetValue) : '');

  // Accessible label
  const accessibleLabel =
    ariaLabel ??
    `Value: ${displayValue ?? Math.round(value)}${unit ? ` ${unit}` : ''}. Status: ${resolvedStatusLabel}${
      shouldShowTarget && targetValue !== undefined ? `. ${targetLabel}: ${targetDisplay}` : ''
    }`;

  // Semicircle needs extra height for scale markers
  const svgHeight = isSemicircle ? gaugeSize / 2 + 30 : gaugeSize;
  const containerHeight = isSemicircle ? gaugeSize / 2 + 30 : gaugeSize;

  return (
    <Stack
      align="center"
      gap="xs"
      className={`${styles.container}${className ? ` ${className}` : ''}`}
      data-testid={testId}
    >
      <Box
        className={isSemicircle ? styles.semicircleContainer : styles.gaugeContainer}
        style={{ width: gaugeSize, height: containerHeight }}
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={maxValue}
        aria-label={accessibleLabel}
        aria-valuetext={`${displayValue ?? Math.round(value)}${unit ? ` ${unit}` : ''}`}
      >
        <svg
          width={gaugeSize}
          height={svgHeight}
          viewBox={`0 0 ${gaugeSize} ${svgHeight}`}
          className={styles.gaugeSvg}
        >
          {isSemicircle ? (
            <>
              {/* Background semi-circle arc */}
              <path
                d={`M ${calculatedStrokeWidth / 2} ${gaugeSize / 2}
                    A ${radius} ${radius} 0 0 1 ${gaugeSize - calculatedStrokeWidth / 2} ${gaugeSize / 2}`}
                fill="none"
                stroke="var(--emr-border-color)"
                strokeWidth={calculatedStrokeWidth}
                strokeLinecap="round"
                className={styles.backgroundCircle}
              />

              {/* Progress semi-circle arc */}
              <path
                d={`M ${calculatedStrokeWidth / 2} ${gaugeSize / 2}
                    A ${radius} ${radius} 0 0 1 ${gaugeSize - calculatedStrokeWidth / 2} ${gaugeSize / 2}`}
                fill="none"
                stroke={statusColor}
                strokeWidth={calculatedStrokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className={styles.progressCircle}
              />

              {/* Scale markers for semicircle */}
              {showScaleMarkers && (
                <g className={styles.scaleMarkers}>
                  {/* 0% marker */}
                  <text
                    x={calculatedStrokeWidth / 2 - 5}
                    y={gaugeSize / 2 + 20}
                    className={styles.scaleText}
                    textAnchor="start"
                  >
                    0%
                  </text>
                  {/* 50% marker */}
                  <text
                    x={gaugeSize / 2}
                    y={15}
                    className={styles.scaleText}
                    textAnchor="middle"
                  >
                    50%
                  </text>
                  {/* 100% marker */}
                  <text
                    x={gaugeSize - calculatedStrokeWidth / 2 + 5}
                    y={gaugeSize / 2 + 20}
                    className={styles.scaleText}
                    textAnchor="end"
                  >
                    100%
                  </text>
                </g>
              )}
            </>
          ) : (
            <>
              {/* Background circle */}
              <circle
                cx={gaugeSize / 2}
                cy={gaugeSize / 2}
                r={radius}
                fill="none"
                stroke="var(--emr-border-color)"
                strokeWidth={calculatedStrokeWidth}
                className={styles.backgroundCircle}
              />

              {/* Progress arc */}
              <circle
                cx={gaugeSize / 2}
                cy={gaugeSize / 2}
                r={radius}
                fill="none"
                stroke={statusColor}
                strokeWidth={calculatedStrokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform={`rotate(-90 ${gaugeSize / 2} ${gaugeSize / 2})`}
                className={styles.progressCircle}
              />
            </>
          )}
        </svg>

        {/* Center content */}
        <Box
          className={isSemicircle ? styles.semicircleCenterContent : styles.centerContent}
          style={isSemicircle ? { top: gaugeSize / 2 - 10 } : undefined}
        >
          {centerContent ?? (
            <>
              <Text
                className={styles.gaugeValue}
                style={{
                  fontSize: isSemicircle ? gaugeSize * 0.22 : gaugeSize * 0.2,
                  color: statusColor,
                }}
              >
                {displayValue ?? Math.round(value)}
              </Text>
              {unit && (
                <Text
                  className={styles.gaugeLabel}
                  style={{ fontSize: isSemicircle ? gaugeSize * 0.08 : gaugeSize * 0.09 }}
                >
                  {unit}
                </Text>
              )}
            </>
          )}
        </Box>
      </Box>

      {/* Status badge */}
      {showStatus && (
        <Text
          className={styles.statusBadge}
          style={{ color: statusColor }}
          data-status={status}
        >
          {resolvedStatusLabel}
        </Text>
      )}

      {/* Target indicator text */}
      {shouldShowTarget && targetDisplay && (
        <Text className={styles.targetText} c="dimmed" size="sm">
          {targetLabel}: {targetDisplay}
        </Text>
      )}
    </Stack>
  );
}

export default EMRCircularGauge;
