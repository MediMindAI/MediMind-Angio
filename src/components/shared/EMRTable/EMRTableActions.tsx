// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import { ActionIcon, Menu, Tooltip, Loader } from '@mantine/core';
import { IconDots } from '@tabler/icons-react';
import type { EMRTableActions as ActionsConfig, EMRTableAction } from './EMRTableTypes';
import { useTranslation } from '../../../contexts/TranslationContext';
import styles from './EMRTable.module.css';

interface EMRTableActionsProps<T> {
  row: T;
  actions: ActionsConfig<T>;
}

export function EMRTableActions<T>({ row, actions }: EMRTableActionsProps<T>): React.ReactElement {
  const { t } = useTranslation();
  const { primary, secondary = [] } = actions;

  // Filter visible secondary actions
  const visibleSecondary = secondary.filter((action) => {
    if (typeof action.visible === 'function') {
      return action.visible(row);
    }
    return action.visible !== false;
  });

  // Index of the first destructive (red) action — used to insert a divider above it
  const firstDestructiveIndex = visibleSecondary.findIndex((a) => a.color === 'red');

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Primary Action - Always Visible */}
      {primary && <PrimaryActionButton row={row} action={primary} />}

      {/* Secondary Actions - Dropdown Menu */}
      {visibleSecondary.length > 0 && (
        <Menu position="bottom-end" withinPortal shadow="md" radius="md" offset={6}>
          <Menu.Target>
            <Tooltip label={t('common.moreActions')} position="top" withArrow>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                radius="sm"
                className={styles.moreActionsButton}
                aria-label={t('common.moreActions')}
              >
                <IconDots size={16} />
              </ActionIcon>
            </Tooltip>
          </Menu.Target>

          <Menu.Dropdown className={styles.actionsMenuDropdown}>
            {visibleSecondary.map((action, index) => (
              <React.Fragment key={`action-${action.label}`}>
                {/* Auto-insert a divider before the first destructive action
                    (unless it's already the first item) */}
                {index === firstDestructiveIndex && index > 0 && (
                  <hr className={styles.actionsMenuDivider} aria-hidden="true" />
                )}
                <SecondaryActionItem row={row} action={action} />
              </React.Fragment>
            ))}
          </Menu.Dropdown>
        </Menu>
      )}
    </div>
  );
}

/**
 * Primary action button (always visible)
 * @param root0
 * @param root0.row
 * @param root0.action
 */
function PrimaryActionButton<T>({
  row,
  action,
}: {
  row: T;
  action: EMRTableAction<T>;
}): React.ReactElement | null {
  const Icon = action.icon;
  const isDisabled =
    typeof action.disabled === 'function' ? action.disabled(row) : action.disabled;
  const isVisible =
    typeof action.visible === 'function' ? action.visible(row) : action.visible !== false;

  if (!isVisible) {return null;}

  const colorMap: Record<string, string> = {
    blue: 'var(--emr-secondary)',
    green: 'var(--emr-success)',
    red: 'var(--emr-error)',
    yellow: 'var(--emr-warning)',
    gray: 'var(--emr-bg-page)',
  };

  const hoverColorMap: Record<string, string> = {
    blue: 'var(--emr-bg-accent-secondary)',
    green: 'var(--emr-bg-accent-success)',
    red: 'var(--emr-bg-accent-error)',
    yellow: 'var(--emr-bg-accent-warning)',
    gray: 'var(--emr-bg-accent-gray)',
  };

  const color = action.color || 'blue';
  const iconColor = colorMap[color];
  const hoverBg = hoverColorMap[color];

  return (
    <Tooltip label={action.label} position="top" withArrow>
      <ActionIcon
        variant="subtle"
        size="sm"
        radius="sm"
        disabled={isDisabled}
        onClick={(e) => {
          e.stopPropagation();
          action.onClick(row);
        }}
        aria-label={action.label}
        className={styles.primaryActionButton}
        style={{
          color: isDisabled ? 'var(--emr-text-muted)' : iconColor,
          '--action-hover-bg': hoverBg,
        } as React.CSSProperties}
      >
        {action.loading ? <Loader size={14} /> : <Icon size={16} style={{ strokeWidth: 1.5 }} />}
      </ActionIcon>
    </Tooltip>
  );
}

/**
 * Secondary action menu item
 * @param root0
 * @param root0.row
 * @param root0.action
 */
function SecondaryActionItem<T>({
  row,
  action,
}: {
  row: T;
  action: EMRTableAction<T>;
}): React.ReactElement {
  const Icon = action.icon;
  const isDisabled =
    typeof action.disabled === 'function' ? action.disabled(row) : action.disabled;
  const isDestructive = action.color === 'red';

  const itemClassName = isDestructive
    ? `${styles.actionsMenuItem} ${styles.actionsMenuItemDestructive}`
    : styles.actionsMenuItem;

  return (
    <Menu.Item
      className={itemClassName}
      leftSection={
        action.loading ? (
          <Loader size={16} />
        ) : (
          <Icon size={16} style={{ strokeWidth: 1.75 }} />
        )
      }
      disabled={isDisabled}
      onClick={(e) => {
        e.stopPropagation();
        action.onClick(row);
      }}
    >
      {action.label}
    </Menu.Item>
  );
}

export default EMRTableActions;
