// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Badge } from '@mantine/core';
import { memo, useMemo } from 'react';
import type { ReactNode } from 'react';

/**
 * EMRBadge variants for different use cases
 * - version: Filled gradient for version numbers (V1.0.0)
 * - neutral: Subtle outlined metadata pill — pairs visually with `version`
 * - status-active: Green for active/enabled states
 * - status-draft: Blue for draft/pending states
 * - status-archived: Gray for archived/disabled states
 * - info: Light blue for informational badges
 * - success: Green for success indicators
 * - warning: Orange for warning indicators
 * - error: Red for error indicators
 */
export type EMRBadgeVariant =
  | 'version'
  | 'neutral'
  | 'status-active'
  | 'status-draft'
  | 'status-archived'
  | 'info'
  | 'success'
  | 'warning'
  | 'error';

export interface EMRBadgeProps {
  /** Content to display in the badge */
  children: ReactNode;
  /** Visual variant determining colors */
  variant?: EMRBadgeVariant;
  /** Size of the badge */
  size?: 'xs' | 'sm' | 'md';
  /** Optional test ID for testing */
  'data-testid'?: string;
}

/**
 * Get styles for each badge variant using theme CSS variables
 */
const getVariantStyles = (variant: EMRBadgeVariant): React.CSSProperties => {
  switch (variant) {
    case 'version':
      return {
        background: 'var(--emr-gradient-primary)',
        color: 'var(--emr-text-inverse)',
        border: 'none',
        boxShadow: 'var(--emr-shadow-success)',
      };
    case 'neutral':
      return {
        backgroundColor: 'var(--emr-secondary-alpha-10)',
        color: 'var(--emr-secondary)',
        border: '1px solid var(--emr-border-secondary)',
      };
    case 'status-active':
      return {
        backgroundColor: 'var(--emr-success-alpha-10)',
        color: 'var(--emr-success)',
        border: '1px solid var(--emr-success-border)',
      };
    case 'status-draft':
      return {
        backgroundColor: 'var(--emr-light-accent)',
        color: 'var(--emr-secondary)',
        border: '1px solid var(--emr-accent)',
      };
    case 'status-archived':
      return {
        backgroundColor: 'var(--emr-bg-card)',
        color: 'var(--emr-text-secondary)',
        border: '1px solid var(--emr-border-color)',
      };
    case 'info':
      return {
        backgroundColor: 'var(--emr-secondary-alpha-10)',
        color: 'var(--emr-info)',
        border: '1px solid var(--emr-border-secondary)',
      };
    case 'success':
      return {
        backgroundColor: 'var(--emr-success-alpha-10)',
        color: 'var(--emr-success)',
        border: '1px solid var(--emr-success-border)',
      };
    case 'warning':
      return {
        backgroundColor: 'var(--emr-warning-bg)',
        color: 'var(--emr-warning)',
        border: '1px solid var(--emr-warning-border)',
      };
    case 'error':
      return {
        backgroundColor: 'var(--emr-error-alpha-10)',
        color: 'var(--emr-error)',
        border: '1px solid var(--emr-error-border)',
      };
    default:
      return {
        backgroundColor: 'var(--emr-bg-card)',
        color: 'var(--emr-text-secondary)',
        border: '1px solid var(--emr-border-color)',
      };
  }
};

/**
 * EMRBadge Component
 *
 * Standardized badge component using theme CSS variables.
 */
export const EMRBadge = memo(function EMRBadge({
  children,
  variant = 'info',
  size = 'sm',
  'data-testid': dataTestId,
}: EMRBadgeProps): React.ReactElement {
  const variantStyles = useMemo(() => getVariantStyles(variant), [variant]);

  return (
    <Badge
      variant="light"
      size={size}
      radius="sm"
      data-testid={dataTestId}
      style={{
        ...variantStyles,
        fontWeight: 'var(--emr-font-medium)',
        textTransform: 'none',
      }}
    >
      {children}
    </Badge>
  );
});

/**
 * Helper function to get EMRBadge variant from FHIR status
 */
export function getStatusBadgeVariant(status: string): EMRBadgeVariant {
  switch (status) {
    case 'active':
      return 'status-active';
    case 'draft':
      return 'status-draft';
    case 'retired':
      return 'status-archived';
    default:
      return 'info';
  }
}
