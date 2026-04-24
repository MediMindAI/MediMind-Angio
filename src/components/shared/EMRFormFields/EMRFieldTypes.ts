// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode, CSSProperties, ComponentType, SVGAttributes } from 'react';

// Tabler icon props type
export type IconProps = SVGAttributes<SVGElement> & {
  size?: number | string;
  stroke?: number | string;
};

/**
 * Input size variants
 */
export type EMRInputSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Validation state for inputs
 */
export type EMRValidationState = 'default' | 'error' | 'success' | 'warning';

/**
 * Base props shared by all EMR form field components
 */
export interface EMRFieldBaseProps {
  /** Unique identifier for the field */
  id?: string;

  /** Field name for form submission */
  name?: string;

  /** Field label displayed above input */
  label?: ReactNode;

  /** Placeholder text inside the input */
  placeholder?: string;

  /** Help text displayed below the input */
  helpText?: string;

  /** Error message (overrides helpText when present) */
  error?: string | boolean | null;

  /** Success message (shown with success validation state) */
  successMessage?: string;

  /** Warning message (shown with warning validation state) */
  warningMessage?: string;

  /** Input size variant */
  size?: EMRInputSize;

  /** Whether the field is required */
  required?: boolean;

  /** Whether the field is disabled */
  disabled?: boolean;

  /** Whether the field is read-only */
  readOnly?: boolean;

  /** Validation state */
  validationState?: EMRValidationState;

  /** Left section content (icon or text) */
  leftSection?: ReactNode;

  /** Right section content (icon or text) */
  rightSection?: ReactNode;

  /** Additional CSS class name */
  className?: string;

  /** Inline styles */
  style?: CSSProperties;

  /** Data attributes for testing */
  'data-testid'?: string;

  /** ARIA label for accessibility */
  'aria-label'?: string;

  /** ARIA described by ID */
  'aria-describedby'?: string;

  /** Show clear button */
  clearable?: boolean;

  /** Callback when clear button is clicked */
  onClear?: () => void;

  /** Full width input */
  fullWidth?: boolean;
}

/**
 * EMRTextInput specific props
 */
export interface EMRTextInputProps extends EMRFieldBaseProps {
  /** Input type (text, email, password, etc.) */
  type?: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url' | 'number' | 'time';

  /** Input mode for mobile keyboards */
  inputMode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';

  /** Current value */
  value?: string;

  /** Default value (uncontrolled) */
  defaultValue?: string;

  /** Change handler */
  onChange?: (value: string) => void;

  /** Native change event handler */
  onChangeEvent?: (event: React.ChangeEvent<HTMLInputElement>) => void;

  /** Blur handler */
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;

  /** Focus handler */
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;

  /** Key down handler */
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;

  /** Maximum character length */
  maxLength?: number;

  /** Pattern for validation */
  pattern?: string;

  /** Autocomplete attribute */
  autoComplete?: string;

  /** Auto focus on mount */
  autoFocus?: boolean;

  /** Description text (alias for helpText, for backward compatibility) */
  description?: string;

  /** Custom styles (for backward compatibility, ignored in new design) */
  styles?: Record<string, unknown>;

  /** Width of the right section in pixels */
  rightSectionWidth?: number;
}

/**
 * EMRSelect specific props
 */
export interface EMRSelectOption {
  /** Option value */
  value: string;

  /** Display label */
  label: string;

  /** Whether option is disabled */
  disabled?: boolean;

  /** Group name for option groups */
  group?: string;

  /** Optional description */
  description?: string;
}

export interface EMRSelectProps extends EMRFieldBaseProps {
  /** Select options */
  data: EMRSelectOption[] | string[];

  /** Current value */
  value?: string | null;

  /** Default value (uncontrolled) */
  defaultValue?: string;

  /** Change handler */
  onChange?: (value: string | null) => void;

  /** Blur handler */
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;

  /** Whether the select is searchable */
  searchable?: boolean;

  /** Nothing found message */
  nothingFoundMessage?: string;

  /** Maximum dropdown height */
  maxDropdownHeight?: number;

  /** Allow deselecting (clearing) */
  allowDeselect?: boolean;

  /** Check icon position */
  checkIconPosition?: 'left' | 'right';

  /** Dropdown position */
  dropdownPosition?: 'bottom' | 'top' | 'flip';

  /** Custom filter function */
  filter?: (options: { options: EMRSelectOption[]; search: string }) => EMRSelectOption[];

  /** Custom render function for dropdown options */
  renderOption?: (item: { option: { value: string; label: string } }) => ReactNode;

  /** Description text (alias for helpText, for backward compatibility) */
  description?: string;

  /** Custom styles */
  styles?: Record<string, unknown>;

  /** Controlled search value for searchable selects */
  searchValue?: string;

  /** Callback when search value changes */
  onSearchChange?: (value: string) => void;
}

/**
 * EMRNumberInput specific props
 */
export interface EMRNumberInputProps extends EMRFieldBaseProps {
  /** Current value */
  value?: number | string;

  /** Default value (uncontrolled) */
  defaultValue?: number;

  /** Change handler */
  onChange?: (value: number | string) => void;

  /** Blur handler */
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;

  /** Minimum value */
  min?: number;

  /** Maximum value */
  max?: number;

  /** Step increment */
  step?: number;

  /** Number of decimal places */
  decimalScale?: number;

  /** Decimal separator */
  decimalSeparator?: string;

  /** Thousand separator */
  thousandSeparator?: string;

  /** Prefix */
  prefix?: string;

  /** Suffix */
  suffix?: string;

  /** Hide step controls */
  hideControls?: boolean;

  /** Allow negative values */
  allowNegative?: boolean;

  /** Clamp value to min/max on blur */
  clampBehavior?: 'blur' | 'strict' | 'none';

  /**
   * How `warningMessage` should render. `'inline'` (default) shows the message
   * below the input via the field wrapper. `'icon'` suppresses the below-input
   * message and instead shows a red alert icon inside the input's right
   * section, with the message exposed as a tooltip and `aria-label` suffix —
   * useful inside dense table grids where a below-input line would break row
   * alignment.
   */
  warningMode?: 'inline' | 'icon';
}

/**
 * EMRTextarea specific props
 */
export interface EMRTextareaProps extends EMRFieldBaseProps {
  /** Current value */
  value?: string;

  /** Default value (uncontrolled) */
  defaultValue?: string;

  /** Change handler */
  onChange?: (value: string) => void;

  /** Native change event handler */
  onChangeEvent?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;

  /** Blur handler */
  onBlur?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;

  /** Focus handler */
  onFocus?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;

  /** Number of visible rows */
  rows?: number;

  /** Minimum rows (for autosize) */
  minRows?: number;

  /** Maximum rows (for autosize) */
  maxRows?: number;

  /** Enable auto-resize */
  autosize?: boolean;

  /** Maximum character length */
  maxLength?: number;

  /** Show character count */
  showCount?: boolean;

  /** Resize behavior */
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
}

/**
 * EMRDatePicker specific props (standalone uses Mantine DateInput — API kept compatible)
 */
export interface EMRDatePickerProps extends EMRFieldBaseProps {
  /** Current value */
  value?: Date | null;

  /** Default value (uncontrolled) */
  defaultValue?: Date;

  /** Change handler */
  onChange?: (value: Date | null) => void;

  /** Blur handler */
  onBlur?: () => void;

  /** Minimum selectable date */
  minDate?: Date;

  /** Maximum selectable date */
  maxDate?: Date;

  /** Excluded dates */
  excludeDates?: Date[];

  /** Date format string */
  valueFormat?: string;

  /** Whether to clear on escape */
  clearable?: boolean;

  /** Allow input editing */
  allowInput?: boolean;

  /** First day of week */
  firstDayOfWeek?: 0 | 1 | 2 | 3 | 4 | 5 | 6;

  /** Show week numbers */
  showWeekNumbers?: boolean;

  /** Highlight weekends */
  highlightWeekends?: boolean;

  /** Level to display (date, month, year) */
  level?: 'date' | 'month' | 'year';

  /** Dropdown type */
  dropdownType?: 'modal' | 'popover';
}

/**
 * EMRCheckbox specific props
 */
export interface EMRCheckboxProps extends Omit<EMRFieldBaseProps, 'placeholder'> {
  /** Current checked state */
  checked?: boolean;

  /** Default checked state (uncontrolled) */
  defaultChecked?: boolean;

  /** Change handler */
  onChange?: (checked: boolean) => void;

  /** Native change event handler */
  onChangeEvent?: (event: React.ChangeEvent<HTMLInputElement>) => void;

  /** Indeterminate state */
  indeterminate?: boolean;

  /** Label position */
  labelPosition?: 'left' | 'right';

  /** Checkbox color */
  color?: string;

  /** Custom icon when checked */
  icon?: ComponentType<IconProps>;

  /** Custom icon when indeterminate */
  indeterminateIcon?: ComponentType<IconProps>;

  /** Description text (alias for helpText) */
  description?: string;

  /** Custom styles */
  styles?: Record<string, unknown>;
}

/**
 * EMRRadioGroup specific props
 */
export interface EMRRadioOption {
  /** Option value */
  value: string;

  /** Display label */
  label: string;

  /** Whether option is disabled */
  disabled?: boolean;

  /** Optional description */
  description?: string;
}

export interface EMRRadioGroupProps extends EMRFieldBaseProps {
  /** Radio options */
  options: EMRRadioOption[];

  /** Current value */
  value?: string;

  /** Default value (uncontrolled) */
  defaultValue?: string;

  /** Change handler */
  onChange?: (value: string) => void;

  /** Layout orientation */
  orientation?: 'horizontal' | 'vertical';

  /** Spacing between options */
  spacing?: EMRInputSize;

  /** Radio color */
  color?: string;
}

/**
 * EMRFieldWrapper props (internal wrapper component)
 */
export interface EMRFieldWrapperProps {
  /** Field label */
  label?: ReactNode;

  /** Whether field is required */
  required?: boolean;

  /** Help text */
  helpText?: string;

  /** Error message */
  error?: string | boolean;

  /** Success message */
  successMessage?: string;

  /** Warning message */
  warningMessage?: string;

  /** Validation state */
  validationState?: EMRValidationState;

  /** Field size */
  size?: EMRInputSize;

  /** Full width */
  fullWidth?: boolean;

  /** Wrapper children */
  children: ReactNode;

  /** Additional CSS class name */
  className?: string;

  /** Inline styles */
  style?: CSSProperties;

  /** HTML for attribute */
  htmlFor?: string;

  /** Field ID for accessible error/message element IDs */
  fieldId?: string;
}

/**
 * Helper to get numeric height based on size
 */
export const EMR_INPUT_HEIGHT_VALUES: Record<EMRInputSize, number> = {
  xs: 30,
  sm: 36,
  md: 42,
  lg: 48,
  xl: 54,
};
