// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { ActionIcon, Group, Loader, Menu, Tooltip } from '@mantine/core';
import { IconDotsVertical } from '@tabler/icons-react';
import type { ComponentType } from 'react';
import { useTranslation } from '../../contexts/TranslationContext';

/** Icon props type for Tabler icons */
interface IconProps {
  size?: number | string;
  stroke?: number;
}

/** Color options for action buttons */
export type EMRActionButtonColor = 'blue' | 'red' | 'green' | 'gray' | 'yellow';

/** Size variants for action buttons */
export type EMRActionButtonSize = 'sm' | 'md';

/** Single action definition */
export interface EMRAction<T> {
  /** Icon component to display */
  icon: ComponentType<IconProps>;
  /** Tooltip label text */
  label: string;
  /** Click handler - receives the row data */
  onClick: (row: T) => void;
  /** Button color (default: gray) */
  color?: EMRActionButtonColor;
  /** Disabled state - can be boolean or function */
  disabled?: boolean | ((row: T) => boolean);
  /** Loading state */
  loading?: boolean;
  /** Visibility - can be boolean or function */
  visible?: boolean | ((row: T) => boolean);
}

/**
 * Props for EMRActionButtons component
 */
export interface EMRActionButtonsProps<T> {
  /** The row data to pass to action handlers */
  row: T;
  /** Array of action definitions */
  actions: EMRAction<T>[];
  /** Size variant: sm=28px, md=32px (default) */
  size?: EMRActionButtonSize;
  /** How to display actions: horizontal (default) or dropdown */
  orientation?: 'horizontal' | 'dropdown';
  /** Maximum visible actions before overflow to dropdown (default: 3) */
  maxVisible?: number;
  /** Test ID for testing */
  'data-testid'?: string;
}

/** Icon sizes for each size variant */
const iconSizes: Record<EMRActionButtonSize, number> = {
  sm: 16,
  md: 18,
};

/** Button sizes for each size variant */
const buttonSizes: Record<EMRActionButtonSize, number> = {
  sm: 28,
  md: 32,
};

/** Map color names to CSS variables */
const colorMap: Record<EMRActionButtonColor, string> = {
  blue: 'var(--emr-secondary)',
  red: 'var(--emr-error)',
  green: 'var(--emr-success)',
  gray: 'var(--emr-text-secondary)',
  yellow: 'var(--emr-warning)',
};

/**
 * Get the actual disabled value
 * @param disabled
 * @param row
 */
function getDisabled<T>(disabled: boolean | ((row: T) => boolean) | undefined, row: T): boolean {
  if (typeof disabled === 'function') {
    return disabled(row);
  }
  return disabled ?? false;
}

/**
 * Get the actual visible value
 * @param visible
 * @param row
 */
function getVisible<T>(visible: boolean | ((row: T) => boolean) | undefined, row: T): boolean {
  if (typeof visible === 'function') {
    return visible(row);
  }
  return visible ?? true;
}

/**
 * EMRActionButtons - Standardized action buttons for table rows
 *
 * Features:
 * - Tooltips on hover for accessibility
 * - Consistent icon sizing and spacing
 * - Support for horizontal or dropdown layout
 * - Loading state per action
 * - Conditional visibility and disabled states
 * - Automatic overflow to dropdown menu
 *
 * @param root0
 * @param root0.row
 * @param root0.actions
 * @param root0.size
 * @param root0.orientation
 * @param root0.maxVisible
 * @param root0.'data-testid'
 * @example
 * ```tsx
 * // Basic usage with edit and delete
 * <EMRActionButtons
 *   row={patient}
 *   actions={[
 *     {
 *       icon: IconEdit,
 *       label: 'Edit',
 *       onClick: (row) => handleEdit(row),
 *       color: 'blue',
 *     },
 *     {
 *       icon: IconTrash,
 *       label: 'Delete',
 *       onClick: (row) => handleDelete(row),
 *       color: 'red',
 *     },
 *   ]}
 * />
 *
 * // With conditional visibility
 * <EMRActionButtons
 *   row={item}
 *   actions={[
 *     {
 *       icon: IconEdit,
 *       label: 'Edit',
 *       onClick: handleEdit,
 *       visible: (row) => row.canEdit,
 *     },
 *     {
 *       icon: IconTrash,
 *       label: 'Delete',
 *       onClick: handleDelete,
 *       disabled: (row) => row.isLocked,
 *       color: 'red',
 *     },
 *   ]}
 * />
 *
 * // Dropdown orientation for many actions
 * <EMRActionButtons
 *   row={item}
 *   orientation="dropdown"
 *   actions={[...manyActions]}
 * />
 * ```
 */
export function EMRActionButtons<T>({
  row,
  actions,
  size = 'md',
  orientation = 'horizontal',
  maxVisible = 3,
  'data-testid': testId,
}: EMRActionButtonsProps<T>): React.ReactElement {
  const { t } = useTranslation();
  const iconSize = iconSizes[size];
  const buttonSize = buttonSizes[size];
  const moreActionsLabel = t('common.moreActions');

  // Filter visible actions
  const visibleActions = actions.filter((action) => getVisible(action.visible, row));

  // If dropdown orientation, show all in dropdown
  if (orientation === 'dropdown') {
    return (
      <Menu shadow="md" width={200} position="bottom-end">
        <Menu.Target>
          <ActionIcon
            variant="subtle"
            color="gray"
            size={buttonSize}
            data-testid={testId}
            aria-label={moreActionsLabel}
            style={{
              borderRadius: 'var(--emr-border-radius-sm)',
            }}
          >
            <IconDotsVertical size={iconSize} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          {visibleActions.map((action, index) => {
            const Icon = action.icon;
            const isDisabled = getDisabled(action.disabled, row);
            const color = action.color || 'gray';

            return (
              <Menu.Item
                key={index}
                leftSection={
                  action.loading ? (
                    <Loader size={iconSize} />
                  ) : (
                    <Icon size={iconSize} stroke={2} />
                  )
                }
                onClick={() => action.onClick(row)}
                disabled={isDisabled || action.loading}
                color={color === 'red' ? 'red' : undefined}
              >
                {action.label}
              </Menu.Item>
            );
          })}
        </Menu.Dropdown>
      </Menu>
    );
  }

  // Horizontal orientation - split into visible and overflow
  const inlineActions = visibleActions.slice(0, maxVisible);
  const overflowActions = visibleActions.slice(maxVisible);

  return (
    <Group gap="xs" wrap="nowrap" data-testid={testId}>
      {/* Inline action buttons */}
      {inlineActions.map((action, index) => {
        const Icon = action.icon;
        const isDisabled = getDisabled(action.disabled, row);
        const color = colorMap[action.color || 'gray'];

        return (
          <Tooltip
            key={index}
            label={action.label}
            withArrow
            position="top"
          >
            <ActionIcon
              variant="subtle"
              size={buttonSize}
              onClick={() => action.onClick(row)}
              disabled={isDisabled || action.loading}
              aria-label={action.label}
              style={{
                color: isDisabled ? 'var(--emr-text-secondary)' : color,
                borderRadius: 'var(--emr-border-radius-sm)',
                transition: 'var(--emr-transition-fast)',
                opacity: isDisabled ? 0.5 : 1,
                '&:hover': {
                  background: 'var(--emr-bg-hover)',
                },
              }}
            >
              {action.loading ? (
                <Loader size={iconSize} />
              ) : (
                <Icon size={iconSize} stroke={2} />
              )}
            </ActionIcon>
          </Tooltip>
        );
      })}

      {/* Overflow dropdown */}
      {overflowActions.length > 0 && (
        <Menu shadow="md" width={200} position="bottom-end">
          <Menu.Target>
            <Tooltip label={moreActionsLabel} withArrow position="top">
              <ActionIcon
                variant="subtle"
                color="gray"
                size={buttonSize}
                aria-label={moreActionsLabel}
                style={{
                  borderRadius: 'var(--emr-border-radius-sm)',
                }}
              >
                <IconDotsVertical size={iconSize} />
              </ActionIcon>
            </Tooltip>
          </Menu.Target>
          <Menu.Dropdown>
            {overflowActions.map((action, index) => {
              const Icon = action.icon;
              const isDisabled = getDisabled(action.disabled, row);
              const color = action.color || 'gray';

              return (
                <Menu.Item
                  key={index}
                  leftSection={
                    action.loading ? (
                      <Loader size={iconSize} />
                    ) : (
                      <Icon size={iconSize} stroke={2} />
                    )
                  }
                  onClick={() => action.onClick(row)}
                  disabled={isDisabled || action.loading}
                  color={color === 'red' ? 'red' : undefined}
                >
                  {action.label}
                </Menu.Item>
              );
            })}
          </Menu.Dropdown>
        </Menu>
      )}
    </Group>
  );
}

export default EMRActionButtons;
