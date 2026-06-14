// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import type { CSSProperties } from 'react';
import React, { useId, forwardRef, memo, useCallback } from 'react';
import { Switch } from '@mantine/core';
import type { EMRSwitchProps } from './EMRFieldTypes';
import './emr-fields.css';

function isStyleSlotOverride(override: unknown): override is CSSProperties {
  return typeof override === 'object' && override !== null && !Array.isArray(override);
}

function mergeStyleSlot(defaults: CSSProperties, override: unknown): CSSProperties {
  return {
    ...defaults,
    ...(isStyleSlotOverride(override) ? override : undefined),
  };
}

/**
 * EMRSwitch component
 * A production-ready toggle switch with consistent styling
 */
export const EMRSwitch = memo(forwardRef<HTMLInputElement, EMRSwitchProps>(
  (
    {
      // Field props
      id,
      name,
      label,
      helpText,
      description,
      error,
      size = 'md',
      required,
      disabled,
      readOnly,
      className = '',
      style,
      'data-testid': dataTestId,
      'aria-label': ariaLabel,
      'aria-describedby': ariaDescribedBy,

      // Switch specific props
      checked,
      defaultChecked,
      onChange,
      onChangeEvent,
      labelPosition = 'right',
      color,
      onLabel,
      offLabel,
      thumbIcon,
      styles,
      tabIndex,
    },
    ref
  ): React.JSX.Element => {
    const generatedId = useId();
    const inputId = id || generatedId;

    // Handle change event
    const handleChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        if (onChangeEvent) {
          onChangeEvent(event);
        }
        if (onChange) {
          onChange(event.target.checked);
        }
      },
      [onChange, onChangeEvent]
    );

    // Determine error state
    const hasError = !!error;

    // Use description if provided, otherwise use helpText
    const descriptionText = description || helpText;

    // Wrapper classes
    const wrapperClasses = [
      'emr-checkbox-wrapper', // Reuse checkbox wrapper styles
      disabled && 'disabled',
      labelPosition === 'left' && 'label-left',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    // Merge default styles with custom styles
    const mergedStyles = {
      root: mergeStyleSlot({
        width: '100%',
      }, styles?.root),
      track: mergeStyleSlot({
        cursor: disabled ? 'not-allowed' : 'pointer',
        borderColor: hasError ? 'var(--emr-input-error-border)' : 'transparent',
        transition: 'var(--emr-input-transition)',
        backgroundColor: checked
          ? (color || 'var(--emr-secondary)')
          : 'var(--emr-border-color)',
      }, styles?.track),
      thumb: mergeStyleSlot({
        backgroundColor: 'var(--emr-switch-thumb)',
        border: 'none',
        boxShadow: 'var(--emr-shadow-sm)',
      }, styles?.thumb),
      label: mergeStyleSlot({
        fontSize: 'var(--emr-input-font-size)',
        color: 'var(--emr-input-text)',
        fontWeight: 'normal',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }, styles?.label),
      description: mergeStyleSlot({
        fontSize: 'var(--emr-input-help-size)',
        color: 'var(--emr-input-help-color)',
      }, styles?.description),
      error: mergeStyleSlot({
        fontSize: 'var(--emr-input-help-size)',
        color: 'var(--emr-input-error-text)',
      }, styles?.error),
    };

    return (
      <div className={wrapperClasses} style={style}>
        <Switch
          ref={ref}
          id={inputId}
          name={name}
          checked={checked}
          defaultChecked={defaultChecked}
          onChange={handleChange}
          label={label}
          description={descriptionText}
          disabled={disabled || readOnly}
          labelPosition={labelPosition}
          required={required}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          aria-invalid={hasError}
          data-testid={dataTestId}
          error={typeof error === 'string' ? error : hasError}
          color={color || 'blue'}
          size={size}
          onLabel={onLabel}
          offLabel={offLabel}
          thumbIcon={thumbIcon}
          tabIndex={tabIndex}
          styles={mergedStyles}
        />
      </div>
    );
  }
));

EMRSwitch.displayName = 'EMRSwitch';

export default EMRSwitch;
