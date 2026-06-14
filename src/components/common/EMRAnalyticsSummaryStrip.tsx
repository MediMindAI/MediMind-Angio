// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * EMRAnalyticsSummaryStrip - Unified analytics KPI banner
 *
 * A single horizontal strip containing multiple metrics with sparklines,
 * trend badges, and primary/secondary emphasis. Designed to replace
 * disconnected EMRStatCard grids with a cohesive analytics dashboard feel.
 */

import { Skeleton } from '@mantine/core';
import { IconTrendingUp, IconTrendingDown, IconMinus } from '@tabler/icons-react';
import { memo, useMemo } from 'react';
import type { ComponentType } from 'react';
import classes from './EMRAnalyticsSummaryStrip.module.css';

/** Icon props type for Tabler icons */
interface IconProps {
  size?: number | string;
  stroke?: number;
  color?: string;
}

export type AnalyticsSummaryVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';

export interface AnalyticsSummaryItem {
  icon: ComponentType<IconProps>;
  value: string | number;
  label: string;
  variant?: AnalyticsSummaryVariant;
  trend?: { value: string; direction: 'up' | 'down' | 'neutral' };
  subtitle?: string;
  sparklineData?: number[];
  /** Whether this is a "primary" metric (larger) or "secondary" (smaller). Default: 'secondary' */
  emphasis?: 'primary' | 'secondary';
}

export interface EMRAnalyticsSummaryStripProps {
  items: AnalyticsSummaryItem[];
  loading?: boolean;
  'data-testid'?: string;
}

/** Maps variant to icon CSS class */
const variantIconClass: Record<AnalyticsSummaryVariant, string | undefined> = {
  primary: classes.iconPrimary,
  secondary: classes.iconSecondary,
  success: classes.iconSuccess,
  warning: classes.iconWarning,
  error: classes.iconError,
  info: classes.iconInfo,
};

/** Sparkline stroke colors keyed by variant */
const sparklineStrokeMap: Record<AnalyticsSummaryVariant, string> = {
  primary: 'var(--emr-sparkline-stroke-primary, var(--emr-secondary))',
  secondary: 'var(--emr-sparkline-stroke-secondary, var(--emr-text-secondary))',
  success: 'var(--emr-sparkline-stroke-success, var(--emr-success))',
  warning: 'var(--emr-sparkline-stroke-warning, var(--emr-warning))',
  error: 'var(--emr-sparkline-stroke-error, var(--emr-error))',
  info: 'var(--emr-sparkline-stroke-info, var(--emr-info))',
};

/** Sparkline fill colors keyed by variant */
const sparklineFillMap: Record<AnalyticsSummaryVariant, string> = {
  primary: 'var(--emr-sparkline-fill-primary, var(--emr-secondary-alpha-15))',
  secondary: 'var(--emr-sparkline-fill-secondary, var(--emr-gray-alpha-08))',
  success: 'var(--emr-sparkline-fill-success, var(--emr-success-alpha-15))',
  warning: 'var(--emr-sparkline-fill-warning, var(--emr-warning-alpha-15))',
  error: 'var(--emr-sparkline-fill-error, var(--emr-error-alpha-15))',
  info: 'var(--emr-sparkline-fill-info, var(--emr-info-alpha-15))',
};

/** Trend direction to CSS class */
const trendClassMap: Record<string, string | undefined> = {
  up: classes.trendUp,
  down: classes.trendDown,
  neutral: classes.trendNeutral,
};

/** Compact inline sparkline */
function MiniSparkline({ data, strokeColor, fillColor }: {
  data: number[];
  strokeColor: string;
  fillColor: string;
}): React.ReactElement | null {
  if (data.length < 2) {
    return null;
  }

  const width = 100;
  const height = 24;
  const pad = 1;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * w,
    y: pad + h - ((v - min) / range) * h,
  }));

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
  const lastPoint = points[points.length - 1];
  if (!lastPoint) {
    return null;
  }
  const area = `${line} L ${lastPoint.x},${height - pad} L ${pad},${height - pad} Z`;

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <path d={area} fill={fillColor} />
      <path d={line} fill="none" stroke={strokeColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Single metric cell within the strip */
const MetricCell = memo(function MetricCell({ item }: { item: AnalyticsSummaryItem }): React.ReactElement {
  const variant = item.variant ?? 'primary';
  const emphasis = item.emphasis ?? 'secondary';
  const isPrimary = emphasis === 'primary';

  const formattedValue = typeof item.value === 'number' ? item.value.toLocaleString() : item.value;

  const TrendIcon = item.trend
    ? item.trend.direction === 'up' ? IconTrendingUp
    : item.trend.direction === 'down' ? IconTrendingDown
    : IconMinus
    : null;

  return (
    <div className={`${classes.cell} ${isPrimary ? classes.cellPrimary : classes.cellSecondary}`}>
      {/* Header: icon + label */}
      <div className={classes.cellHeader}>
        <div className={`${classes.iconWrap} ${variantIconClass[variant]}`}>
          <item.icon size={15} />
        </div>
        <span className={classes.label}>{item.label}</span>
      </div>

      {/* Value + trend */}
      <div className={classes.valueRow}>
        <span className={isPrimary ? classes.valuePrimary : classes.valueSecondary}>
          {formattedValue}
        </span>
        {item.trend && TrendIcon && (
          <span className={`${classes.trend} ${trendClassMap[item.trend.direction]}`}>
            <TrendIcon size={13} />
            {item.trend.value}
          </span>
        )}
      </div>

      {/* Subtitle */}
      {item.subtitle && (
        <span className={classes.subtitle}>{item.subtitle}</span>
      )}

      {/* Sparkline */}
      {item.sparklineData && item.sparklineData.length >= 2 && (
        <div className={classes.sparkline}>
          <MiniSparkline
            data={item.sparklineData}
            strokeColor={sparklineStrokeMap[variant]}
            fillColor={sparklineFillMap[variant]}
          />
        </div>
      )}
    </div>
  );
});

/** Loading skeleton for the strip */
function StripSkeleton({ count }: { count: number }): React.ReactElement {
  return (
    <div className={classes.skeletonStrip}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={classes.skeletonCell}>
          <Skeleton height={16} width={100} radius="sm" />
          <Skeleton height={28} width={60} radius="sm" />
          <Skeleton height={12} width={80} radius="sm" />
        </div>
      ))}
    </div>
  );
}

export const EMRAnalyticsSummaryStrip = memo(function EMRAnalyticsSummaryStrip({
  items,
  loading = false,
  'data-testid': dataTestId = 'emr-analytics-summary-strip',
}: EMRAnalyticsSummaryStripProps): React.ReactElement {
  // Memoize items to avoid unnecessary re-renders of cells
  const cells = useMemo(() => items, [items]);

  if (loading) {
    return <StripSkeleton count={items.length || 5} />;
  }

  return (
    <div className={classes.strip} data-testid={dataTestId} role="region" aria-label="Analytics summary">
      {cells.map((item) => (
        <MetricCell key={item.label} item={item} />
      ))}
    </div>
  );
});
