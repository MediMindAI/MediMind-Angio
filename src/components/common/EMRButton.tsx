// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Button, Loader } from '@mantine/core';
import type { ButtonProps } from '@mantine/core';
import { forwardRef, memo } from 'react';
import type {
  ComponentPropsWithoutRef,
  ComponentType,
  ElementType,
  ReactNode,
  Ref,
} from 'react';
import classes from './EMRButton.module.css';

/**
 * Concrete root-props surface for Mantine's polymorphic `Button`. Mantine cannot
 * type-infer props for a *runtime-dynamic* `component` (an `ElementType` value,
 * not a literal), so forwarding it together with the anchor/router passthroughs
 * (`href`/`to`/`target`/`rel`) explodes the polymorphic prop union past what TS
 * can match against one concrete object — the migration originally papered over
 * this with a forbidden `component={component as never}`. Viewing `Button`
 * through this fixed surface keeps every forwarded prop type-checked while
 * sidestepping the inference blow-up; runtime behavior (a link-button still
 * receives `component`/`href`/`to`) is unchanged.
 */
type EMRButtonRootProps = ButtonProps &
  Omit<ComponentPropsWithoutRef<'button'>, keyof ButtonProps> & {
    component?: ElementType;
    href?: string;
    target?: string;
    to?: string;
    rel?: string;
    ref?: Ref<HTMLButtonElement>;
  };
const PolymorphicButton = Button as ComponentType<EMRButtonRootProps>;

/** Icon props type for Tabler icons */
interface IconProps {
  size?: number | string;
  stroke?: number;
}

/** Size variants for the button */
export type EMRButtonSize = 'xs' | 'sm' | 'md' | 'lg';

/** Visual variants for the button */
export type EMRButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'success'
  | 'ghost'
  | 'outline'
  | 'subtle'
  | 'light'
  | 'soft'
  | 'transparent'
  | 'default'
  | 'filled'
  | 'white'
  | 'onGradient';

/**
 * Raw Mantine `color=` values mapped to a semantic EMRButton variant. Used only
 * when no `variant` is given, so a raw `<Button color="red">` converts by swap.
 * Stays inside the theme-sanctioned palette — red→danger, green→success, the
 * rest collapse to ghost (low-emphasis navy) rather than introducing a new hue.
 */
const colorToVariant: Record<string, EMRButtonVariant> = {
  red: 'danger',
  pink: 'danger',
  green: 'success',
  teal: 'success',
  gray: 'ghost',
  dark: 'ghost',
  blue: 'primary',
  cyan: 'primary',
  indigo: 'primary',
};

/**
 * Props for EMRButton component
 */
export interface EMRButtonProps {
  /** Button label text */
  children?: ReactNode;
  /** Visual variant: primary (gradient), secondary (outlined), danger (red), ghost (minimal) */
  variant?: EMRButtonVariant;
  /** Size variant: sm=38px, md=44px (default), lg=50px */
  size?: EMRButtonSize;
  /** Icon component to display */
  icon?: ComponentType<IconProps>;
  /** Icon position: left (default) or right */
  iconPosition?: 'left' | 'right';
  /** Direct left section element (alternative to icon prop) */
  leftSection?: ReactNode;
  /** Direct right section element (e.g. trailing chevron/badge) */
  rightSection?: ReactNode;
  /**
   * Compact mode — tighter height for inline/toolbar buttons. Maps raw Mantine
   * `size="compact-sm" / "compact-md"`. Height is reduced via the `size` token;
   * padding is NEVER overridden on the root (Mantine label-height clipping bug).
   */
  compact?: boolean;
  /** Loading state - shows spinner instead of icon */
  loading?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Full width button */
  fullWidth?: boolean;
  /** Button type for forms */
  type?: 'button' | 'submit' | 'reset';
  /** Click handler. The MouseEvent is forwarded so handlers can call
   *  preventDefault() / stopPropagation() when nested inside a form. */
  onClick?: (event?: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>;
  /** Test ID for testing */
  'data-testid'?: string;
  /** Aria label for accessibility */
  'aria-label'?: string;
  /**
   * Aria pressed state — set on buttons used as toggle/selector controls
   * (e.g. a "Vessel | Calcium" or "CPR | VR" segmented group) so assistive
   * tech announces the active option. Optional; omit for plain action buttons.
   */
  'aria-pressed'?: boolean;
  /**
   * Aria checked state — set on buttons used inside a `role="radiogroup"` with
   * `role="radio"` (single-select segmented controls) so assistive tech
   * announces the chosen option. Optional; pair with `role="radio"`.
   */
  'aria-checked'?: boolean;
  /** Explicit ARIA role override (rarely needed). */
  role?: string;
  /** Additional CSS class name */
  className?: string;
  /** Inline styles (use sparingly, prefer className) */
  style?: React.CSSProperties;
  /**
   * Raw Mantine color name (red/green/gray/blue/…). Used ONLY when `variant` is
   * not supplied, so a raw `<Button color="red">` converts by swapping the tag.
   * Mapped to a theme-sanctioned variant (red→danger, green→success, gray→ghost,
   * blue→primary); unknown values fall through to the default variant. See the
   * conversion table in the JSDoc.
   */
  color?: string;
  /**
   * Polymorphic root element (e.g. `component="a"` for a link-button, or a
   * router `Link`). Passed through to Mantine along with any extra props
   * (`href`, `to`, `target`, …) via the rest-props passthrough.
   */
  component?: ElementType;
  /** Anchor href when `component="a"`. */
  href?: string;
  /** Anchor target when `component="a"`. */
  target?: string;
  /** Router target when `component={Link}`. */
  to?: string;
  /** Rel attribute when `component="a"`. */
  rel?: string;
  /** Tab index passthrough. */
  tabIndex?: number;
  /** id passthrough. */
  id?: string;
}

/** Height values for each size */
const heights: Record<EMRButtonSize, number> = {
  xs: 32,
  sm: 38,
  md: 44,
  lg: 50,
};

/** Compact height values for each size (used when `compact` is set) */
const compactHeights: Record<EMRButtonSize, number> = {
  xs: 26,
  sm: 30,
  md: 34,
  lg: 38,
};

/** Icon sizes for each button size */
const iconSizes: Record<EMRButtonSize, number> = {
  xs: 14,
  sm: 16,
  md: 18,
  lg: 20,
};

/**
 * Get CSS module class for each variant
 * @param variant
 */
const getVariantClass = (variant: EMRButtonVariant): string | undefined => {
  switch (variant) {
    case 'primary':
    case 'filled':
      return classes.primaryButton;
    case 'secondary':
    case 'outline':
    case 'default':
    case 'white':
      return classes.secondaryButton;
    case 'danger':
      return classes.dangerButton;
    case 'success':
      return classes.successButton;
    case 'light':
    case 'soft':
      return classes.softButton;
    case 'ghost':
    case 'subtle':
    case 'transparent':
      return classes.ghostButton;
    case 'onGradient':
      return classes.onGradientButton;
    default:
      return '';
  }
};

/**
 * Resolve the effective variant from an explicit `variant` (wins) or a raw
 * Mantine `color`. Unknown / absent → the supplied default ('primary').
 */
const resolveVariant = (variant: EMRButtonVariant | undefined, color: string | undefined): EMRButtonVariant => {
  if (variant) {
    return variant;
  }
  if (color) {
    return colorToVariant[color.toLowerCase()] ?? 'primary';
  }
  return 'primary';
};

/**
 * EMRButton - General-purpose button component for the EMR application
 *
 * Features:
 * - Four variants: primary (gradient), secondary (outlined), danger (red), ghost (minimal)
 * - Touch-friendly sizing (44px default height)
 * - Loading state with spinner
 * - Icon support on left or right
 * - Consistent styling across all EMR pages
 *
 * @param root0
 * @param root0.children
 * @param root0.variant
 * @param root0.size
 * @param root0.icon
 * @param root0.iconPosition
 * @param root0.loading
 * @param root0.disabled
 * @param root0.fullWidth
 * @param root0.type
 * @param root0.onClick
 * @param root0.'data-testid'
 * @param root0.'aria-label'
 * @param root0.className
 * @param root0.style
 * @example
 * ```tsx
 * // Primary button (main actions)
 * <EMRButton variant="primary" onClick={handleSave}>
 *   Save Changes
 * </EMRButton>
 *
 * // Secondary button (cancel, back)
 * <EMRButton variant="secondary" onClick={handleCancel}>
 *   Cancel
 * </EMRButton>
 *
 * // Danger button (delete, destructive actions)
 * <EMRButton variant="danger" icon={IconTrash} onClick={handleDelete}>
 *   Delete
 * </EMRButton>
 *
 * // Ghost button (minimal, tertiary actions)
 * <EMRButton variant="ghost" onClick={handleSkip}>
 *   Skip
 * </EMRButton>
 * ```
 */
export const EMRButton = memo(
  forwardRef<HTMLButtonElement, EMRButtonProps>(function EMRButton(
    {
      children,
      variant,
      size = 'md',
      icon: Icon,
      iconPosition = 'left',
      leftSection: leftSectionProp,
      rightSection: rightSectionProp,
      compact = false,
      loading = false,
      disabled = false,
      fullWidth = false,
      type = 'button',
      onClick,
      'data-testid': testId,
      'aria-label': ariaLabel,
      'aria-pressed': ariaPressed,
      'aria-checked': ariaChecked,
      role,
      className,
      style,
      color,
      component,
      href,
      to,
      target,
      rel,
      ...rest
    }: EMRButtonProps,
    ref
  ): React.ReactElement {
    // Effective variant: explicit `variant` wins; else map raw `color`; else primary.
    const effectiveVariant = resolveVariant(variant, color);
    const height = (compact ? compactHeights : heights)[size];
    const iconSize = iconSizes[size];
    const variantClass = getVariantClass(effectiveVariant);

    // Spinner contrast: light-on-dark variants get a white loader, the rest gray.
    const lightLoaderVariants: EMRButtonVariant[] = [
      'secondary',
      'outline',
      'default',
      'white',
      'ghost',
      'subtle',
      'transparent',
      'light',
      'soft',
      'onGradient',
    ];
    const loaderColor = lightLoaderVariants.includes(effectiveVariant) ? 'gray' : 'white';

    const iconElement = loading ? (
      <Loader size={iconSize} color={loaderColor} />
    ) : Icon ? (
      <Icon size={iconSize} stroke={2} />
    ) : null;

    // Use direct leftSection prop if provided, otherwise use icon-generated element
    const resolvedLeftSection = leftSectionProp || (iconPosition === 'left' ? iconElement : undefined);
    // Direct rightSection prop wins; otherwise the icon goes right when iconPosition === 'right'
    const resolvedRightSection = rightSectionProp || (iconPosition === 'right' ? iconElement : undefined);

    // Combine variant class with any custom className
    const combinedClassName = [variantClass, className].filter(Boolean).join(' ');

    // Phase 5 hardening — wrap onClick to surface async/sync errors to error
    // boundaries. Re-throw exceptions so error boundaries see them; do not block
    // native browser default or event bubbling — callers control that via
    // event.preventDefault() in their onClick handler.
    const wrappedClick = onClick
      ? (event: React.MouseEvent<HTMLButtonElement>) => {
          try {
            const result = onClick(event);
            if (result && typeof (result as Promise<unknown>).catch === 'function') {
              (result as Promise<unknown>).catch((err) => {
                console.error('[EMRButton] onClick promise rejected:', err);
                throw err; // re-throw so error boundaries see it
              });
            }
          } catch (err) {
            console.error('[EMRButton] onClick threw synchronously:', err);
            throw err; // re-throw so error boundaries see it
          }
        }
      : undefined;

    // Shared Mantine `styles` override for both render branches.
    const mantineStyles = {
      root: {
        height,
        padding: '0 20px',
        borderRadius: 'var(--emr-border-radius-lg)',
        fontWeight: 'var(--emr-font-semibold)',
        fontSize: 'var(--emr-font-base)',
        letterSpacing: '0.01em',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      },
      label: {
        overflow: 'visible',
        height: 'auto',
      },
    };

    // `PolymorphicButton` is Mantine's `Button` viewed through a fixed root-props
    // surface (see `EMRButtonRootProps`). `component`/`href`/`to`/`target`/`rel`
    // are forwarded for link-button usage; when `component` is undefined Mantine
    // renders the default `button` and the unused anchor attrs are dropped.
    return (
      <PolymorphicButton
        ref={ref}
        component={component}
        href={href}
        target={target}
        to={to}
        rel={rel}
        type={type}
        onClick={wrappedClick}
        disabled={disabled || loading}
        fullWidth={fullWidth}
        data-testid={testId}
        data-loading={loading || undefined}
        aria-label={ariaLabel}
        aria-pressed={ariaPressed}
        aria-checked={ariaChecked}
        role={role}
        className={combinedClassName}
        style={style}
        color={color}
        leftSection={resolvedLeftSection}
        rightSection={resolvedRightSection}
        styles={mantineStyles}
        {...rest}
      >
        {children}
      </PolymorphicButton>
    );
  })
);

export default EMRButton;
