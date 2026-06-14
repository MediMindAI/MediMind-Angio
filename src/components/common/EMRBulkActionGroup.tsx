// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { ActionIcon, Divider, Group, Text, Tooltip } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';
import { Fragment } from 'react';

/**
 * Single action group configuration
 */
export interface EMRBulkActionGroupItem {
  /** Label displayed before the action buttons */
  label: string;
  /** Callback when select all is clicked */
  onSelectAll: () => void;
  /** Callback when deselect all is clicked */
  onDeselectAll: () => void;
}

/**
 * Props for EMRBulkActionGroup component
 */
export interface EMRBulkActionGroupProps {
  /** Array of action groups to render */
  groups: EMRBulkActionGroupItem[];
  /** Tooltip text for select all button (default: 'Select all') */
  selectAllTooltip?: string;
  /** Tooltip text for deselect all button (default: 'Deselect all') */
  deselectAllTooltip?: string;
}

/**
 * EMRBulkActionGroup - Reusable bulk select/deselect action buttons
 *
 * Displays grouped action buttons for bulk selection operations.
 * Each group has a label followed by green (select all) and red (deselect all) buttons.
 * Multiple groups are separated by vertical dividers.
 *
 * @param root0
 * @param root0.groups
 * @param root0.selectAllTooltip
 * @param root0.deselectAllTooltip
 * @example
 * ```tsx
 * <EMRBulkActionGroup
 *   groups={[
 *     {
 *       label: 'Include',
 *       onSelectAll: () => handleSelectAll('include'),
 *       onDeselectAll: () => handleDeselectAll('include'),
 *     },
 *     {
 *       label: 'Result',
 *       onSelectAll: () => handleSelectAll('result'),
 *       onDeselectAll: () => handleDeselectAll('result'),
 *     },
 *   ]}
 *   selectAllTooltip="Select all items"
 *   deselectAllTooltip="Deselect all items"
 * />
 * ```
 */
export function EMRBulkActionGroup({
  groups,
  selectAllTooltip = 'Select all',
  deselectAllTooltip = 'Deselect all',
}: EMRBulkActionGroupProps): React.ReactElement {
  return (
    <Group gap="xs">
      {groups.map((group, index) => (
        <Fragment key={group.label}>
          {index > 0 && <Divider orientation="vertical" />}
          <Group gap={4}>
            <Text size="xs" c="dimmed">
              {group.label}:
            </Text>
            <Tooltip label={selectAllTooltip}>
              <ActionIcon
                variant="light"
                color="green"
                size="sm"
                onClick={group.onSelectAll}
                aria-label={selectAllTooltip}
              >
                <IconCheck size={14} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={deselectAllTooltip}>
              <ActionIcon
                variant="light"
                color="red"
                size="sm"
                onClick={group.onDeselectAll}
                aria-label={deselectAllTooltip}
              >
                <IconX size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Fragment>
      ))}
    </Group>
  );
}

export default EMRBulkActionGroup;
