// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Button, Loader } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import type { ComponentType, ReactNode } from 'react';

/** Icon props type for Tabler icons */
interface IconProps {
  size?: number | string;
  stroke?: number;
}

/** Size variants for the button */
export type EMRAddButtonSize = 'sm' | 'md' | 'lg';

/** Visual variants for the button */
export type EMRAddButtonVariant = 'primary' | 'secondary';

/**
 * Props for EMRAddButton component
 */
export interface EMRAddButtonProps {
  /** Button label text */
  children: ReactNode;
  /** Click handler */
  onClick?: () => void;
  /** Loading state - shows spinner instead of icon */
  loading?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Full width button */
  fullWidth?: boolean;
  /** Size variant: sm=38px, md=44px (default), lg=50px */
  size?: EMRAddButtonSize;
  /** Visual variant: primary (dark gradient), secondary (lighter gradient) */
  variant?: EMRAddButtonVariant;
  /** Custom icon component (default: IconPlus) */
  icon?: ComponentType<IconProps>;
  /** Button type for forms */
  type?: 'button' | 'submit';
  /** Test ID for testing */
  'data-testid'?: string;
}

/** Height values for each size */
const heights: Record<EMRAddButtonSize, number> = {
  sm: 38,
  md: 44,
  lg: 50,
};

/** Icon sizes for each button size */
const iconSizes: Record<EMRAddButtonSize, number> = {
  sm: 16,
  md: 18,
  lg: 20,
};

/** Gradient backgrounds for each variant */
const gradients: Record<EMRAddButtonVariant, string> = {
  primary: 'var(--emr-gradient-add-button)',
  secondary: 'var(--emr-gradient-add-button)',
};

/**
 * EMRAddButton - Standardized add/create button for the EMR application
 *
 * Features:
 * - Gradient blue background with professional medical aesthetic
 * - Lift-up hover animation with enhanced shadow
 * - Loading state with spinner
 * - Touch-friendly 44px default height
 * - Consistent styling across all EMR pages
 *
 * @param root0
 * @param root0.children
 * @param root0.onClick
 * @param root0.loading
 * @param root0.disabled
 * @param root0.fullWidth
 * @param root0.size
 * @param root0.variant
 * @param root0.icon
 * @param root0.type
 * @param root0.'data-testid'
 * @example
 * ```tsx
 * // Basic usage
 * <EMRAddButton onClick={handleAdd}>
 *   დამატება
 * </EMRAddButton>
 *
 * // Full width with loading
 * <EMRAddButton
 *   onClick={handleSubmit}
 *   loading={isSubmitting}
 *   fullWidth
 * >
 *   დეპარტამენტის დამატება
 * </EMRAddButton>
 *
 * // Secondary variant (lighter gradient)
 * <EMRAddButton variant="secondary">
 *   Add New
 * </EMRAddButton>
 * ```
 */
export function EMRAddButton({
  children,
  onClick,
  loading = false,
  disabled = false,
  fullWidth = false,
  size = 'md',
  variant = 'primary',
  icon: Icon = IconPlus,
  type = 'button',
  'data-testid': testId,
}: EMRAddButtonProps): React.ReactElement {
  const height = heights[size];
  const iconSize = iconSizes[size];
  const gradient = gradients[variant];

  return (
    <Button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      fullWidth={fullWidth}
      data-testid={testId}
      leftSection={
        loading ? (
          <Loader size={iconSize} color="white" />
        ) : (
          <Icon size={iconSize} stroke={2.5} />
        )
      }
      styles={{
        root: {
          height,
          padding: '0 20px',
          borderRadius: '10px',
          background: gradient,
          border: 'none',
          color: 'white',
          fontWeight: 'var(--emr-font-semibold)',
          fontSize: 'var(--emr-font-base)',
          letterSpacing: '0.01em',
          boxShadow: 'var(--emr-shadow-add-button)',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',

          '&:hover:not(:disabled)': {
            transform: 'translateY(-2px)',
            boxShadow: 'var(--emr-shadow-add-button-hover)',
            filter: 'brightness(1.05)',
          },

          '&:active:not(:disabled)': {
            transform: 'translateY(0)',
            boxShadow: 'var(--emr-shadow-sm)',
          },

          '&:disabled': {
            opacity: 0.5,
            cursor: 'not-allowed',
            transform: 'none',
            background: gradient,
          },
        },
      }}
    >
      {children}
    </Button>
  );
}

export default EMRAddButton;
