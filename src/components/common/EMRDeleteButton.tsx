// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { ActionIcon, Tooltip } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import classes from './EMRDeleteButton.module.css';

/** Size variants for the delete button */
export type EMRDeleteButtonSize = 'sm' | 'md' | 'lg';

/**
 * Props for EMRDeleteButton component
 */
export interface EMRDeleteButtonProps {
  /** Click handler */
  onClick: () => void;
  /** Disabled state */
  disabled?: boolean;
  /** Size variant: sm=28px, md=32px (default), lg=38px */
  size?: EMRDeleteButtonSize;
  /** Aria label for accessibility */
  ariaLabel?: string;
  /** Tooltip text (defaults to ariaLabel) */
  tooltip?: string;
  /** Test ID for testing */
  'data-testid'?: string;
}

/** Button sizes for each size variant */
const buttonSizes: Record<EMRDeleteButtonSize, number> = {
  sm: 28,
  md: 32,
  lg: 38,
};

/** Icon sizes for each size variant */
const iconSizes: Record<EMRDeleteButtonSize, number> = {
  sm: 14,
  md: 16,
  lg: 18,
};

/**
 * EMRDeleteButton - Standardized delete/trash button for tables and lists
 *
 * Features:
 * - Consistent red styling across all EMR pages
 * - Hover animation with scale effect
 * - Touch-friendly sizing
 * - Tooltip support
 * - Accessible with aria-label
 *
 * @param root0
 * @param root0.onClick
 * @param root0.disabled
 * @param root0.size
 * @param root0.ariaLabel
 * @param root0.tooltip
 * @param root0.'data-testid'
 * @example
 * ```tsx
 * // Basic usage in a table row
 * <EMRDeleteButton
 *   onClick={() => handleDelete(item.id)}
 *   ariaLabel={t('common.delete')}
 * />
 *
 * // With custom tooltip
 * <EMRDeleteButton
 *   onClick={handleDelete}
 *   ariaLabel="Delete patient"
 *   tooltip="Remove this patient record"
 * />
 *
 * // Disabled state
 * <EMRDeleteButton
 *   onClick={handleDelete}
 *   disabled={!canDelete}
 *   ariaLabel="Delete"
 * />
 * ```
 */
export function EMRDeleteButton({
  onClick,
  disabled = false,
  size = 'md',
  ariaLabel = 'Delete',
  tooltip,
  'data-testid': testId,
}: EMRDeleteButtonProps): React.ReactElement {
  const buttonSize = buttonSizes[size];
  const iconSize = iconSizes[size];
  const tooltipText = tooltip || ariaLabel;

  const button = (
    <ActionIcon
      variant="subtle"
      color="red"
      size={buttonSize}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      data-testid={testId}
      className={classes.deleteButton}
    >
      <IconTrash size={iconSize} stroke={2} />
    </ActionIcon>
  );

  if (tooltipText) {
    return (
      <Tooltip label={tooltipText} position="top" withArrow>
        {button}
      </Tooltip>
    );
  }

  return button;
}

export default EMRDeleteButton;
