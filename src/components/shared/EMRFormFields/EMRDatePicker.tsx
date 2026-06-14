// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

// ============================================================================
// ⚠️  DUPLICATION NOTICE — THIS IS THE LEGACY (SHADOWED) EMRDatePicker
// ----------------------------------------------------------------------------
// TWO EMRDatePickers exist. This DateInput-based twin (@mantine/dates) is NOT
// the canonical one. The CANONICAL EMRDatePicker is the fully custom-calendar
// implementation at:
//   components/common/EMRDatePicker.tsx
//
// This twin is **SHADOWED**: components/shared/EMRFormFields/index.ts re-exports
// the canonical common/ component, so the EMRFormFields barrel does NOT serve
// this file. Range + table-filter variants were added to the CANONICAL one.
//
// CAVEAT — exactly ONE caller still imports THIS twin directly by file path:
//   components/reception/ReceiptFormModal.tsx
// Do NOT delete this twin and do NOT flip the EMRFormFields re-export — the two
// have different UX + value contracts. See
// audit-findings/ui-orphan-exceptions.md ("Known library duplication").
// ============================================================================

import React, { useId, forwardRef, useCallback } from 'react';
import type { DateInputProps } from '@mantine/dates';
import { DateInput } from '@mantine/dates';
import { IconCalendar } from '@tabler/icons-react';
import type { EMRDatePickerProps } from './EMRFieldTypes';
import { EMRFieldWrapper } from './EMRFieldWrapper';
import './emr-fields.css';

// Type-safe change handler that works with both Date and string
type DateChangeHandler = DateInputProps['onChange'];

/**
 * EMRDatePicker component
 * A production-ready date picker with consistent styling
 */
export const EMRDatePicker = forwardRef<HTMLInputElement, EMRDatePickerProps>(
  (
    {
      // Field wrapper props
      id,
      name,
      label,
      placeholder,
      helpText,
      error,
      successMessage,
      warningMessage,
      size = 'md',
      required,
      disabled,
      readOnly,
      validationState,
      leftSection,
      rightSection,
      className = '',
      style,
      'data-testid': dataTestId,
      'aria-label': ariaLabel,
      'aria-describedby': ariaDescribedBy,
      clearable = true,
      fullWidth = true,

      // DatePicker specific props
      value,
      defaultValue,
      onChange,
      onBlur,
      minDate,
      maxDate,
      excludeDates,
      valueFormat = 'DD/MM/YYYY',
      firstDayOfWeek = 1, // Monday
    },
    ref
  ): React.JSX.Element => {
    const generatedId = useId();
    const inputId = id || generatedId;

    // Handle change event - use type assertion for Mantine compatibility
    const handleChange = useCallback(
      (newValue: Date | null) => {
        if (onChange) {
          onChange(newValue);
        }
      },
      [onChange]
    ) as DateChangeHandler;

    // Determine validation state
    const getValidationState = () => {
      if (validationState) {return validationState;}
      if (error) {return 'error';}
      if (successMessage) {return 'success';}
      if (warningMessage) {return 'warning';}
      return 'default';
    };

    const state = getValidationState();

    // Calculate heights based on size
    const heights = {
      xs: 30,
      sm: 36,
      md: 42,
      lg: 48,
      xl: 54,
    };

    // Build input classes
    const inputClasses = [
      'emr-input',
      `size-${size}`,
      state === 'error' && 'has-error',
      state === 'success' && 'has-success',
      state === 'warning' && 'has-warning',
    ]
      .filter(Boolean)
      .join(' ');

    // Default left section with calendar icon
    const defaultLeftSection = (
      <IconCalendar size={18} style={{ color: 'var(--emr-input-icon-color)' }} />
    );

    return (
      <EMRFieldWrapper
        label={label}
        required={required}
        helpText={helpText}
        error={error}
        successMessage={successMessage}
        warningMessage={warningMessage}
        validationState={validationState}
        size={size}
        fullWidth={fullWidth}
        className={className}
        style={style}
        htmlFor={inputId}
      >
        <DateInput
          ref={ref}
          id={inputId}
          name={name}
          value={value}
          defaultValue={defaultValue}
          onChange={handleChange}
          onBlur={onBlur}
          placeholder={placeholder || valueFormat.toLowerCase()}
          disabled={disabled}
          readOnly={readOnly}
          minDate={minDate}
          maxDate={maxDate}
          excludeDate={excludeDates ? (date) => excludeDates.some(
            (excluded) => {
              const d = typeof date === 'string' ? new Date(date) : date;
              return d.getTime() === excluded.getTime();
            }
          ) : undefined}
          valueFormat={valueFormat}
          clearable={clearable}
          allowDeselect={clearable}
          firstDayOfWeek={firstDayOfWeek}
          required={required}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          aria-invalid={state === 'error'}
          data-testid={dataTestId}
          leftSection={leftSection ?? defaultLeftSection}
          rightSection={rightSection}
          error={!!error}
          popoverProps={{
            shadow: 'md',
            offset: 4,
            zIndex: 10001, // Ensure popover appears above modals (z-index: 10000)
            withinPortal: true, // Render outside modal DOM to avoid overflow clipping
          }}
          classNames={{
            input: inputClasses,
          }}
          styles={{
            input: {
              minHeight: heights[size],
              fontSize: 'var(--emr-input-font-size)',
              borderColor: state === 'error'
                ? 'var(--emr-input-error-border)'
                : state === 'success'
                ? 'var(--emr-input-success-border)'
                : state === 'warning'
                ? 'var(--emr-input-warning-border)'
                : 'var(--emr-input-border)',
              borderRadius: 'var(--emr-input-border-radius)',
              backgroundColor: state === 'error'
                ? 'var(--emr-input-error-bg)'
                : state === 'success'
                ? 'var(--emr-input-success-bg)'
                : state === 'warning'
                ? 'var(--emr-input-warning-bg)'
                : 'var(--emr-input-bg-solid)',
              transition: 'var(--emr-input-transition)',
              paddingLeft: '40px',
              '&:focus': {
                borderColor: state === 'error'
                  ? 'var(--emr-input-error-border)'
                  : 'var(--emr-input-border-focus)',
                boxShadow: state === 'error'
                  ? 'var(--emr-input-error-glow)'
                  : state === 'success'
                  ? 'var(--emr-input-success-glow)'
                  : state === 'warning'
                  ? 'var(--emr-input-warning-glow)'
                  : 'var(--emr-input-focus-ring)',
              },
              '&:hover:not(:disabled):not(:focus)': {
                borderColor: state === 'error'
                  ? 'var(--emr-input-error-border)'
                  : 'var(--emr-input-border-hover)',
              },
              '&:disabled': {
                backgroundColor: 'var(--emr-input-bg-disabled)',
                color: 'var(--emr-input-text-disabled)',
              },
            },
            wrapper: {
              width: fullWidth ? '100%' : undefined,
            },
            day: {
              borderRadius: 'var(--emr-border-radius-sm)',
              '&[data-selected]': {
                backgroundColor: 'var(--emr-secondary)',
              },
              '&:hover': {
                backgroundColor: 'var(--emr-hover-bg)',
              },
            },
            calendarHeader: {
              marginBottom: '8px',
            },
            calendarHeaderControl: {
              borderRadius: 'var(--emr-border-radius-sm)',
              '&:hover': {
                backgroundColor: 'var(--emr-hover-bg)',
              },
            },
          }}
        />
      </EMRFieldWrapper>
    );
  }
);

EMRDatePicker.displayName = 'EMRDatePicker';

export default EMRDatePicker;
