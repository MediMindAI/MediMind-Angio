// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Alert } from '@mantine/core';
import { IconAlertCircle, IconAlertTriangle, IconCircleCheck, IconInfoCircle } from '@tabler/icons-react';
import { isValidElement } from 'react';
import type { AriaRole, ComponentType, CSSProperties, ReactElement, ReactNode } from 'react';
import './EMRAlert.css';

/** Icon props type for Tabler icons */
interface IconProps {
  size?: number | string;
  stroke?: number;
}

/** Alert variant options (semantic — the only ones the Command idiom renders) */
export type EMRAlertVariant = 'error' | 'warning' | 'success' | 'info';

/**
 * Raw Mantine `color=` values seen across the ~216 raw-`<Alert>` call sites,
 * mapped to the four semantic EMRAlert variants. This is what makes raw alerts
 * mechanically convertible — drop `color="red"` and the wrapper resolves it to
 * the `error` rail. See the conversion table in the component JSDoc below.
 */
const colorToVariant: Record<string, EMRAlertVariant> = {
  // error family
  red: 'error',
  pink: 'error',
  // success family
  green: 'success',
  teal: 'success',
  lime: 'success',
  // info family (incl. purple/violet — NEVER render purple, fold into navy info)
  blue: 'info',
  cyan: 'info',
  indigo: 'info',
  violet: 'info',
  grape: 'info',
  // warning family — orange/yellow are forbidden hues; render the red-toned
  // `--emr-warning` rail (theme red-toned warning, see theme.css --emr-warning)
  orange: 'warning',
  yellow: 'warning',
  amber: 'warning',
  // neutral metadata — render as calm navy info
  gray: 'info',
  dark: 'info',
};

/**
 * Resolve a caller-supplied semantic variant and/or raw Mantine `color` into
 * one of the four Command variants. An explicit `variant` always wins; a `color`
 * is used only when no semantic variant was given. Unknown colors fall back to
 * `info` (calm navy) so a stray value never produces an off-palette rail.
 */
function resolveVariant(variant: EMRAlertVariant | undefined, color: string | undefined): EMRAlertVariant {
  if (variant) {
    return variant;
  }
  if (color) {
    return colorToVariant[color.toLowerCase()] ?? 'info';
  }
  return 'info';
}

/** Default icons for each variant */
const defaultIcons: Record<EMRAlertVariant, ComponentType<IconProps>> = {
  error: IconAlertCircle,
  warning: IconAlertTriangle,
  success: IconCircleCheck,
  info: IconInfoCircle,
};

/**
 * Props for EMRAlert component
 */
export interface EMRAlertProps {
  /** The alert message content (optional — a title-only alert is valid) */
  children?: ReactNode;
  /** Visual variant: error (red), warning (red rail, no-yellow rule), success (green), info (navy) */
  variant?: EMRAlertVariant;
  /**
   * Raw Mantine color name (red/green/blue/orange/yellow/violet/gray/…). Used
   * ONLY when `variant` is not supplied — exists so raw `<Alert color="red">`
   * call sites convert by simply swapping the tag. Mapped to a semantic variant
   * internally; see the conversion table in the JSDoc.
   */
  color?: string;
  /** Alert title (optional) — accepts a string or any ReactNode */
  title?: ReactNode;
  /**
   * Custom icon. Accepts BOTH a component type (`icon={IconLock}`) and an
   * already-rendered element (`icon={<IconLock size={18} />}`) — the most
   * common raw-Alert idiom. Detected via React.isValidElement.
   */
  icon?: ComponentType<IconProps> | ReactElement;
  /** Show close button */
  withCloseButton?: boolean;
  /** Callback when close button is clicked */
  onClose?: () => void;
  /**
   * Border radius passthrough. The Command idiom fixes alerts at the card
   * radius; accepted for API compatibility but ignored visually (the CSS
   * `border-radius` is authoritative). Documented as a no-op passthrough.
   */
  radius?: string | number;
  /** Test ID for testing */
  'data-testid'?: string;
  /** Additional CSS class name (merged after the variant classes) */
  className?: string;
  /** Inline styles merged onto the alert root */
  style?: CSSProperties;
  /**
   * ARIA role passthrough (e.g. `"alert"`). Forwarded to the underlying Alert
   * so live-region semantics on a raw `<Alert role="alert">` survive conversion.
   */
  role?: AriaRole;
  /**
   * ARIA live politeness passthrough (`"polite"` | `"assertive"` | `"off"`).
   * Forwarded so a raw `<Alert aria-live="polite">` keeps announcing updates.
   */
  'aria-live'?: 'polite' | 'assertive' | 'off';
  /**
   * Skip the Command deck/rail idiom entirely — the wrapper renders a bare
   * Mantine `<Alert>` carrying ONLY the caller's `className`, `icon`, `title`
   * and children, with NO `emr-alert*` classes and NO injected `styles`. Use
   * this for the rare banner that is fully owned by a colocated CSS module
   * (e.g. a white-on-gradient clinical WarningBanner) where the deck idiom
   * would clobber the module's look. Off by default — the deck idiom stays the
   * single sanctioned visual for ordinary alerts.
   */
  unstyled?: boolean;
}

/**
 * EMRAlert - Standardized alert component with consistent styling (Command idiom)
 *
 * Renders the Command alert: a borderless white "deck" with a 4px solid
 * semantic LEFT rail + card shadow, calm body text, bold first line. Style is
 * owned by `EMRAlert.css` + `theme.css` tokens — never by page code.
 *
 * ## Raw `<Alert>` → `<EMRAlert>` conversion table
 *
 * | Raw Mantine prop          | EMRAlert handling                              |
 * |---------------------------|------------------------------------------------|
 * | `color="red" / "pink"`    | → `variant="error"` (red rail)                 |
 * | `color="green/teal/lime"` | → `variant="success"` (green rail)             |
 * | `color="blue/cyan/indigo"`| → `variant="info"` (navy rail)                 |
 * | `color="violet/grape"`    | → `variant="info"` (NEVER purple)              |
 * | `color="orange/yellow"`   | → `variant="warning"` (red-toned rail)         |
 * | `color="gray/dark"`       | → `variant="info"` (calm navy)                 |
 * | `variant="light/filled/outline"` | dropped — single Command idiom; pass a *semantic* `variant` instead |
 * | `icon={<Icon … />}`       | rendered element used as-is                    |
 * | `icon={Icon}`             | component instantiated at `size={16}`          |
 * | `title="…"` / `title={…}` | passthrough (ReactNode)                        |
 * | `withCloseButton`/`onClose` | passthrough                                  |
 * | `radius`                  | accepted, no-op (CSS radius is authoritative)  |
 * | `className`/`style`       | merged onto root                               |
 *
 * NON-CONVERTIBLE leftovers: Mantine `styles={{…}}` deep overrides and `variant`
 * used for VISUAL emphasis (filled banners) — convert these by hand, choosing the
 * right semantic `variant`. Spacing props (`mb`, `mt`, …) are layout, not visual:
 * move them to a wrapping `<Box>` or keep via `style`.
 *
 * @example
 * ```tsx
 * // Mechanical conversion of a raw color="red" alert
 * <EMRAlert color="red" icon={<IconLock size={18} />}>Access denied</EMRAlert>
 *
 * // Idiomatic new code — semantic variant
 * <EMRAlert variant="success" title="Upload Complete">Done.</EMRAlert>
 * ```
 */
export function EMRAlert({
  children,
  variant,
  color,
  title,
  icon,
  withCloseButton = false,
  onClose,
  radius: _radius,
  role,
  'aria-live': ariaLive,
  'data-testid': testId,
  className,
  style,
  unstyled = false,
}: EMRAlertProps): React.ReactElement {
  const resolvedVariant = resolveVariant(variant, color);

  // icon accepts both a component type and an already-rendered element
  let iconNode: ReactNode;
  if (icon === undefined) {
    const DefaultIcon = defaultIcons[resolvedVariant];
    iconNode = <DefaultIcon size={16} />;
  } else if (isValidElement(icon)) {
    iconNode = icon;
  } else {
    const IconComponent = icon as ComponentType<IconProps>;
    iconNode = <IconComponent size={16} />;
  }

  // Unstyled escape hatch: a bare Alert whose look is entirely owned by the
  // caller's className (CSS module). No deck classes, no injected styles.
  if (unstyled) {
    return (
      <Alert
        icon={iconNode}
        title={title}
        withCloseButton={withCloseButton}
        onClose={onClose}
        closeButtonLabel="Close"
        className={className}
        data-testid={testId}
        style={style}
        role={role}
        aria-live={ariaLive}
      >
        {children}
      </Alert>
    );
  }

  return (
    <Alert
      icon={iconNode}
      title={title}
      withCloseButton={withCloseButton}
      onClose={onClose}
      closeButtonLabel="Close"
      className={['emr-alert', `emr-alert-${resolvedVariant}`, className].filter(Boolean).join(' ')}
      data-testid={testId}
      style={style}
      role={role}
      aria-live={ariaLive}
      styles={{
        root: {
          borderRadius: 'var(--emr-border-radius-xl)',
        },
        icon: {
          marginRight: '12px',
        },
        title: {
          fontWeight: 'var(--emr-font-bold)',
          fontSize: 'var(--emr-font-sm)',
        },
        message: {
          fontSize: 'var(--emr-font-sm)',
        },
        closeButton: {
          color: 'inherit',
          '&:hover': {
            background: 'var(--emr-bg-hover)',
          },
        },
      }}
    >
      {children}
    </Alert>
  );
}

export default EMRAlert;
