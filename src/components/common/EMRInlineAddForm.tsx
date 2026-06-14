// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Paper, Grid, Group, Text, ThemeIcon, Stack } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { EMRAddButton } from './EMRAddButton';
import type { ComponentType, ReactNode, FormEvent } from 'react';
import { useTranslation } from '../../contexts/TranslationContext';

/** Icon props type for Tabler icons */
interface IconProps {
  size?: number | string;
  stroke?: number;
  color?: string;
}

export interface EMRInlineAddFormProps {
  children: ReactNode;
  onSubmit: (e?: FormEvent<HTMLFormElement>) => void;
  submitLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  submitIcon?: ComponentType<IconProps>;
  title?: string;
  subtitle?: string;
  icon?: ComponentType<IconProps>;
  gutter?: 'xs' | 'sm' | 'md' | 'lg';
  'data-testid'?: string;
}

/**
 * EMRInlineAddForm - Horizontal inline form for adding new items
 *
 * Features:
 * - Horizontal layout with form fields in a grid row
 * - Optional header with icon, title, and subtitle
 * - Submit button with loading state
 * - Responsive: Stacks vertically on mobile
 * - Uses theme CSS variables for all colors
 *
 * @param root0
 * @param root0.children
 * @param root0.onSubmit
 * @param root0.submitLabel
 * @param root0.loading
 * @param root0.disabled
 * @param root0.submitIcon
 * @param root0.title
 * @param root0.subtitle
 * @param root0.icon
 * @param root0.gutter
 * @param root0.'data-testid'
 * @example
 * ```tsx
 * <EMRInlineAddForm
 *   title="Add New Service"
 *   subtitle="Enter service details"
 *   icon={IconStethoscope}
 *   onSubmit={handleSubmit}
 *   loading={loading}
 *   submitLabel="Add Service"
 * >
 *   <Grid.Col span={{ base: 12, sm: 4 }}>
 *     <TextInput label="Code" {...form.getInputProps('code')} />
 *   </Grid.Col>
 *   <Grid.Col span={{ base: 12, sm: 8 }}>
 *     <TextInput label="Name" {...form.getInputProps('name')} />
 *   </Grid.Col>
 * </EMRInlineAddForm>
 * ```
 */
export function EMRInlineAddForm({
  children,
  onSubmit,
  submitLabel,
  loading = false,
  disabled = false,
  submitIcon,
  title,
  subtitle,
  icon: Icon,
  gutter = 'sm',
  'data-testid': dataTestId = 'emr-inline-add-form',
}: EMRInlineAddFormProps): React.ReactElement {
  const { t } = useTranslation();
  const SubmitIcon = submitIcon || IconPlus;
  const resolvedSubmitLabel = submitLabel ?? t('common.add');

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    onSubmit(e);
  };

  return (
    <Paper
      style={{
        padding: 'var(--emr-spacing-lg)',
        boxShadow: 'var(--emr-shadow-sm)',
        borderRadius: 'var(--emr-border-radius)',
        background: 'var(--emr-bg-card)',
        border: '1px solid var(--emr-border-default)',
      }}
    >
      {(title || subtitle || Icon) && (
        <Group
          data-testid={`${dataTestId}-header`}
          mb="md"
          gap="sm"
          style={{
            borderBottom: '1px solid var(--emr-border-default)',
            paddingBottom: 'var(--emr-spacing-md)',
          }}
        >
          {Icon && (
            <ThemeIcon
              size={44}
              radius="md"
              style={{
                background: 'var(--emr-gradient-primary)',
                boxShadow: 'var(--emr-shadow-button)',
              }}
            >
              <Icon size={24} />
            </ThemeIcon>
          )}
          <Stack gap={0}>
            {title && (
              <Text fw={600} size="md" style={{ color: 'var(--emr-text-primary)' }}>
                {title}
              </Text>
            )}
            {subtitle && (
              <Text size="sm" style={{ color: 'var(--emr-text-secondary)' }}>
                {subtitle}
              </Text>
            )}
          </Stack>
        </Group>
      )}
      <form role="form" onSubmit={handleSubmit} data-testid={dataTestId}>
        <Grid gutter={gutter} data-testid={`${dataTestId}-grid`} align="end" data-align="end" data-gutter={gutter}>
          {children}
          <Grid.Col span={{ base: 12, sm: 'auto' }} data-testid={`${dataTestId}-submit-col`}>
            <EMRAddButton
              type="submit"
              loading={loading}
              disabled={disabled}
              icon={SubmitIcon}
              data-testid={`${dataTestId}-submit`}
            >
            {resolvedSubmitLabel}
            </EMRAddButton>
          </Grid.Col>
        </Grid>
      </form>
    </Paper>
  );
}
