// SPDX-License-Identifier: Apache-2.0
/**
 * ConfirmDialog — reusable "are you sure?" modal.
 *
 * Small confirmation modal with an icon chip, title, message and two actions.
 * Matches the EMR look-and-feel: gradient primary or soft-red destructive
 * confirm button, ghost cancel. Used for "Apply template?", "Start new case?"
 * and "Delete template?" flows.
 */

import { Modal, Group, Stack, Text } from '@mantine/core';
import type { Icon } from '@tabler/icons-react';
import { IconAlertTriangle, IconHelpCircle } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { EMRButton } from './EMRButton';
import classes from './ConfirmDialog.module.css';

export interface ConfirmDialogProps {
  readonly opened: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly message: ReactNode;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly onConfirm: () => void;
  readonly loading?: boolean;
  /** Style the confirm button as destructive (red) instead of primary blue. */
  readonly destructive?: boolean;
  /**
   * Optional leading icon shown in the circular chip. Defaults to
   * `IconAlertTriangle` for destructive and `IconHelpCircle` otherwise.
   */
  readonly icon?: Icon;
  /** Optional explicit z-index override (for nested modals). */
  readonly zIndex?: number;
}

export function ConfirmDialog({
  opened,
  onClose,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  loading = false,
  destructive = false,
  icon,
  zIndex,
}: ConfirmDialogProps): React.ReactElement {
  const IconComp = icon ?? (destructive ? IconAlertTriangle : IconHelpCircle);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      size={460}
      zIndex={zIndex}
      withCloseButton={false}
      classNames={{
        content: classes.content,
        body: classes.body,
      }}
      overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
    >
      <Stack gap="md">
        <Group gap="md" align="flex-start" wrap="nowrap">
          <div
            className={`${classes.iconChip} ${destructive ? classes.iconChipDanger : classes.iconChipInfo}`}
            aria-hidden
          >
            <IconComp size={22} stroke={1.75} />
          </div>
          <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
            <Text className={classes.title}>{title}</Text>
            {typeof message === 'string' ? (
              <Text className={classes.message}>{message}</Text>
            ) : (
              <div className={classes.message}>{message}</div>
            )}
          </Stack>
        </Group>
        <Group justify="flex-end" gap="xs" className={classes.actions}>
          <EMRButton variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </EMRButton>
          <EMRButton
            variant={destructive ? 'danger' : 'primary'}
            size="sm"
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </EMRButton>
        </Group>
      </Stack>
    </Modal>
  );
}

export default ConfirmDialog;
