// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Box } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import type { ReactNode } from 'react';

export interface EMRTabHeaderGroupProps {
  /** EMRTabHeader children */
  children: ReactNode;
  /** Gap between tabs */
  gap?: 'xs' | 'sm' | 'md' | 'lg';
  /** Whether tabs should grow to fill space */
  grow?: boolean;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * EMRTabHeaderGroup - Container for EMRTabHeader components
 *
 * Features:
 * - Horizontal layout with consistent spacing
 * - Responsive: stacks on mobile
 * - Optional grow behavior
 *
 * @param root0
 * @param root0.children
 * @param root0.gap
 * @param root0.grow
 * @param root0.'data-testid'
 * @example
 * ```tsx
 * <EMRTabHeaderGroup gap="md">
 *   <EMRTabHeader icon={IconUsers} title="Users" count={10} active />
 *   <EMRTabHeader icon={IconSettings} title="Settings" count={5} />
 * </EMRTabHeaderGroup>
 * ```
 */
export function EMRTabHeaderGroup({
  children,
  gap = 'md',
  grow: _grow = true,
  'data-testid': dataTestId = 'emr-tab-header-group',
}: EMRTabHeaderGroupProps): React.ReactElement {
  const isMobile = useMediaQuery('(max-width: 768px)') ?? false;

  // Map gap prop to spacing value
  const gapMap: Record<'xs' | 'sm' | 'md' | 'lg', string> = {
    xs: 'var(--emr-spacing-xs)',
    sm: 'var(--emr-spacing-sm)',
    md: 'var(--emr-spacing-md)',
    lg: 'var(--emr-spacing-lg)',
  };

  // Mobile: 2-column grid so labels are fully readable
  if (isMobile) {
    return (
      <Box
        data-testid={dataTestId}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: gapMap[gap],
          marginBottom: 'var(--emr-spacing-lg)',
        }}
      >
        {children}
      </Box>
    );
  }

  // Desktop: equal-width grid columns
  return (
    <Box
      data-testid={dataTestId}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: gapMap[gap],
        marginBottom: 'var(--emr-spacing-lg)',
      }}
    >
      {children}
    </Box>
  );
}
