// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * TrendChart Component
 *
 * A modern, reusable line chart for displaying trend data with threshold zones,
 * target lines, and interactive tooltips. Designed to replace DSOTrendChart
 * and CleanClaimTrendChart with a unified, flexible implementation.
 *
 * Features:
 * - Flexible Y-axis formatting (number, percentage, days, currency)
 * - Configurable threshold zones with color coding
 * - Target line display
 * - Animated line drawing on mount
 * - Interactive hover tooltips
 * - Click handlers for data points
 * - Full dark mode support via CSS variables
 * - Mobile responsive design
 * - Accessibility with ARIA labels
 *
 * @module components/common/TrendChart/TrendChart
 */

import React, { useMemo, useState, useRef, useId } from 'react';
import { Box, Text, Group } from '@mantine/core';
import { useTranslation } from '../../../contexts/TranslationContext';
import type { TrendChartProps, TrendDataPoint, TooltipPosition, TrendStatus } from './types';
import {
  CHART_PADDING,
  DEFAULT_CHART_WIDTH,
  DEFAULT_CHART_HEIGHT,
  POINT_CONFIG,
  LINE_CONFIG,
  ZONE_COLORS,
  STATUS_COLORS,
  TARGET_LINE_CONFIG,
  GRID_OPACITY,
  MAX_X_LABELS,
  DEFAULT_THRESHOLDS_LOWER,
  DEFAULT_THRESHOLDS_HIGHER,
} from './constants';
import {
  calculateScales,
  generateYTicks,
  generateLinePath,
  generateAreaPath,
  getStatus,
  formatDateShort,
  formatYAxisTick,
  shouldShowXLabel,
} from './utils';
import { TrendChartTooltip } from './TrendChartTooltip';
import styles from './TrendChart.module.css';

/**
 * TrendChart - Reusable line chart for trend visualization
 *
 * @example
 * ```tsx
 * // DSO Trend (lower is better)
 * <TrendChart
 *   data={dsoData.map(p => ({ date: p.date, value: p.dso }))}
 *   yAxisFormat="days"
 *   targetValue={35}
 *   targetLabel="Target DSO"
 *   thresholds={{ good: 40, warning: 50 }}
 *   thresholdDirection="lower-is-better"
 *   showZones
 *   showTargetLine
 * />
 *
 * // Clean Claim Rate (higher is better)
 * <TrendChart
 *   data={rateData.map(p => ({ date: p.date, value: p.rate }))}
 *   yAxisFormat="percentage"
 *   targetValue={95}
 *   targetLabel="Target Rate"
 *   thresholds={{ good: 95, warning: 90 }}
 *   thresholdDirection="higher-is-better"
 *   showZones
 *   showTargetLine
 * />
 * ```
 */
export function TrendChart({
  data,
  yAxisFormat,
  thresholds,
  thresholdDirection = 'lower-is-better',
  targetValue,
  targetLabel,
  showZones = true,
  showTargetLine = true,
  showPoints = true,
  showArea = true,
  showTooltips = true,
  animate = true,
  height = DEFAULT_CHART_HEIGHT,
  width,
  title,
  yAxisLabel,
  onPointClick,
  ariaLabel,
  className,
  'data-testid': testId,
}: TrendChartProps): React.ReactElement {
  const { t } = useTranslation();
  const chartId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  // Hover state
  const [hoveredPoint, setHoveredPoint] = useState<TrendDataPoint | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number>(-1);
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition>({ x: 0, y: 0 });

  // Chart dimensions
  const chartWidth = width || DEFAULT_CHART_WIDTH;
  const innerWidth = chartWidth - CHART_PADDING.left - CHART_PADDING.right;
  const innerHeight = height - CHART_PADDING.top - CHART_PADDING.bottom;

  // Apply default thresholds if not provided but zones are shown
  const effectiveThresholds = thresholds || (showZones
    ? (thresholdDirection === 'lower-is-better' ? DEFAULT_THRESHOLDS_LOWER : DEFAULT_THRESHOLDS_HIGHER)
    : undefined);

  // Calculate scales
  const { xScale, yScale, minY, maxY } = useMemo(() => {
    return calculateScales(
      data,
      innerWidth,
      innerHeight,
      CHART_PADDING,
      targetValue,
      effectiveThresholds,
      yAxisFormat
    );
  }, [data, innerWidth, innerHeight, targetValue, effectiveThresholds, yAxisFormat]);

  // Generate Y-axis ticks
  const yTicks = useMemo(() => generateYTicks(minY, maxY), [minY, maxY]);

  // Generate line path
  const linePath = useMemo(() => generateLinePath(data, xScale, yScale), [data, xScale, yScale]);

  // Generate area path
  const areaPath = useMemo(
    () => generateAreaPath(data, xScale, yScale, CHART_PADDING, innerHeight, chartWidth),
    [data, xScale, yScale, innerHeight, chartWidth]
  );

  // Handle point hover
  const handlePointHover = (point: TrendDataPoint, index: number, event: React.MouseEvent) => {
    if (!showTooltips) return;

    setHoveredPoint(point);
    setHoveredIndex(index);
    setTooltipPos({
      x: event.clientX - (containerRef.current?.getBoundingClientRect().left || 0),
      y: event.clientY - (containerRef.current?.getBoundingClientRect().top || 0),
    });
  };

  // Handle point leave
  const handlePointLeave = () => {
    setHoveredPoint(null);
    setHoveredIndex(-1);
  };

  // Handle point click
  const handlePointClick = (point: TrendDataPoint, index: number) => {
    onPointClick?.(point, index);
  };

  // Handle keyboard navigation
  const handlePointKeyDown = (
    event: React.KeyboardEvent,
    point: TrendDataPoint,
    index: number
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handlePointClick(point, index);
    }
  };

  // Get point status for coloring
  const getPointStatus = (value: number): TrendStatus => {
    return getStatus(value, effectiveThresholds, thresholdDirection);
  };

  // Build accessible label
  const accessibleLabel = ariaLabel || t('common.trendChart.ariaLabel');

  // No data state
  if (!data || data.length === 0) {
    return (
      <Box
        className={`${styles.container} ${className || ''}`}
        data-testid={testId}
      >
        <Box className={styles.emptyState}>
          <Text c="dimmed" className={styles.emptyStateText}>
            {t('common.trendChart.noData')}
          </Text>
        </Box>
      </Box>
    );
  }

  // Render threshold zones
  const renderZones = () => {
    if (!showZones || !effectiveThresholds) return null;

    const { good, warning } = effectiveThresholds;

    if (thresholdDirection === 'lower-is-better') {
      // Lower is better: good at bottom, critical at top
      return (
        <g className={styles.zones}>
          {/* Good zone (below good threshold) */}
          <rect
            x={CHART_PADDING.left}
            y={yScale(good)}
            width={innerWidth}
            height={CHART_PADDING.top + innerHeight - yScale(good)}
            fill={ZONE_COLORS.good}
          />
          {/* Warning zone (between good and warning) */}
          {warning !== undefined && (
            <rect
              x={CHART_PADDING.left}
              y={yScale(warning)}
              width={innerWidth}
              height={yScale(good) - yScale(warning)}
              fill={ZONE_COLORS.warning}
            />
          )}
          {/* Critical zone (above warning) */}
          {warning !== undefined && (
            <rect
              x={CHART_PADDING.left}
              y={CHART_PADDING.top}
              width={innerWidth}
              height={yScale(warning) - CHART_PADDING.top}
              fill={ZONE_COLORS.critical}
            />
          )}
        </g>
      );
    } else {
      // Higher is better: good at top, critical at bottom
      return (
        <g className={styles.zones}>
          {/* Good zone (above good threshold) */}
          <rect
            x={CHART_PADDING.left}
            y={CHART_PADDING.top}
            width={innerWidth}
            height={yScale(good) - CHART_PADDING.top}
            fill={ZONE_COLORS.good}
          />
          {/* Warning zone (between warning and good) */}
          {warning !== undefined && (
            <rect
              x={CHART_PADDING.left}
              y={yScale(good)}
              width={innerWidth}
              height={yScale(warning) - yScale(good)}
              fill={ZONE_COLORS.warning}
            />
          )}
          {/* Critical zone (below warning) */}
          {warning !== undefined && (
            <rect
              x={CHART_PADDING.left}
              y={yScale(warning)}
              width={innerWidth}
              height={CHART_PADDING.top + innerHeight - yScale(warning)}
              fill={ZONE_COLORS.critical}
            />
          )}
        </g>
      );
    }
  };

  return (
    <Box
      ref={containerRef}
      className={`${styles.container} ${className || ''}`}
      style={{ width: width || '100%', height }}
      data-testid={testId}
    >
      {title && (
        <Text className={styles.title} size="sm" fw={600} mb="xs">
          {title}
        </Text>
      )}

      <Box className={styles.chartContainer}>
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${chartWidth} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={accessibleLabel}
          className={styles.chart}
        >
          <defs>
            {/* Gradient for area fill */}
            <linearGradient id={`${chartId}-area-gradient`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--emr-primary)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--emr-primary)" stopOpacity={0.05} />
            </linearGradient>
          </defs>

          {/* Threshold zones */}
          {renderZones()}

          {/* Grid lines */}
          <g className={styles.grid}>
            {yTicks.map((tick) => (
              <line
                key={tick}
                x1={CHART_PADDING.left}
                y1={yScale(tick)}
                x2={chartWidth - CHART_PADDING.right}
                y2={yScale(tick)}
                stroke="var(--emr-border-color)"
                strokeWidth={1}
                strokeDasharray="4 4"
                opacity={GRID_OPACITY}
              />
            ))}
          </g>

          {/* Target line */}
          {showTargetLine && targetValue !== undefined && (
            <g className={styles.targetLine}>
              <line
                x1={CHART_PADDING.left}
                y1={yScale(targetValue)}
                x2={chartWidth - CHART_PADDING.right}
                y2={yScale(targetValue)}
                stroke="var(--emr-info)"
                strokeWidth={TARGET_LINE_CONFIG.strokeWidth}
                strokeDasharray={TARGET_LINE_CONFIG.strokeDasharray}
              />
              <text
                x={chartWidth - CHART_PADDING.right + 5}
                y={yScale(targetValue) + 4}
                fill="var(--emr-info)"
                fontSize={11}
                fontWeight={500}
              >
                {targetLabel || t('common.target')}
              </text>
            </g>
          )}

          {/* Area fill under line */}
          {showArea && (
            <path
              d={areaPath}
              fill={`url(#${chartId}-area-gradient)`}
              className={styles.area}
            />
          )}

          {/* Main line */}
          <path
            d={linePath}
            fill="none"
            stroke="var(--emr-primary)"
            strokeWidth={LINE_CONFIG.strokeWidth}
            strokeLinecap={LINE_CONFIG.strokeLinecap}
            strokeLinejoin={LINE_CONFIG.strokeLinejoin}
            className={`${styles.line} ${animate ? styles.lineAnimated : ''}`}
            style={animate ? { '--line-length': data.length * 80 } as React.CSSProperties : undefined}
          />

          {/* Data points */}
          {showPoints && (
            <g className={styles.points}>
              {data.map((point, index) => {
                const x = xScale(index);
                const y = yScale(point.value);
                const status = getPointStatus(point.value);
                const isHovered = hoveredIndex === index;

                return (
                  <g key={`${point.date}-${index}`} className={styles.point}>
                    {/* Larger hit area for interaction */}
                    <circle
                      cx={x}
                      cy={y}
                      r={POINT_CONFIG.hitAreaRadius}
                      className={styles.pointHitArea}
                      onMouseEnter={(e) => handlePointHover(point, index, e)}
                      onMouseLeave={handlePointLeave}
                      onClick={() => handlePointClick(point, index)}
                      onKeyDown={(e) => handlePointKeyDown(e, point, index)}
                      tabIndex={onPointClick ? 0 : -1}
                      role={onPointClick ? 'button' : undefined}
                      aria-label={`${point.date}: ${point.value}`}
                    />
                    {/* Visible point */}
                    <circle
                      cx={x}
                      cy={y}
                      r={isHovered ? POINT_CONFIG.hoverRadius : POINT_CONFIG.radius}
                      fill={STATUS_COLORS[status]}
                      stroke="var(--emr-bg-card)"
                      strokeWidth={POINT_CONFIG.strokeWidth}
                      className={styles.pointCircle}
                      style={{ transition: 'r 0.15s ease' }}
                      pointerEvents="none"
                    />
                  </g>
                );
              })}
            </g>
          )}

          {/* Y-axis */}
          <g className={styles.yAxis}>
            {yTicks.map((tick) => (
              <text
                key={tick}
                x={CHART_PADDING.left - 10}
                y={yScale(tick) + 4}
                textAnchor="end"
                className={styles.axisLabel}
              >
                {formatYAxisTick(tick, yAxisFormat)}
              </text>
            ))}
            {/* Y-axis label */}
            {yAxisLabel && (
              <text
                x={15}
                y={CHART_PADDING.top + innerHeight / 2}
                textAnchor="middle"
                fill="var(--emr-text-secondary)"
                fontSize={11}
                transform={`rotate(-90, 15, ${CHART_PADDING.top + innerHeight / 2})`}
              >
                {yAxisLabel}
              </text>
            )}
          </g>

          {/* X-axis */}
          <g className={styles.xAxis}>
            {data.map((point, index) => {
              if (!shouldShowXLabel(index, data.length, MAX_X_LABELS)) return null;

              return (
                <text
                  key={point.date}
                  x={xScale(index)}
                  y={height - 15}
                  textAnchor="middle"
                  className={styles.axisLabel}
                >
                  {formatDateShort(point.date)}
                </text>
              );
            })}
          </g>
        </svg>
      </Box>

      {/* Tooltip */}
      {showTooltips && hoveredPoint && (
        <TrendChartTooltip
          point={hoveredPoint}
          position={tooltipPos}
          status={getPointStatus(hoveredPoint.value)}
          yAxisFormat={yAxisFormat}
          visible={hoveredPoint !== null}
        />
      )}

      {/* Legend */}
      {showZones && effectiveThresholds && (
        <Group className={styles.legend} gap="md" mt="xs" justify="center">
          {thresholdDirection === 'lower-is-better' ? (
            <>
              <Group gap={4} className={styles.legendItem}>
                <Box className={styles.legendDot} style={{ backgroundColor: STATUS_COLORS.good }} />
                <Text className={styles.legendText}>
                  {t('common.status.good')} (≤{effectiveThresholds.good})
                </Text>
              </Group>
              {effectiveThresholds.warning !== undefined && (
                <>
                  <Group gap={4} className={styles.legendItem}>
                    <Box className={styles.legendDot} style={{ backgroundColor: STATUS_COLORS.warning }} />
                    <Text className={styles.legendText}>
                      {t('common.status.warning')} ({effectiveThresholds.good}-{effectiveThresholds.warning})
                    </Text>
                  </Group>
                  <Group gap={4} className={styles.legendItem}>
                    <Box className={styles.legendDot} style={{ backgroundColor: STATUS_COLORS.critical }} />
                    <Text className={styles.legendText}>
                      {t('common.status.critical')} (&gt;{effectiveThresholds.warning})
                    </Text>
                  </Group>
                </>
              )}
            </>
          ) : (
            <>
              <Group gap={4} className={styles.legendItem}>
                <Box className={styles.legendDot} style={{ backgroundColor: STATUS_COLORS.good }} />
                <Text className={styles.legendText}>
                  {t('common.status.good')} (≥{effectiveThresholds.good})
                </Text>
              </Group>
              {effectiveThresholds.warning !== undefined && (
                <>
                  <Group gap={4} className={styles.legendItem}>
                    <Box className={styles.legendDot} style={{ backgroundColor: STATUS_COLORS.warning }} />
                    <Text className={styles.legendText}>
                      {t('common.status.warning')} ({effectiveThresholds.warning}-{effectiveThresholds.good - 1})
                    </Text>
                  </Group>
                  <Group gap={4} className={styles.legendItem}>
                    <Box className={styles.legendDot} style={{ backgroundColor: STATUS_COLORS.critical }} />
                    <Text className={styles.legendText}>
                      {t('common.status.critical')} (&lt;{effectiveThresholds.warning})
                    </Text>
                  </Group>
                </>
              )}
            </>
          )}
        </Group>
      )}
    </Box>
  );
}

export default TrendChart;
