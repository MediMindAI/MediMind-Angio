// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import React, { useId, forwardRef, memo, useCallback } from 'react';
import { NumberInput, Tooltip } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import type { EMRNumberInputProps } from './EMRFieldTypes';
import { EMRFieldWrapper } from './EMRFieldWrapper';
import './emr-fields.css';

/**
 * EMRNumberInput component
 * A production-ready number input with consistent styling
 */
export const EMRNumberInput = memo(forwardRef<HTMLInputElement, EMRNumberInputProps>(
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
      fullWidth = true,

      // NumberInput specific props
      value,
      defaultValue,
      onChange,
      onBlur,
      min,
      max,
      step = 1,
      decimalScale,
      decimalSeparator = '.',
      thousandSeparator,
      prefix,
      suffix,
      hideControls = false,
      allowNegative = true,
      allowDecimal,
      clampBehavior = 'blur',
      warningMode = 'inline',
      styles: stylesProp,
    },
    ref
  ): React.JSX.Element => {
    const generatedId = useId();
    const inputId = id || generatedId;

    // Handle change event
    const handleChange = useCallback(
      (newValue: number | string) => {
        if (onChange) {
          onChange(newValue);
        }
      },
      [onChange]
    );

    // Determine validation state
    const getValidationState = () => {
      if (validationState) {return validationState;}
      if (error) {return 'error';}
      if (successMessage) {return 'success';}
      if (warningMessage) {return 'warning';}
      return 'default';
    };

    const state = getValidationState();

    // In icon-mode, suppress the below-input warning row so dense table grids
    // keep a constant row height. The alert icon + tooltip carry the message.
    const iconModeActive = warningMode === 'icon' && state === 'warning' && !!warningMessage;
    const warningForWrapper = iconModeActive ? undefined : warningMessage;
    const computedAriaLabel = iconModeActive && ariaLabel
      ? `${ariaLabel} — ${warningMessage}`
      : ariaLabel;

    const effectiveRightSection = iconModeActive ? (
      <Tooltip label={warningMessage} withArrow position="top" openDelay={250}>
        <span
          className="emr-input-warning-icon"
          role="img"
          aria-label={warningMessage}
        >
          <IconAlertTriangle size={14} stroke={2} />
        </span>
      </Tooltip>
    ) : rightSection;

    // Build aria-describedby: link to the wrapper's error/message element
    const hasMessage = (state === 'error' && typeof error === 'string') ||
      (state === 'success' && !!successMessage) ||
      (state === 'warning' && !!warningForWrapper) ||
      (state === 'default' && !!helpText);
    const messageElementId = hasMessage ? `${inputId}-${state === 'default' ? 'help' : state}` : undefined;
    const computedAriaDescribedBy = ariaDescribedBy || messageElementId;

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

    return (
      <EMRFieldWrapper
        label={label}
        required={required}
        helpText={helpText}
        error={error}
        successMessage={successMessage}
        warningMessage={warningForWrapper}
        validationState={validationState}
        size={size}
        fullWidth={fullWidth}
        className={className}
        style={style}
        htmlFor={inputId}
        fieldId={inputId}
      >
        <NumberInput
          ref={ref}
          id={inputId}
          name={name}
          value={value}
          defaultValue={defaultValue}
          onChange={handleChange}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          min={min}
          max={max}
          step={step}
          decimalScale={decimalScale}
          decimalSeparator={decimalSeparator}
          thousandSeparator={thousandSeparator}
          prefix={prefix}
          suffix={suffix}
          hideControls={hideControls}
          allowNegative={allowNegative}
          allowDecimal={allowDecimal}
          clampBehavior={clampBehavior}
          required={required}
          aria-label={computedAriaLabel}
          aria-describedby={computedAriaDescribedBy}
          aria-invalid={state === 'error'}
          data-testid={dataTestId}
          leftSection={leftSection}
          rightSection={effectiveRightSection}
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
              // Caller per-slot input overrides applied last (text-align, weight…)
              ...(stylesProp?.input as React.CSSProperties | undefined),
            },
            wrapper: {
              width: fullWidth ? '100%' : undefined,
              ...(stylesProp?.wrapper as React.CSSProperties | undefined),
            },
            control: {
              borderColor: 'var(--emr-input-border)',
              '&:hover': {
                backgroundColor: 'var(--emr-hover-bg)',
              },
              ...(stylesProp?.control as React.CSSProperties | undefined),
            },
            // Any additional caller slots not styled by the wrapper
            ...Object.fromEntries(
              Object.entries(stylesProp ?? {}).filter(
                ([slot]) => slot !== 'input' && slot !== 'wrapper' && slot !== 'control'
              )
            ),
          }}
        />
      </EMRFieldWrapper>
    );
  }
));

EMRNumberInput.displayName = 'EMRNumberInput';

export default EMRNumberInput;
