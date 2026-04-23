// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import React, { useId, forwardRef, memo, useCallback } from 'react';
import { DateInput } from '@mantine/dates';
import type { EMRDatePickerProps } from './EMRFieldTypes';
import { EMRFieldWrapper } from './EMRFieldWrapper';
import './emr-fields.css';

/**
 * EMRDateInput component
 *
 * Lightweight Mantine DateInput wrapper following the MediMind EMR form-field API.
 *
 * Note: The MediMind `EMRDatePicker` in monorepo uses a custom Apple-inspired calendar
 * (depends on packages/app/src/emr/components/common/calendar). For the standalone we
 * use Mantine's `DateInput`, preserving the same props API (Date | null values).
 */
export const EMRDateInput = memo(forwardRef<HTMLInputElement, EMRDatePickerProps>(
  (
    {
      // Field wrapper props
      id,
      name,
      label,
      placeholder = 'YYYY-MM-DD',
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
      fullWidth = true,
      clearable = true,

      // Date specific
      value,
      defaultValue,
      onChange,
      onBlur,
      minDate,
      maxDate,
      valueFormat = 'YYYY-MM-DD',
      firstDayOfWeek = 1,
    },
    ref
  ): React.JSX.Element => {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    // Convert Date → 'YYYY-MM-DD' string for Mantine 8 DateInput
    const toDateString = (d: Date | null | undefined): string | null => {
      if (!d) return null;
      const iso = d.toISOString();
      return iso.split('T')[0] ?? null;
    };

    // Convert Mantine's string value → Date for our API
    const handleChange = useCallback(
      (newValue: string | null) => {
        if (onChange) {
          onChange(newValue ? new Date(newValue) : null);
        }
      },
      [onChange]
    );

    const handleBlur = useCallback(() => {
      if (onBlur) onBlur();
    }, [onBlur]);

    const getValidationState = (): 'default' | 'error' | 'success' | 'warning' => {
      if (validationState) { return validationState; }
      if (error) { return 'error'; }
      if (successMessage) { return 'success'; }
      if (warningMessage) { return 'warning'; }
      return 'default';
    };

    const state = getValidationState();

    const hasMessage = (state === 'error' && typeof error === 'string') ||
      (state === 'success' && !!successMessage) ||
      (state === 'warning' && !!warningMessage) ||
      (state === 'default' && !!helpText);
    const messageElementId = hasMessage ? `${inputId}-${state === 'default' ? 'help' : state}` : undefined;
    const computedAriaDescribedBy = ariaDescribedBy ?? messageElementId;

    const heights: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', number> = {
      xs: 30,
      sm: 36,
      md: 42,
      lg: 48,
      xl: 54,
    };

    const inputClasses = [
      'emr-input',
      `size-${size}`,
      state === 'error' && 'has-error',
      state === 'success' && 'has-success',
      state === 'warning' && 'has-warning',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <EMRFieldWrapper
        label={label}
        required={required}
        helpText={helpText}
        error={error ?? undefined}
        successMessage={successMessage}
        warningMessage={warningMessage}
        validationState={validationState}
        size={size}
        fullWidth={fullWidth}
        className={className}
        style={style}
        htmlFor={inputId}
        fieldId={inputId}
      >
        <DateInput
          ref={ref}
          id={inputId}
          name={name}
          value={toDateString(value)}
          defaultValue={toDateString(defaultValue)}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          minDate={minDate ? toDateString(minDate) ?? undefined : undefined}
          maxDate={maxDate ? toDateString(maxDate) ?? undefined : undefined}
          valueFormat={valueFormat}
          clearable={clearable}
          firstDayOfWeek={firstDayOfWeek}
          required={required}
          aria-label={ariaLabel}
          aria-describedby={computedAriaDescribedBy}
          aria-invalid={state === 'error'}
          data-testid={dataTestId}
          leftSection={leftSection}
          rightSection={rightSection}
          error={!!error}
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
              transition: 'var(--emr-input-transition)',
            },
            wrapper: {
              width: fullWidth ? '100%' : undefined,
            },
          }}
        />
      </EMRFieldWrapper>
    );
  }
));

EMRDateInput.displayName = 'EMRDateInput';

// Re-export as EMRDatePicker for drop-in compatibility with MediMind source
export const EMRDatePicker = EMRDateInput;

export default EMRDateInput;
