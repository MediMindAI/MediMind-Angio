// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import { Box, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconTable } from '@tabler/icons-react';
import type { EMRTableEmptyState as EmptyStateConfig } from './EMRTableTypes';
import { EMRButton } from '../../common/EMRButton';

interface EMRTableEmptyStateProps {
  config?: EmptyStateConfig;
  colSpan: number;
}

export function EMRTableEmptyState({ config, colSpan }: EMRTableEmptyStateProps): React.ReactElement {
  const Icon = config?.icon || IconTable;

  return (
    <tr>
      <td colSpan={colSpan}>
        <Box
          py={48}
          px={24}
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Stack align="center" gap="md">
            <ThemeIcon
              size="80"
              radius="xl"
              variant="light"
              color="gray"
              style={{
                background: 'var(--emr-bg-card)',
                border: '2px dashed var(--emr-border-color)',
              }}
            >
              <Icon size="36" stroke="1.5" style={{ color: 'var(--emr-text-muted)' }} />
            </ThemeIcon>

            <Stack align="center" gap={4}>
              <Text
                size="lg"
                fw={600}
                style={{ color: 'var(--emr-text-primary)' }}
              >
                {config?.title || 'No data available'}
              </Text>

              {config?.description && (
                <Text
                  size="sm"
                  style={{
                    color: 'var(--emr-text-secondary)',
                    maxWidth: 300,
                    textAlign: 'center',
                  }}
                >
                  {config.description}
                </Text>
              )}
            </Stack>

            {config?.action && (
              <EMRButton
                variant="secondary"
                size="sm"
                onClick={config.action.onClick}
              >
                {config.action.label}
              </EMRButton>
            )}
          </Stack>
        </Box>
      </td>
    </tr>
  );
}

export default EMRTableEmptyState;
