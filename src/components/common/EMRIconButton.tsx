// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * EMRIconButton Component
 * Themed icon-only button — the canonical replacement for raw Mantine
 * <ActionIcon> across the EMR (Command design, theme-only colors).
 *
 * Original capabilities (unchanged, byte-compatible for existing callers):
 * - Semantic variants: save (green), print (blue), delete (red), chart (teal), default (gray)
 * - 3 sizes: sm (28px), md (32px), lg (38px)
 * - Loading state with spinner
 * - Colored background + scale hover effect
 * - Dark mode support
 * - Tooltip on hover
 *
 * Additive capabilities (for the ~373-file ActionIcon migration):
 * - `onClick` is optional and receives the mouse event (existing `() => void` callers stay valid)
 * - `withTooltip` (default true) — set false to render the bare button with only
 *   aria-label. REQUIRED when used inside Menu.Target / Popover.Target, because the
 *   Tooltip wrapper consumes the ref/handlers those parents inject via cloneElement,
 *   so they never reach the actual <button>.
 * - Raw-ActionIcon visual variants: 'subtle', 'light', 'primary', 'transparent'
 * - `color` prop maps Mantine color names onto theme-sanctioned icon colors
 * - `size` accepts 'xs' | 'sm' | 'md' | 'lg' | 'xl' or a raw number
 * - className / style / data-* / aria-* / type / tabIndex / radius passthrough
 */

import { type ComponentType, type CSSProperties, type ReactNode, forwardRef } from 'react';
import { Tooltip } from '@mantine/core';
import { IconLoader2 } from '@tabler/icons-react';
import classes from './EMRIconButton.module.css';

// ============================================================================
// Types
// ============================================================================

interface IconProps {
  size?: number | string;
  stroke?: number;
}

/**
 * Semantic variants (original) + raw-ActionIcon idioms (new).
 *   subtle      → transparent bg, muted icon, navy on hover (the #1 ActionIcon variant)
 *   light       → tinted navy bg, navy icon
 *   primary     → solid navy gradient, white icon (maps Mantine variant="filled"/"gradient")
 *   filledColor → SOLID theme-sanctioned fill + white icon, driven by `filledColor`
 *                 (maps Mantine variant="filled" color="teal|green|blue|red|gray" swipe/action
 *                 buttons; teal→success, green→success, blue→info, red→error, gray→muted)
 *   transparent → fully transparent, no hover bg (maps Mantine variant="transparent")
 */
export type EMRIconButtonVariant =
  | 'save'
  | 'print'
  | 'delete'
  | 'chart'
  | 'default'
  | 'subtle'
  | 'light'
  | 'primary'
  | 'filledColor'
  | 'white'
  | 'transparent';

export type EMRIconButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Theme-sanctioned color keys for subtle/light variants. Mantine color names
 * collapse onto these — NEVER purple/orange/yellow (they fold to navy/error).
 */
export type EMRIconButtonColor = 'navy' | 'blue' | 'red' | 'green' | 'gray';

/**
 * Solid-fill color keys for `variant="filledColor"`. Each renders a SOLID
 * theme-sanctioned background with a white icon — the canonical replacement for
 * raw `variant="filled" color="teal|green|blue|red|gray"` swipe/action buttons.
 * NEVER teal/raw-green/raw-blue — those raw colors map onto these tokens:
 *   teal/green → success, blue/cyan → info, red/pink → error, gray/dark → muted, navy → navy
 */
export type EMRIconButtonFilledColor = 'success' | 'error' | 'info' | 'navy' | 'muted';

export interface EMRIconButtonProps {
  /**
   * Icon component from @tabler/icons-react. Optional only when `glyph` is
   * provided instead (e.g. a typographic ‹/› pagination chevron that is not
   * pixel-equivalent to any tabler icon).
   */
  icon?: ComponentType<IconProps>;
  /**
   * Typographic / custom node rendered INSTEAD of `icon`. Use when the original
   * raw ActionIcon had a non-icon child (e.g. the ‹ › glyphs) and swapping to a
   * tabler icon would change the rendered pixels. When set, `icon` is ignored.
   */
  glyph?: ReactNode;
  /** Tooltip label + aria-label (required for accessibility) */
  label: string;
  /** Click handler. Optional; receives the mouse event (e.g. for stopPropagation). */
  onClick?: (e?: React.MouseEvent<HTMLButtonElement>) => void;
  /** Variant — semantic (save/print/delete/chart/default) or visual (subtle/light/primary/transparent) */
  variant?: EMRIconButtonVariant;
  /** Icon color for subtle/light variants. Default depends on variant. */
  color?: EMRIconButtonColor;
  /**
   * Solid-fill color for `variant="filledColor"` — renders a SOLID theme background
   * with a white icon. Ignored by every other variant. Default 'navy'.
   */
  filledColor?: EMRIconButtonFilledColor;
  /** Size token (xs 22 / sm 28 / md 32 / lg 38 / xl 44) or a raw pixel number */
  size?: EMRIconButtonSize | number;
  /** Loading state - shows spinner */
  loading?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /**
   * Wrap the button in a Tooltip (default true). Set false inside
   * Menu.Target / Popover.Target and in very dense grids — the button keeps
   * its aria-label so it stays accessible.
   */
  withTooltip?: boolean;
  /** Border radius override (px number or CSS string) */
  radius?: number | string;
  /** Extra className appended to the computed classes */
  className?: string;
  /** Inline style passthrough (merged after computed size styles) */
  style?: CSSProperties;
  /** Button type (default 'button') */
  type?: 'button' | 'submit' | 'reset';
  /** Tab order passthrough */
  tabIndex?: number;
  /** Optional extra content rendered after the icon (e.g. an Indicator wrapper handles this externally) */
  children?: ReactNode;
  /** Test ID for testing */
  'data-testid'?: string;
  /**
   * Pass-through for arbitrary `data-*` / `aria-*` attributes (forwarded to the
   * underlying button via the rest-spread). Lets call sites that key tests/CSS
   * off custom data attributes or expose ARIA state (e.g. `aria-pressed`,
   * `aria-expanded`) convert from raw ActionIcon without losing them.
   */
  [dataAttr: `data-${string}`]: string | number | boolean | undefined;
  [ariaAttr: `aria-${string}`]: string | number | boolean | undefined;
}

// ============================================================================
// Size Configuration
// ============================================================================

const SIZE_PX: Record<EMRIconButtonSize, { button: number; icon: number }> = {
  xs: { button: 24, icon: 12 },
  sm: { button: 28, icon: 14 },
  md: { button: 32, icon: 16 },
  lg: { button: 38, icon: 18 },
  xl: { button: 44, icon: 22 },
};

function resolveSize(size: EMRIconButtonSize | number): { button: number; icon: number } {
  if (typeof size === 'number') {
    // Icon scales to ~55% of the button box, matching the token ratios above.
    return { button: size, icon: Math.max(12, Math.round(size * 0.55)) };
  }
  return SIZE_PX[size];
}

// ============================================================================
// Variant Class Mapping
// ============================================================================

const VARIANT_CLASSES: Record<EMRIconButtonVariant, string | undefined> = {
  save: classes.variantSave,
  print: classes.variantPrint,
  delete: classes.variantDelete,
  chart: classes.variantChart,
  default: classes.variantDefault,
  subtle: classes.variantSubtle,
  light: classes.variantLight,
  primary: classes.variantPrimary,
  filledColor: classes.variantFilledColor,
  white: classes.variantWhite,
  transparent: classes.variantTransparent,
};

/**
 * Solid-fill color classes — apply ONLY to `variant="filledColor"`. Each is a
 * solid theme-sanctioned background + white icon.
 */
const FILLED_COLOR_CLASSES: Record<EMRIconButtonFilledColor, string | undefined> = {
  success: classes.filledSuccess,
  error: classes.filledError,
  info: classes.filledInfo,
  navy: classes.filledNavy,
  muted: classes.filledMuted,
};

/**
 * Color classes apply ONLY to the tone-bearing visual variants (subtle/light).
 * Semantic variants (save/print/delete/chart/default) and primary/transparent
 * carry their own fixed color and ignore `color`.
 */
const COLOR_CLASSES: Record<EMRIconButtonColor, string | undefined> = {
  navy: classes.colorNavy,
  blue: classes.colorBlue,
  red: classes.colorRed,
  green: classes.colorGreen,
  gray: classes.colorGray,
};

const TONE_VARIANTS = new Set<EMRIconButtonVariant>(['subtle', 'light']);

// ============================================================================
// Component
// ============================================================================

export const EMRIconButton = forwardRef<HTMLButtonElement, EMRIconButtonProps>(
  function EMRIconButton(
    {
      icon: Icon,
      glyph,
      label,
      onClick,
      variant = 'default',
      color,
      filledColor,
      size = 'md',
      loading = false,
      disabled = false,
      withTooltip = true,
      radius,
      className,
      style,
      type = 'button',
      tabIndex,
      children,
      'data-testid': testId,
      ...rest
    },
    ref
  ) {
    const { icon: iconSize } = resolveSize(size);
    const { button: buttonPx } = resolveSize(size);
    const isDisabled = disabled || loading;

    const buttonClasses = [
      classes.iconButton,
      VARIANT_CLASSES[variant],
      // size class only used for the named tokens (kept for backwards-compat selectors);
      // explicit width/height below is the actual source of truth.
      typeof size !== 'number' ? classes[`size${size.charAt(0).toUpperCase()}${size.slice(1)}` as keyof typeof classes] : undefined,
      TONE_VARIANTS.has(variant) && color ? COLOR_CLASSES[color] : undefined,
      variant === 'filledColor' ? FILLED_COLOR_CLASSES[filledColor ?? 'navy'] : undefined,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const sizeStyle: CSSProperties = {
      width: buttonPx,
      height: buttonPx,
      minWidth: buttonPx,
      ...(radius !== undefined ? { borderRadius: radius } : {}),
      ...style,
    };

    const button = (
      <button
        ref={ref}
        type={type}
        className={buttonClasses}
        onClick={onClick}
        disabled={isDisabled}
        data-testid={testId}
        aria-label={label}
        tabIndex={tabIndex}
        style={sizeStyle}
        {...rest}
      >
        {loading ? (
          <IconLoader2 size={iconSize} className={classes.spinner} />
        ) : glyph !== undefined ? (
          glyph
        ) : Icon ? (
          <Icon size={iconSize} />
        ) : null}
        {children}
      </button>
    );

    if (!withTooltip) {
      return button;
    }

    return (
      <Tooltip label={label} withArrow position="top" disabled={loading}>
        {button}
      </Tooltip>
    );
  }
);

EMRIconButton.displayName = 'EMRIconButton';

export default EMRIconButton;
