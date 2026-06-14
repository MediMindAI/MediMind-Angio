// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Box, SimpleGrid } from '@mantine/core';
import type { ReactNode } from 'react';

export type EMRStatCardGridGap = 'xs' | 'sm' | 'md' | 'lg';

/** Visual variant for the grid container */
export type EMRStatCardGridVariant = 'default' | 'contained' | 'elevated';

type EMRStatCardGridBreakpoint = 'base' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type EMRStatCardGridColumns = number | 'auto' | Partial<Record<EMRStatCardGridBreakpoint, number>>;

export interface EMRStatCardGridProps {
  /** Stat card children */
  children: ReactNode;
  /** Number of columns, responsive columns, or 'auto' for auto-fill */
  columns?: EMRStatCardGridColumns;
  /** Gap between cards */
  gap?: EMRStatCardGridGap;
  /** Visual variant: default (no container), contained (subtle background), elevated (with shadow) */
  variant?: EMRStatCardGridVariant;
  /** Test ID for testing */
  'data-testid'?: string;
}

const gapMap: Record<EMRStatCardGridGap, number> = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 20,
};

/**
 * Get container styles based on variant
 * @param variant
 */
const getContainerStyles = (variant: EMRStatCardGridVariant): React.CSSProperties => {
  switch (variant) {
    case 'contained':
      return {
        padding: '16px',
        borderRadius: '14px',
        background: 'linear-gradient(135deg, color-mix(in srgb, var(--emr-accent) 3%, transparent) 0%, color-mix(in srgb, var(--emr-accent) 1%, transparent) 100%)',
        border: '1px solid color-mix(in srgb, var(--emr-accent) 8%, transparent)',
      };
    case 'elevated':
      return {
        padding: '16px',
        borderRadius: '14px',
        background: 'linear-gradient(135deg, var(--emr-bg-card) 0%, color-mix(in srgb, var(--emr-accent) 2%, transparent) 100%)',
        border: '1px solid color-mix(in srgb, var(--emr-accent) 12%, transparent)',
        boxShadow: 'var(--emr-shadow-sm)',
      };
    default:
      return {};
  }
};

const isResponsiveColumns = (
  columns: number | Partial<Record<EMRStatCardGridBreakpoint, number>>
): columns is Partial<Record<EMRStatCardGridBreakpoint, number>> =>
  typeof columns === 'object' && columns !== null;

const getFixedColumns = (
  columns: number | Partial<Record<EMRStatCardGridBreakpoint, number>>
): Partial<Record<EMRStatCardGridBreakpoint, number>> =>
  isResponsiveColumns(columns)
    ? columns
    : { base: 2, xs: Math.min(columns, 2), sm: Math.min(columns, 3), md: Math.min(columns, 4), lg: columns };

/**
 * EMRStatCardGrid - Container for arranging stat cards in a responsive grid
 *
 * Features:
 * - Responsive column layout
 * - Optional container styling (contained, elevated)
 * - Consistent gap spacing
 *
 * @param root0
 * @param root0.children
 * @param root0.columns
 * @param root0.gap
 * @param root0.variant
 * @param root0.'data-testid'
 * @example
 * // Fixed 6 columns
 * <EMRStatCardGrid columns={6} gap="sm">
 *   <EMRStatCard icon={IconUsers} value={100} label="Patients" />
 *   <EMRStatCard icon={IconBed} value={50} label="Beds" />
 * </EMRStatCardGrid>
 *
 * @example
 * // Auto-fill responsive columns with elevated container
 * <EMRStatCardGrid columns="auto" gap="md" variant="elevated">
 *   {stats.map(stat => <EMRStatCard key={stat.id} {...stat} />)}
 * </EMRStatCardGrid>
 */
export function EMRStatCardGrid({
  children,
  columns = 'auto',
  gap = 'sm',
  variant = 'default',
  'data-testid': dataTestId = 'emr-stat-card-grid',
}: EMRStatCardGridProps): React.JSX.Element {
  const gapValue = gapMap[gap];
  const containerStyles = getContainerStyles(variant);
  const hasContainer = variant !== 'default';

  const gridElement =
    columns === 'auto' ? (
      <SimpleGrid
        cols={{ base: 2, xs: 2, sm: 3, md: 4, lg: 6 }}
        spacing={gapValue}
        data-testid={hasContainer ? undefined : dataTestId}
      >
        {children}
      </SimpleGrid>
    ) : (
      <SimpleGrid
        cols={getFixedColumns(columns)}
        spacing={gapValue}
        data-testid={hasContainer ? undefined : dataTestId}
      >
        {children}
      </SimpleGrid>
    );

  if (hasContainer) {
    return (
      <Box style={containerStyles} data-testid={dataTestId} data-variant={variant}>
        {gridElement}
      </Box>
    );
  }

  return gridElement;
}

export default EMRStatCardGrid;
