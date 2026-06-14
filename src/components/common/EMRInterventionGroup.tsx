// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import { Box, Text, Group, SimpleGrid, useMantineColorScheme } from '@mantine/core';
import { IconClipboardCheck } from '@tabler/icons-react';
import type { ComponentType, ReactNode } from 'react';
import { EMRCheckbox } from '../shared/EMRFormFields';
import { useTranslation } from '../../contexts/TranslationContext';
import './EMRInterventionGroup.css';

export interface EMRInterventionOption {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Whether the intervention is selected */
  checked: boolean;
  /** Whether the option is disabled */
  disabled?: boolean;
}

export interface EMRInterventionGroupProps {
  /** Group title (default: "INTERVENTIONS") */
  title?: string;
  /** Custom icon for the header */
  icon?: ComponentType<{ size?: number; stroke?: number }>;
  /** Intervention options with checked state */
  options: EMRInterventionOption[];
  /** Callback when an option is toggled */
  onChange: (id: string, checked: boolean) => void;
  /** Whether the entire group is disabled */
  disabled?: boolean;
  /** Layout variant */
  layout?: 'horizontal' | 'grid' | 'vertical';
  /** Number of columns for grid layout */
  columns?: number;
  /** Additional content to render after checkboxes */
  children?: ReactNode;
  /** Test ID */
  'data-testid'?: string;
}

/**
 * EMRInterventionGroup - Styled container for intervention checkboxes
 *
 * Features:
 * - Grouped background with subtle styling
 * - Header with icon and label
 * - Flexible layouts (horizontal, grid, vertical)
 * - Consistent checkbox styling
 *
 * @param root0
 * @param root0.title
 * @param root0.icon
 * @param root0.options
 * @param root0.onChange
 * @param root0.disabled
 * @param root0.layout
 * @param root0.columns
 * @param root0.children
 * @param root0.'data-testid'
 * @example
 * ```tsx
 * <EMRInterventionGroup
 *   options={[
 *     { id: 'consultation', label: 'Consultation provided', checked: false },
 *     { id: 'plan', label: 'Individual plan developed', checked: true },
 *     { id: 'followup', label: 'Follow-up scheduled', checked: false },
 *   ]}
 *   onChange={(id, checked) => handleInterventionChange(id, checked)}
 * />
 * ```
 */
export function EMRInterventionGroup({
  title,
  icon: Icon = IconClipboardCheck,
  options,
  onChange,
  disabled = false,
  layout = 'horizontal',
  columns = 2,
  children,
  'data-testid': dataTestId,
}: EMRInterventionGroupProps): React.JSX.Element {
  const { t } = useTranslation();
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const resolvedTitle = title ?? t('common.interventions');

  const handleChange = (id: string, checked: boolean) => {
    if (!disabled) {
      onChange(id, checked);
    }
  };

  const renderOptions = () => {
    const checkboxes = options.map((option) => (
      <EMRCheckbox
        key={option.id}
        label={option.label}
        checked={option.checked}
        onChange={(checked) => handleChange(option.id, checked)}
        disabled={disabled || option.disabled}
        size="sm"
      />
    ));

    switch (layout) {
      case 'vertical':
        return (
          <Box className="emr-intervention-group-options vertical">
            {checkboxes}
          </Box>
        );
      case 'grid':
        return (
          <SimpleGrid cols={columns} spacing="sm" className="emr-intervention-group-options">
            {checkboxes}
          </SimpleGrid>
        );
      case 'horizontal':
      default:
        return (
          <Group gap="lg" wrap="wrap" className="emr-intervention-group-options">
            {checkboxes}
          </Group>
        );
    }
  };

  return (
    <Box
      className={`emr-intervention-group ${isDark ? 'dark' : ''} ${disabled ? 'disabled' : ''}`}
      data-testid={dataTestId}
    >
      {/* Decorative corner accent */}
      <div className="emr-intervention-group-accent" />

      {/* Header */}
      <div className="emr-intervention-group-header">
        <span className="emr-intervention-group-icon">
          <Icon size={14} stroke={2} />
        </span>
        <Text className="emr-intervention-group-title">
          {resolvedTitle}
        </Text>
      </div>

      {/* Options */}
      {renderOptions()}

      {/* Additional content */}
      {children && (
        <Box mt="sm" className="emr-intervention-group-extra">
          {children}
        </Box>
      )}
    </Box>
  );
}

export default EMRInterventionGroup;
