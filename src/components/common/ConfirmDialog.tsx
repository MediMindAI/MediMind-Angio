// SPDX-License-Identifier: Apache-2.0
/**
 * ConfirmDialog — reusable "are you sure?" modal.
 *
 * Thin wrapper around Mantine `<Modal>` that matches the EMR look-and-feel
 * (gradient primary button for the confirm, soft secondary for cancel).
 * Used for destructive-ish confirmations that do NOT warrant a full
 * `EMRModal` form shell — e.g. "Apply template?" or "Start new case?".
 */

import { Modal, Group, Stack, Text } from '@mantine/core';
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
  zIndex,
}: ConfirmDialogProps): React.ReactElement {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      size={420}
      zIndex={zIndex}
      withCloseButton={false}
      classNames={{
        content: classes.content,
        body: classes.body,
      }}
      overlayProps={{ backgroundOpacity: 0.55, blur: 2 }}
    >
      <Stack gap="sm">
        <Text className={classes.title}>{title}</Text>
        {typeof message === 'string' ? (
          <Text className={classes.message}>{message}</Text>
        ) : (
          <div className={classes.message}>{message}</div>
        )}
        <Group justify="flex-end" gap="xs" mt="xs">
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
