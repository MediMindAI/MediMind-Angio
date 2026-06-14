// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

// ============================================================================
// ⚠️  DUPLICATION NOTICE — TWO EMRDatePickers EXIST (read before editing)
// ----------------------------------------------------------------------------
// This file — components/common/EMRDatePicker.tsx — is the **CANONICAL**
// EMRDatePicker. It is a fully custom calendar (EMRCalendar in a Mantine
// Popover); it does NOT use @mantine/dates.
//
// A legacy DateInput-based twin lives at
//   components/shared/EMRFormFields/EMRDatePicker.tsx
// but it is **SHADOWED**: components/shared/EMRFormFields/index.ts re-exports
// THIS canonical component, so `import { EMRDatePicker } from '.../EMRFormFields'`
// resolves here, not to the twin.
//
// CAVEAT — ONE direct import of the shadowed twin still exists:
//   components/reception/ReceiptFormModal.tsx imports the twin by file path.
// Do NOT delete the twin and do NOT flip the EMRFormFields re-export; the two
// have different UX + value contracts. See
// audit-findings/ui-orphan-exceptions.md ("Known library duplication").
//
// All new feature work should import the canonical picker (from common/ or via
// the EMRFormFields barrel). Extend THIS file.
// ============================================================================

import { Box, Popover, Text, Group } from '@mantine/core';
import { IconCalendar, IconX } from '@tabler/icons-react';
import { forwardRef, useState, useEffect } from 'react';
import { EMRCalendar } from './calendar/EMRCalendar';
import { formatDate } from './calendar/calendar.utils';

/** Tuple value used in range mode. */
export type EMRDateRangeValue = [Date | null, Date | null];

export interface EMRDatePickerProps {
  /** Custom label */
  label?: string;
  /** Whether field is required */
  required?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Error message */
  error?: string;
  /**
   * Selection mode.
   * - `'default'` (default): single date — `value` is `Date | null`,
   *   `onChange` receives `Date | null`.
   * - `'range'`: date range — `value` is `[Date | null, Date | null]`,
   *   `onChange` receives the tuple.
   */
  type?: 'default' | 'range';
  /**
   * Current value.
   * - single mode: `Date | null`
   * - range mode (`type="range"`): `[Date | null, Date | null]`
   */
  value?: Date | null | EMRDateRangeValue;
  /**
   * Change handler.
   * - single mode: `(date: Date | null) => void`
   * - range mode: `(range: [Date | null, Date | null]) => void`
   */
  onChange?: ((date: Date | null) => void) | ((range: EMRDateRangeValue) => void);
  /** Minimum selectable date */
  minDate?: Date;
  /** Maximum selectable date */
  maxDate?: Date;
  /** Locale for date formatting */
  locale?: string;
  /** Custom styles to apply (will be merged with defaults) */
  customStyle?: React.CSSProperties;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Visual variant.
   * - `'default'` (default): full-height field with the gradient calendar tile.
   * - `'filter'`: compact, inline-width trigger for table column-filter rows —
   *   `--emr-bg-input` fill, hairline border, 8px radius, navy focus ring.
   */
  variant?: 'default' | 'filter';
  /** Disabled state */
  disabled?: boolean;
  /** Whether the input is clearable (always true in new design) */
  clearable?: boolean;
  /** Left section element (ignored in new design - calendar icon is built-in) */
  leftSection?: React.ReactNode;
  /** Container style */
  style?: React.CSSProperties;
  /** Date format string (e.g. 'YYYY-MM-DD') */
  valueFormat?: string;
  /** Test id forwarded to the clickable trigger (parity with EMR form fields) */
  'data-testid'?: string;
}

/** Normalize an incoming value into a range tuple, regardless of input shape. */
function toRange(value: EMRDatePickerProps['value']): EMRDateRangeValue {
  if (Array.isArray(value)) {
    return [value[0] ?? null, value[1] ?? null];
  }
  return [value ?? null, null];
}

/** Render the trigger text for either single or range selection. */
function formatTrigger(isRange: boolean, single: Date | null, range: EMRDateRangeValue): string {
  if (isRange) {
    const [start, end] = range;
    if (!start && !end) {
      return '';
    }
    return `${formatDate(start) || '…'} – ${formatDate(end) || '…'}`;
  }
  return formatDate(single);
}

/**
 * Production-Ready EMR Date Picker Component
 *
 * Features:
 * - Beautiful Apple-inspired custom calendar
 * - Multi-level navigation (Day → Month → Year)
 * - Single-date (default) AND range (`type="range"`) selection
 * - Compact table-filter variant (`variant="filter"`)
 * - Support for dates from 1900 to current year + 10
 * - Smooth animations and transitions
 * - Georgian/English/Russian locale support
 * - Premium styling matching EMR theme
 */
export const EMRDatePicker = forwardRef<HTMLInputElement, EMRDatePickerProps>(
  (
    {
      label,
      required,
      placeholder = 'dd.mm.yyyy',
      error,
      type = 'default',
      value,
      onChange,
      minDate = new Date(1900, 0, 1),
      maxDate = new Date(new Date().getFullYear() + 10, 11, 31),
      locale = 'en',
      customStyle,
      size = 'md',
      variant = 'default',
      disabled = false,

      clearable: _clearable, // Always clearable in new design

      leftSection: _leftSection, // Ignored - using built-in calendar icon
      style,
      'data-testid': dataTestId,
    },
    ref
  ) => {
    const isRange = type === 'range';
    const isFilter = variant === 'filter';

    const [opened, setOpened] = useState(false);
    const [inputValue, setInputValue] = useState(() =>
      formatTrigger(isRange, isRange ? null : (value as Date | null), toRange(value))
    );
    const [isHovered, setIsHovered] = useState(false);

    // Size configurations. The filter variant collapses to a compact 28px trigger.
    const sizeConfig = {
      sm: { height: 36, fontSize: 'var(--emr-font-base)', iconSize: 16, padding: '0 12px' },
      md: { height: 42, fontSize: 'var(--emr-font-md)', iconSize: 18, padding: '0 14px' },
      lg: { height: 48, fontSize: 'var(--emr-font-lg)', iconSize: 20, padding: '0 16px' },
    };

    const config = isFilter
      ? { height: 28, fontSize: 'var(--emr-font-xs)', iconSize: 14, padding: '0 8px' }
      : sizeConfig[size];

    // Sync input value when value prop changes
    useEffect(() => {
      setInputValue(formatTrigger(isRange, isRange ? null : (value as Date | null), toRange(value)));
    }, [value, isRange]);

    // ----- single-date selection -----
    const handleDateChange = (date: Date | null) => {
      if (date) {
        setInputValue(formatDate(date));
        (onChange as ((d: Date | null) => void) | undefined)?.(date);
        setOpened(false);
      }
    };

    // ----- range selection -----
    const handleRangeChange = (start: Date | null, end: Date | null) => {
      const next: EMRDateRangeValue = [start, end];
      setInputValue(formatTrigger(true, null, next));
      (onChange as ((r: EMRDateRangeValue) => void) | undefined)?.(next);
      // Close only once a full range is selected.
      if (start && end) {
        setOpened(false);
      }
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      setInputValue('');
      if (isRange) {
        (onChange as ((r: EMRDateRangeValue) => void) | undefined)?.([null, null]);
      } else {
        (onChange as ((d: Date | null) => void) | undefined)?.(null);
      }
    };

    const hasError = !!error;
    const hasValue = !!inputValue;

    const range = toRange(value);
    const singleValue = isRange ? null : (value as Date | null | undefined) ?? null;

    return (
      <Box
        style={{
          width: customStyle?.width || (isFilter ? 'auto' : '100%'),
          minWidth: 0,
          maxWidth: '100%',
          ...style,
        }}
      >
        {/* Label */}
        {label && (
          <Text
            component="label"
            size="sm"
            fw={600}
            c="var(--emr-text-primary)"
            mb={8}
            style={{ display: 'block' }}
          >
            {label}
            {required && (
              <Text component="span" c="var(--emr-error)" ml={4}>
                *
              </Text>
            )}
          </Text>
        )}

        <Popover
          opened={opened && !disabled}
          onChange={setOpened}
          position="bottom-start"
          shadow="lg"
          withinPortal
          radius={12}
        >
          <Popover.Target>
            <Box
              ref={ref as React.Ref<HTMLDivElement>}
              className="emr-datepicker-container"
              data-testid={dataTestId}
              onClick={() => !disabled && setOpened(true)}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              style={
                isFilter
                  ? {
                      // Compact Command table-filter trigger
                      height: config.height,
                      borderRadius: 8,
                      border: `1px solid ${
                        hasError
                          ? 'var(--emr-error)'
                          : opened
                          ? 'var(--emr-primary)'
                          : 'var(--emr-border-default)'
                      }`,
                      background: disabled ? 'var(--emr-bg-page)' : 'var(--emr-bg-input)',
                      display: 'flex',
                      alignItems: 'center',
                      padding: config.padding,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                      boxShadow: opened
                        ? '0 0 0 3px color-mix(in srgb, var(--emr-primary) 14%, transparent)'
                        : 'none',
                      opacity: disabled ? 0.6 : 1,
                      overflow: 'hidden',
                      minWidth: 0,
                      maxWidth: '100%',
                    }
                  : {
                      height: config.height,
                      borderRadius: 10,
                      border: `2px solid ${
                        hasError
                          ? 'var(--emr-error)'
                          : opened
                          ? 'var(--emr-primary)'
                          : isHovered && !disabled
                          ? 'var(--emr-text-secondary)'
                          : 'var(--emr-border-default)'
                      }`,
                      background: disabled ? 'var(--emr-bg-page)' : 'var(--emr-bg-card)',
                      display: 'flex',
                      alignItems: 'center',
                      padding: config.padding,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: opened
                        ? 'var(--emr-shadow-focus)'
                        : isHovered && !disabled
                        ? 'var(--emr-shadow-sm)'
                        : 'var(--emr-shadow-xs)',
                      opacity: disabled ? 0.6 : 1,
                      overflow: 'hidden',
                      minWidth: 0,
                      maxWidth: '100%',
                    }
              }
            >
              {/* Calendar Icon — gradient tile in default, plain glyph in filter */}
              {isFilter ? (
                <IconCalendar
                  size={config.iconSize}
                  strokeWidth={2}
                  color="var(--emr-text-secondary)"
                  style={{ marginRight: 6, flexShrink: 0 }}
                />
              ) : (
                <Box
                  style={{
                    width: config.iconSize + 12,
                    height: config.iconSize + 12,
                    borderRadius: 6,
                    background: opened
                      ? 'linear-gradient(135deg, var(--emr-primary) 0%, var(--emr-secondary) 100%)'
                      : 'var(--emr-bg-hover)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 8,
                    flexShrink: 0,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <IconCalendar
                    size={config.iconSize}
                    strokeWidth={2}
                    color={opened ? 'var(--emr-bg-card)' : 'var(--emr-text-secondary)'}
                  />
                </Box>
              )}

              {/* Value / Placeholder */}
              <Text
                size={config.fontSize}
                fw={hasValue ? 500 : 400}
                c={hasValue ? 'var(--emr-text-primary)' : 'var(--emr-text-secondary)'}
                style={{
                  flex: 1,
                  letterSpacing: hasValue && !isFilter ? '0.02em' : 'normal',
                  textAlign: 'left',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {inputValue || placeholder}
              </Text>

              {/* Clear Button */}
              {hasValue && !disabled && (
                <Box
                  onClick={handleClear}
                  data-testid={dataTestId ? `${dataTestId}-clear` : undefined}
                  style={{
                    width: isFilter ? 18 : 24,
                    height: isFilter ? 18 : 24,
                    borderRadius: 6,
                    background: isHovered ? 'var(--emr-error-light)' : 'var(--emr-bg-card)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    marginLeft: isFilter ? 4 : 8,
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--emr-error-light)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--emr-bg-card)';
                  }}
                >
                  <IconX size={isFilter ? 12 : 14} strokeWidth={2.5} color="var(--emr-error)" />
                </Box>
              )}
            </Box>
          </Popover.Target>

          <Popover.Dropdown
            style={{
              padding: 0,
              border: 'none',
              borderRadius: 16,
              boxShadow: 'var(--emr-shadow-xl)',
            }}
          >
            <EMRCalendar
              value={isRange ? null : singleValue}
              onChange={handleDateChange}
              rangeMode={isRange}
              rangeStart={isRange ? range[0] : undefined}
              rangeEnd={isRange ? range[1] : undefined}
              onRangeChange={handleRangeChange}
              minDate={minDate}
              maxDate={maxDate}
              locale={locale}
            />
          </Popover.Dropdown>
        </Popover>

        {/* Error Message */}
        {hasError && (
          <Group gap={6} mt={6}>
            <Text size="xs" c="var(--emr-error)">
              {error}
            </Text>
          </Group>
        )}
      </Box>
    );
  }
);

EMRDatePicker.displayName = 'EMRDatePicker';
