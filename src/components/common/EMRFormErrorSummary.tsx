// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import React, { useCallback } from 'react';
import { Alert, Box, List, Stack, Text, Anchor } from '@mantine/core';
import { IconAlertCircle, IconAlertTriangle } from '@tabler/icons-react';

/** Single form error item */
export interface EMRFormError {
  /** Field name/key that has the error */
  field: string;
  /** Display label for the field (optional, uses field name if not provided) */
  label?: string;
  /** Error message */
  message: string;
}

/** Error severity level */
export type EMRFormErrorSeverity = 'error' | 'warning';

/**
 * Props for EMRFormErrorSummary component
 */
export interface EMRFormErrorSummaryProps {
  /** Array of form errors to display */
  errors: EMRFormError[];
  /** Title shown at the top of the summary */
  title?: string;
  /** Severity level affects styling */
  severity?: EMRFormErrorSeverity;
  /** Make error fields clickable to focus them */
  focusOnClick?: boolean;
  /** Whether the summary can be dismissed */
  dismissible?: boolean;
  /** Callback when summary is dismissed */
  onDismiss?: () => void;
  /** Custom class name */
  className?: string;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * Focus a form field by its name
 */
function focusField(fieldName: string): void {
  // Try to find the field by name, id, or data-field attribute
  const selectors = [
    `[name="${fieldName}"]`,
    `#${fieldName}`,
    `[data-field="${fieldName}"]`,
    `[aria-label="${fieldName}"]`,
  ];

  for (const selector of selectors) {
    try {
      const element = document.querySelector(selector);
      if (element instanceof HTMLElement) {
        // Scroll element into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Focus the element
        setTimeout(() => {
          if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
            element.focus();
          } else {
            // Try to find focusable child
            const focusable = element.querySelector<HTMLElement>('input, textarea, select, button');
            focusable?.focus();
          }
        }, 300);

        return;
      }
    } catch {
      // Invalid selector, try next
    }
  }
}

/**
 * EMRFormErrorSummary Component
 *
 * Displays a summary of all form validation errors in a prominent alert box.
 * Typically placed at the top of a form to give users an overview of all issues.
 *
 * Features:
 * - Lists all form errors with field labels
 * - Click to focus/scroll to error field
 * - Error and warning severity variants
 * - Dismissible option
 * - Accessible with proper ARIA attributes
 * - Mobile-responsive design
 *
 * @example
 * ```tsx
 * // Basic usage
 * <EMRFormErrorSummary
 *   errors={[
 *     { field: 'email', label: 'Email', message: 'Invalid email format' },
 *     { field: 'phone', label: 'Phone', message: 'Phone number is required' },
 *   ]}
 * />
 *
 * // With focus on click
 * <EMRFormErrorSummary
 *   title="Please fix the following errors:"
 *   errors={form.errors}
 *   focusOnClick
 *   severity="error"
 * />
 *
 * // Dismissible warning
 * <EMRFormErrorSummary
 *   errors={warnings}
 *   severity="warning"
 *   dismissible
 *   onDismiss={() => setShowWarnings(false)}
 * />
 * ```
 */
export function EMRFormErrorSummary({
  errors,
  title,
  severity = 'error',
  focusOnClick = true,
  dismissible = false,
  onDismiss,
  className,
  'data-testid': testId = 'emr-form-error-summary',
}: EMRFormErrorSummaryProps): React.ReactElement | null {
  const handleFieldClick = useCallback(
    (fieldName: string) => (e: React.MouseEvent) => {
      e.preventDefault();
      if (focusOnClick) {
        focusField(fieldName);
      }
    },
    [focusOnClick]
  );

  // Don't render if no errors
  if (!errors || errors.length === 0) {
    return null;
  }

  const defaultTitle = severity === 'error'
    ? 'Please correct the following errors:'
    : 'Please review the following:';

  const IconComponent = severity === 'error' ? IconAlertCircle : IconAlertTriangle;
  const color = severity === 'error' ? 'red' : 'yellow';

  return (
    <Alert
      icon={<IconComponent size={20} />}
      color={color}
      variant="light"
      className={className}
      data-testid={testId}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      styles={{
        root: {
          backgroundColor:
            severity === 'error' ? 'var(--emr-bg-accent-error)' : 'var(--emr-bg-accent-warning)',
          border: `1px solid ${
            severity === 'error' ? 'var(--emr-error)' : 'var(--emr-warning)'
          }`,
          borderRadius: 'var(--emr-radius-md, 8px)',
        },
        icon: {
          color: severity === 'error' ? 'var(--emr-error)' : 'var(--emr-warning)',
        },
        title: {
          color: 'var(--emr-text-primary)',
          fontWeight: 'var(--emr-font-semibold)',
        },
        message: {
          color: 'var(--emr-text-secondary)',
        },
      }}
      withCloseButton={dismissible}
      onClose={onDismiss}
    >
      <Stack gap="xs">
        <Text fw={600} size="sm">
          {title || defaultTitle}
        </Text>

        <List
          size="sm"
          spacing="xs"
          center
          styles={{
            root: {
              marginLeft: 0,
            },
            item: {
              color: 'var(--emr-text-primary)',
              paddingLeft: 0,
            },
            itemWrapper: {
              display: 'flex',
              alignItems: 'flex-start',
            },
          }}
        >
          {errors.map((error, index) => (
            <List.Item
              key={`${error.field}-${index}`}
              icon={
                <Box
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor:
                      severity === 'error' ? 'var(--emr-error)' : 'var(--emr-warning)',
                    marginTop: 7,
                  }}
                />
              }
            >
              {focusOnClick ? (
                <Anchor
                  component="button"
                  type="button"
                  size="sm"
                  onClick={handleFieldClick(error.field)}
                  style={{
                    color: 'var(--emr-text-primary)',
                    textDecoration: 'underline',
                    textUnderlineOffset: 2,
                    cursor: 'pointer',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    textAlign: 'left',
                    minHeight: 44,
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                  data-testid={`${testId}-field-${error.field}`}
                >
                  <Text component="span" fw={600}>
                    {error.label || error.field}:
                  </Text>
                  &nbsp;
                  {error.message}
                </Anchor>
              ) : (
                <Text size="sm">
                  <Text component="span" fw={600}>
                    {error.label || error.field}:
                  </Text>
                  &nbsp;
                  {error.message}
                </Text>
              )}
            </List.Item>
          ))}
        </List>
      </Stack>
    </Alert>
  );
}

/**
 * Utility function to convert Mantine form errors to EMRFormError array
 *
 * @example
 * ```tsx
 * const form = useForm({ ... });
 * const errors = convertFormErrors(form.errors, {
 *   firstName: 'First Name',
 *   lastName: 'Last Name',
 *   email: 'Email Address',
 * });
 * <EMRFormErrorSummary errors={errors} />
 * ```
 */
export function convertFormErrors(
  formErrors: Record<string, string | null | undefined>,
  fieldLabels?: Record<string, string>
): EMRFormError[] {
  return Object.entries(formErrors)
    .filter(([_, message]) => message)
    .map(([field, message]) => ({
      field,
      label: fieldLabels?.[field] || field,
      message: message as string,
    }));
}

export default EMRFormErrorSummary;
