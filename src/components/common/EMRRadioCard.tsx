// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import type { ComponentType } from 'react';
import React from 'react';
import { Box, Group, Stack, Text, Radio } from '@mantine/core';
import styles from './EMRRadioCard.module.css';

export interface EMRRadioCardOption {
  value: string;
  label: string;
  description?: string;
  icon?: ComponentType<{ size?: number }>;
}

export interface EMRRadioCardProps {
  options: EMRRadioCardOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  'data-testid'?: string;
}

export function EMRRadioCard({
  options,
  value,
  onChange,
  disabled = false,
  'data-testid': testId,
}: EMRRadioCardProps): React.ReactElement {
  return (
    <Radio.Group value={value} onChange={onChange} data-testid={testId}>
      <Group className={styles.container} gap="md">
        {options.map((option) => {
          const isSelected = value === option.value;
          const Icon = option.icon;

          return (
            <Box
              key={option.value}
              className={`${styles.card} ${isSelected ? styles.selected : ''} ${disabled ? styles.disabled : ''}`}
              onClick={() => !disabled && onChange(option.value)}
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-label={option.label}
              aria-disabled={disabled}
              onKeyDown={(e) => {
                if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onChange(option.value);
                }
              }}
            >
              <Group gap="md" wrap="nowrap">
                {/* Radio Indicator */}
                <Radio
                  value={option.value}
                  disabled={disabled}
                  classNames={{
                    radio: styles.radio,
                  }}
                  aria-hidden="true"
                  tabIndex={-1}
                />

                {/* Icon (optional) */}
                {Icon && (
                  <Box className={styles.iconContainer}>
                    <Icon size={24} />
                  </Box>
                )}

                {/* Label and Description */}
                <Stack gap={4} style={{ flex: 1 }}>
                  <Text className={styles.label}>{option.label}</Text>
                  {option.description && <Text className={styles.description}>{option.description}</Text>}
                </Stack>
              </Group>
            </Box>
          );
        })}
      </Group>
    </Radio.Group>
  );
}
