// SPDX-License-Identifier: Apache-2.0

import { useId, forwardRef, memo, useCallback, useMemo } from 'react';
import { MultiSelect, Text } from '@mantine/core';
import type { ComboboxData, ComboboxItem } from '@mantine/core';
import type { EMRFieldBaseProps, EMRSelectOption } from './EMRFieldTypes';
import { EMRFieldWrapper } from './EMRFieldWrapper';
import { useTranslation } from '../../../contexts/TranslationContext';
import './emr-fields.css';

export interface EMRMultiSelectProps extends EMRFieldBaseProps {
  data: EMRSelectOption[] | string[];
  value?: string[];
  defaultValue?: string[];
  onChange?: (value: string[]) => void;
  searchable?: boolean;
  hidePickedOptions?: boolean;
  maxDropdownHeight?: number;
  nothingFoundMessage?: string;
  maxValues?: number;
}

function renderOption({ option }: { option: ComboboxItem }): React.ReactNode {
  return (
    <Text
      size="sm"
      style={{
        color: 'var(--emr-text-primary)',
        fontWeight: 'var(--emr-font-normal)',
      }}
    >
      {option.label}
    </Text>
  );
}

function normalizeOptions(data: EMRSelectOption[] | string[]): ComboboxData {
  if (data.length === 0) return [];
  if (typeof data[0] === 'string') {
    return (data as string[]).map((item) => ({ value: item, label: item }));
  }
  return (data as EMRSelectOption[]).map((opt) => ({
    value: opt.value,
    label: opt.label,
    disabled: opt.disabled,
  }));
}

/**
 * EMRMultiSelect — multi-select dropdown wrapper that mirrors EMRSelect's
 * field wrapper, validation states, and visual language. Built on top of
 * Mantine's MultiSelect (same engine as EMRSelect) so all input fields on
 * a page render identically.
 */
export const EMRMultiSelect = memo(forwardRef<HTMLInputElement, EMRMultiSelectProps>(
  (
    {
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
      data,
      value,
      defaultValue,
      onChange,
      searchable = true,
      hidePickedOptions = true,
      maxDropdownHeight = 320,
      nothingFoundMessage,
      maxValues,
    },
    ref,
  ): React.JSX.Element => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const { t } = useTranslation();
    const finalNothingFoundMessage =
      nothingFoundMessage ?? t('common.noOptionsFound', 'No options found');

    const normalizedData = useMemo(() => normalizeOptions(data), [data]);

    const handleChange = useCallback(
      (newValue: string[]) => {
        onChange?.(newValue);
      },
      [onChange],
    );

    const getValidationState = (): 'default' | 'error' | 'success' | 'warning' => {
      if (validationState) return validationState;
      if (error) return 'error';
      if (successMessage) return 'success';
      if (warningMessage) return 'warning';
      return 'default';
    };

    const state = getValidationState();
    const hasMessage =
      (state === 'error' && typeof error === 'string') ||
      (state === 'success' && !!successMessage) ||
      (state === 'warning' && !!warningMessage) ||
      (state === 'default' && !!helpText);
    const messageElementId = hasMessage
      ? `${inputId}-${state === 'default' ? 'help' : state}`
      : undefined;
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
      'emr-multiselect-input',
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
        <MultiSelect
          ref={ref}
          id={inputId}
          name={name}
          data={normalizedData}
          value={value}
          defaultValue={defaultValue}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          searchable={searchable}
          hidePickedOptions={hidePickedOptions}
          nothingFoundMessage={finalNothingFoundMessage}
          maxDropdownHeight={maxDropdownHeight}
          clearable={clearable}
          required={required}
          aria-label={ariaLabel}
          aria-describedby={computedAriaDescribedBy}
          aria-invalid={state === 'error'}
          data-testid={dataTestId}
          leftSection={leftSection}
          rightSection={rightSection}
          error={!!error}
          maxValues={maxValues}
          renderOption={renderOption}
          comboboxProps={{
            offset: 8,
            shadow: 'md',
            withinPortal: true,
            zIndex: 10000,
            position: 'bottom-start',
            middlewares: { flip: true, shift: true },
          }}
          classNames={{ input: inputClasses }}
          styles={{
            input: {
              minHeight: heights[size],
              fontSize: 'var(--emr-input-font-size)',
              borderColor:
                state === 'error'
                  ? 'var(--emr-input-error-border)'
                  : state === 'success'
                  ? 'var(--emr-input-success-border)'
                  : state === 'warning'
                  ? 'var(--emr-input-warning-border)'
                  : 'var(--emr-input-border)',
              borderRadius: 'var(--emr-input-border-radius)',
              transition: 'var(--emr-input-transition)',
              cursor: readOnly ? 'default' : 'text',
              padding: '6px 10px',
            },
            wrapper: {
              width: fullWidth ? '100%' : undefined,
            },
            pill: {
              backgroundColor: 'var(--emr-secondary-alpha-10)',
              color: 'var(--emr-secondary)',
              fontWeight: 'var(--emr-font-medium)',
              borderRadius: 'var(--emr-border-radius)',
              border: '1px solid var(--emr-secondary-alpha-20)',
            },
            dropdown: {
              borderRadius: 'var(--emr-input-border-radius)',
              border: '1px solid var(--emr-input-border)',
              boxShadow: 'var(--emr-shadow-md)',
            },
            option: {
              fontSize: 'var(--emr-input-font-size)',
              padding: '10px 12px',
              borderRadius: 'var(--emr-border-radius-sm)',
              color: 'var(--emr-text-primary)',
            },
          }}
        />
      </EMRFieldWrapper>
    );
  },
));

EMRMultiSelect.displayName = 'EMRMultiSelect';

export default EMRMultiSelect;
