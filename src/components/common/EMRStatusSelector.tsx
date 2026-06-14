// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import React, { useId } from 'react';
import { Box, Text, Group, useMantineColorScheme } from '@mantine/core';
import { GRAY_COLORS, SEMANTIC_COLORS, THEME_COLORS } from '../../constants/theme-colors';
import './EMRStatusSelector.css';

export type EMRStatusVariant = 'positive' | 'moderate' | 'negative' | 'neutral' | 'default';

export interface EMRStatusOption {
  /** Unique value for the option */
  value: string;
  /** Display label */
  label: string;
  /** Optional semantic variant for coloring */
  variant?: EMRStatusVariant;
  /** Whether this option is disabled */
  disabled?: boolean;
  /** Optional description shown below label */
  description?: string;
}

export interface EMRStatusSelectorProps {
  /** Label for the selector */
  label?: string;
  /** Help text shown below the selector */
  helpText?: string;
  /** Available options */
  options: EMRStatusOption[];
  /** Currently selected value */
  value?: string;
  /** Callback when value changes */
  onChange?: (value: string) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Whether a selection is required */
  required?: boolean;
  /** Error message */
  error?: string;
  /** Orientation of options */
  orientation?: 'horizontal' | 'vertical';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Test ID */
  'data-testid'?: string;
}

/**
 * EMRStatusSelector - Premium status/category selector with semantic colors
 *
 * Features:
 * - Pill-style selection buttons
 * - Semantic color variants (positive=green, moderate=yellow, negative=red)
 * - Animated selection indicator
 * - Support for descriptions
 * - Keyboard navigation
 *
 * @param root0
 * @param root0.label
 * @param root0.helpText
 * @param root0.options
 * @param root0.value
 * @param root0.onChange
 * @param root0.disabled
 * @param root0.required
 * @param root0.error
 * @param root0.orientation
 * @param root0.size
 * @param root0.'data-testid'
 * @example
 * ```tsx
 * <EMRStatusSelector
 *   label="Smoking Status"
 *   options={[
 *     { value: 'never', label: 'Never smoked', variant: 'positive' },
 *     { value: 'current', label: 'Currently smoking', variant: 'negative' },
 *     { value: 'former', label: 'Former smoker', variant: 'moderate' },
 *   ]}
 *   value={status}
 *   onChange={setStatus}
 * />
 * ```
 */
export function EMRStatusSelector({
  label,
  helpText,
  options,
  value,
  onChange,
  disabled = false,
  required = false,
  error,
  orientation = 'horizontal',
  size = 'md',
  'data-testid': dataTestId,
}: EMRStatusSelectorProps): React.JSX.Element {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const groupId = useId();

  const handleSelect = (optionValue: string) => {
    if (!disabled && onChange) {
      onChange(optionValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, optionValue: string, index: number) => {
    if (disabled) {return;}

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelect(optionValue);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (index + 1) % options.length;
      const nextOption = options[nextIndex];
      if (nextOption && !nextOption.disabled) {
        handleSelect(nextOption.value);
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = (index - 1 + options.length) % options.length;
      const prevOption = options[prevIndex];
      if (prevOption && !prevOption.disabled) {
        handleSelect(prevOption.value);
      }
    }
  };

  // Get variant colors - uses theme-consistent colors
  const getVariantStyles = (variant: EMRStatusVariant = 'default', _isSelected: boolean) => {
    const variants = {
      positive: {
        dot: isDark ? SEMANTIC_COLORS.successLight : SEMANTIC_COLORS.success,
        selectedBg: isDark ? 'rgba(56, 161, 105, 0.15)' : 'rgba(56, 161, 105, 0.12)',
        selectedBorder: isDark ? 'rgba(56, 161, 105, 0.4)' : 'rgba(56, 161, 105, 0.35)',
        selectedText: isDark ? SEMANTIC_COLORS.successLight : SEMANTIC_COLORS.success,
      },
      moderate: {
        dot: isDark ? SEMANTIC_COLORS.warningLight : SEMANTIC_COLORS.warning,
        selectedBg: isDark ? 'rgba(221, 107, 32, 0.15)' : 'rgba(221, 107, 32, 0.12)',
        selectedBorder: isDark ? 'rgba(221, 107, 32, 0.4)' : 'rgba(221, 107, 32, 0.35)',
        selectedText: isDark ? SEMANTIC_COLORS.warningLight : SEMANTIC_COLORS.warning,
      },
      negative: {
        dot: isDark ? SEMANTIC_COLORS.errorLight : SEMANTIC_COLORS.error,
        selectedBg: isDark ? 'rgba(229, 62, 62, 0.15)' : 'rgba(229, 62, 62, 0.12)',
        selectedBorder: isDark ? 'rgba(229, 62, 62, 0.4)' : 'rgba(229, 62, 62, 0.35)',
        selectedText: isDark ? SEMANTIC_COLORS.errorLight : SEMANTIC_COLORS.error,
      },
      neutral: {
        dot: isDark ? GRAY_COLORS.gray400 : GRAY_COLORS.gray500,
        selectedBg: isDark ? 'rgba(107, 114, 128, 0.15)' : 'rgba(107, 114, 128, 0.12)',
        selectedBorder: isDark ? 'rgba(107, 114, 128, 0.4)' : 'rgba(107, 114, 128, 0.35)',
        selectedText: isDark ? GRAY_COLORS.gray300 : GRAY_COLORS.gray700,
      },
      default: {
        dot: isDark ? THEME_COLORS.accent : THEME_COLORS.secondary,
        selectedBg: isDark ? 'rgba(43, 108, 176, 0.15)' : 'rgba(43, 108, 176, 0.12)',
        selectedBorder: isDark ? 'rgba(43, 108, 176, 0.4)' : 'rgba(43, 108, 176, 0.35)',
        selectedText: isDark ? THEME_COLORS.accent : THEME_COLORS.secondary,
      },
    };

    return variants[variant];
  };

  const sizeStyles = {
    sm: { padding: '6px 12px', fontSize: 'var(--emr-font-sm)', dotSize: 6, gap: 6 },
    md: { padding: '8px 14px', fontSize: 'var(--emr-font-base)', dotSize: 8, gap: 8 },
    lg: { padding: '10px 18px', fontSize: 'var(--emr-font-md)', dotSize: 10, gap: 10 },
  };

  const currentSize = sizeStyles[size];

  return (
    <Box
      className={`emr-status-selector ${isDark ? 'dark' : ''} ${disabled ? 'disabled' : ''} ${error ? 'error' : ''}`}
      data-testid={dataTestId}
    >
      {label && (
        <Text className="emr-status-selector-label">
          {label}
          {required && <span className="emr-status-selector-required">*</span>}
        </Text>
      )}

      <Group
        gap={8}
        wrap={orientation === 'horizontal' ? 'wrap' : 'nowrap'}
        className={`emr-status-selector-options ${orientation}`}
        role="radiogroup"
        aria-labelledby={label ? groupId : undefined}
      >
        {options.map((option, index) => {
          const isSelected = value === option.value;
          const isDisabled = disabled || option.disabled;
          const variantStyles = getVariantStyles(option.variant, isSelected);

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`emr-status-selector-option ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
              onClick={() => !isDisabled && handleSelect(option.value)}
              onKeyDown={(e) => handleKeyDown(e, option.value, index)}
              disabled={isDisabled}
              tabIndex={isSelected ? 0 : -1}
              style={{
                padding: currentSize.padding,
                fontSize: currentSize.fontSize,
                '--status-dot-color': variantStyles.dot,
                '--status-selected-bg': variantStyles.selectedBg,
                '--status-selected-border': variantStyles.selectedBorder,
                '--status-selected-text': variantStyles.selectedText,
              } as React.CSSProperties}
            >
              <span
                className="emr-status-selector-dot"
                style={{
                  width: currentSize.dotSize,
                  height: currentSize.dotSize,
                }}
                aria-hidden="true"
              />
              <span className="emr-status-selector-option-label">
                {option.label}
              </span>
              {option.description && (
                <span className="emr-status-selector-option-description">
                  {option.description}
                </span>
              )}
            </button>
          );
        })}
      </Group>

      {helpText && !error && (
        <Text className="emr-status-selector-help">{helpText}</Text>
      )}

      {error && (
        <Text className="emr-status-selector-error">{error}</Text>
      )}
    </Box>
  );
}

export default EMRStatusSelector;
