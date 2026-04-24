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
      clampBehavior = 'blur',
      warningMode = 'inline',
    },
    ref
  ): React.JSX.Element => {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    const handleChange = useCallback(
      (newValue: number | string) => {
        if (onChange) {
          onChange(newValue);
        }
      },
      [onChange]
    );

    const getValidationState = (): 'default' | 'error' | 'success' | 'warning' => {
      if (validationState) { return validationState; }
      if (error) { return 'error'; }
      if (successMessage) { return 'success'; }
      if (warningMessage) { return 'warning'; }
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

    const hasMessage = (state === 'error' && typeof error === 'string') ||
      (state === 'success' && !!successMessage) ||
      (state === 'warning' && !!warningForWrapper) ||
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
            },
            wrapper: {
              width: fullWidth ? '100%' : undefined,
            },
            control: {
              borderColor: 'var(--emr-input-border)',
            },
          }}
        />
      </EMRFieldWrapper>
    );
  }
));

EMRNumberInput.displayName = 'EMRNumberInput';

export default EMRNumberInput;
