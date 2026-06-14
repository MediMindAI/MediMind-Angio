// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Badge } from '@mantine/core';
import { forwardRef, memo, useMemo } from 'react';
import type { CSSProperties, ReactNode, Ref } from 'react';

/**
 * EMRBadge — the single sanctioned badge for the EMR ("Command" design direction).
 *
 * Two ways to drive it, both theme-locked:
 *
 * 1. SEMANTIC (`variant`) — the original, explicit API. ALWAYS WINS when set.
 *      <EMRBadge variant="success">Active</EMRBadge>
 *
 * 2. MANTINE-COMPATIBLE (`color` + `mantineVariant`) — added so the ~559 files using
 *    raw Mantine `<Badge color="..." variant="...">` can be converted MECHANICALLY.
 *    The wrapper maps Mantine color names → a theme-sanctioned tone, then renders that
 *    tone using the requested fill treatment. NO off-palette color ever reaches the DOM.
 *
 * ── COLOR → TONE MAP (Command palette only; purple/orange/amber/yellow are neutralized) ──
 *
 *   Mantine color name(s)                       → tone     visual
 *   ─────────────────────────────────────────────────────────────────────────────────────
 *   blue, cyan, indigo, navy, dark-blue         → info     solid navy  --emr-primary
 *   violet, purple, grape                        → info     (purple is FORBIDDEN → navy)
 *   green, teal, lime                            → success  solid green --emr-success
 *   red, pink, crimson, rose                     → error    solid red   --emr-error
 *   orange, yellow, amber                        → warning  red-toned   --emr-warning (yellow REMOVED)
 *   gray, grey, dark, slate, neutral, (unset)    → neutral  tinted navy metadata chip
 *
 * ── FILL TREATMENT (`mantineVariant`, mirrors Mantine's `variant`) ──
 *
 *   filled       → solid tone chip, white text          (info/success/error/warning)
 *   light        → tinted tone chip, tone-colored text   (DEFAULT for the color API)
 *   outline      → transparent chip, tone border + text
 *   dot          → neutral chip with a tone-colored dot
 *   transparent  → no fill, tone-colored text
 *
 * Defaults for the SEMANTIC api are byte-identical to the original component
 * (variant='info' default, size='sm', radius 6, weight 700, textTransform none),
 * so every existing caller renders exactly as before.
 */

export type EMRBadgeVariant =
  | 'version'
  | 'neutral'
  | 'status-active'
  | 'status-draft'
  | 'status-archived'
  | 'info'
  | 'success'
  | 'warning'
  | 'error';

export type EMRBadgeMantineVariant = 'filled' | 'light' | 'outline' | 'dot' | 'transparent' | 'white';

export type EMRBadgeSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/** Semantic tones the wrapper renders. Every Mantine color name maps to one of these. */
type BadgeTone = 'info' | 'success' | 'error' | 'warning' | 'neutral';

export interface EMRBadgeProps {
  /** Content to display in the badge */
  children?: ReactNode;
  /**
   * Semantic variant (original API). When set, it WINS over `color`/`mantineVariant`.
   * Defaults to 'info' only when `color` is NOT provided (preserves legacy behavior).
   */
  variant?: EMRBadgeVariant;
  /**
   * Mantine-style color name. Mapped to a theme tone inside the wrapper.
   * Provided so raw `<Badge color="...">` converts mechanically.
   */
  color?: string;
  /** Mantine-style fill treatment. Defaults to 'light' (matches the dominant raw usage). */
  mantineVariant?: EMRBadgeMantineVariant;
  /** Size of the badge */
  size?: EMRBadgeSize;
  /** Icon/content rendered left of the label */
  leftSection?: ReactNode;
  /** Icon/content rendered right of the label */
  rightSection?: ReactNode;
  /** Render as a circle (count chips) */
  circle?: boolean;
  /** Stretch to fill the parent width */
  fullWidth?: boolean;
  /** Border radius override (number → px, or token string) */
  radius?: number | string;
  /** text-transform override (badges default to 'none' — Mantine defaults to uppercase) */
  tt?: CSSProperties['textTransform'];
  /** Extra class names */
  className?: string;
  /** Inline style — merged AFTER tone styles so callers can fine-tune */
  style?: CSSProperties;
  /** Mantine `styles` API passthrough (e.g. `{ root: { flexShrink: 0 } }`) */
  styles?: Record<string, CSSProperties>;
  /** Click handler (rare — clickable chips) */
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  /**
   * Keyboard handler — for chips used as interactive controls (role="button").
   * Forwarded to the underlying Badge so a clickable chip can be keyboard-operable.
   */
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  /**
   * ARIA role passthrough (e.g. `"button"`, `"status"`) — for chips that double
   * as interactive controls or live-status indicators.
   */
  role?: React.AriaRole;
  /** Tab order passthrough — needed when the chip is a keyboard-focusable control. */
  tabIndex?: number;
  /** Native title attribute (tooltip) */
  title?: string;
  /** Optional test ID for testing */
  'data-testid'?: string;
  /**
   * Pass-through for arbitrary `data-*` / `aria-*` attributes (forwarded to the
   * underlying Badge). Lets call sites that key tests/CSS off custom data
   * attributes (e.g. `data-risk-level`) or ARIA state (e.g. `aria-pressed`)
   * convert without losing them.
   */
  [dataAttr: `data-${string}`]: string | number | boolean | undefined;
  [ariaAttr: `aria-${string}`]: string | number | boolean | undefined;
}

/** Normalize a Mantine color name (strips `.shade` suffixes like `blue.6`) → tone. */
function colorToTone(color: string | undefined): BadgeTone {
  if (!color) {
    return 'neutral';
  }
  const base = (color.toLowerCase().split('.')[0] ?? '').trim();
  switch (base) {
    // blue family → navy "info". purple/violet/grape are FORBIDDEN; they map to
    // navy info too (we never render purple).
    case 'blue':
    case 'cyan':
    case 'indigo':
    case 'navy':
    case 'sky':
    case 'lightblue':
    case 'violet':
    case 'purple':
    case 'grape':
      return 'info';
    case 'green':
    case 'teal':
    case 'lime':
    case 'emerald':
      return 'success';
    case 'red':
    case 'pink':
    case 'crimson':
    case 'rose':
    case 'maroon':
      return 'error';
    case 'orange':
    case 'yellow':
    case 'amber':
    case 'gold':
      return 'warning';
    case 'gray':
    case 'grey':
    case 'dark':
    case 'slate':
    case 'neutral':
    case 'stone':
    case 'zinc':
      return 'neutral';
    default:
      // Unknown/custom color name → safest neutral metadata chip.
      return 'neutral';
  }
}

/** Solid base color per tone (used by filled/outline/dot/transparent treatments). */
function toneSolid(tone: BadgeTone): string {
  switch (tone) {
    case 'info':
      return 'var(--emr-primary)';
    case 'success':
      return 'var(--emr-success)';
    case 'error':
      return 'var(--emr-error)';
    case 'warning':
      return 'var(--emr-warning)';
    case 'neutral':
    default:
      return 'var(--emr-secondary)';
  }
}

/** Tinted fill per tone (used by the `light` treatment). */
function toneTintBg(tone: BadgeTone): string {
  switch (tone) {
    case 'info':
      return 'var(--emr-bg-accent-secondary)';
    case 'success':
      return 'var(--emr-bg-accent-success)';
    case 'error':
      return 'var(--emr-bg-accent-error)';
    case 'warning':
      return 'var(--emr-bg-accent-warning)';
    case 'neutral':
    default:
      return 'var(--emr-bg-accent-secondary)';
  }
}

/** Text color for tinted/outline/transparent treatments. */
function toneTintText(tone: BadgeTone): string {
  switch (tone) {
    case 'info':
      return 'var(--emr-primary)';
    case 'success':
      return 'var(--emr-success)';
    case 'error':
      return 'var(--emr-error)';
    case 'warning':
      return 'var(--emr-warning)';
    case 'neutral':
    default:
      return 'var(--emr-secondary)';
  }
}

/** Border color for tinted/outline treatments. */
function toneBorder(tone: BadgeTone): string {
  switch (tone) {
    case 'info':
      return 'var(--emr-border-secondary)';
    case 'success':
      return 'var(--emr-border-success)';
    case 'error':
      return 'var(--emr-border-error)';
    case 'warning':
      return 'var(--emr-border-warning)';
    case 'neutral':
    default:
      return 'var(--emr-border-secondary)';
  }
}

/**
 * Styles for the original semantic variants (UNCHANGED — byte-identical to legacy).
 * @param variant
 */
const getVariantStyles = (variant: EMRBadgeVariant): CSSProperties => {
  switch (variant) {
    case 'version':
      return {
        background: 'var(--emr-gradient-primary)',
        color: 'var(--emr-text-inverse)',
        border: 'none',
        boxShadow: 'var(--emr-shadow-success)',
      };
    case 'neutral':
      return {
        backgroundColor: 'var(--emr-bg-accent-secondary)',
        color: 'var(--emr-secondary)',
        border: '1px solid var(--emr-border-secondary)',
      };
    case 'status-active':
      return {
        backgroundColor: 'var(--emr-bg-accent-secondary)',
        color: 'var(--emr-primary)',
        border: '1px solid var(--emr-border-secondary)',
      };
    case 'status-draft':
      return {
        backgroundColor: 'var(--emr-bg-accent-secondary)',
        color: 'var(--emr-primary)',
        border: '1px solid var(--emr-border-secondary)',
      };
    case 'status-archived':
      return {
        backgroundColor: 'var(--emr-bg-card)',
        color: 'var(--emr-bg-page)',
        border: '1px solid var(--emr-border-color)',
      };
    case 'info':
      return {
        backgroundColor: 'var(--emr-primary)',
        color: 'var(--emr-text-inverse)',
        border: '1px solid var(--emr-primary)',
      };
    case 'success':
      return {
        backgroundColor: 'var(--emr-success)',
        color: 'var(--emr-text-inverse)',
        border: '1px solid var(--emr-success)',
      };
    case 'warning':
      return {
        backgroundColor: 'var(--emr-bg-accent-warning)',
        color: 'var(--emr-warning)',
        border: '1px solid var(--emr-border-warning)',
      };
    case 'error':
      return {
        backgroundColor: 'var(--emr-error)',
        color: 'var(--emr-text-inverse)',
        border: '1px solid var(--emr-error)',
      };
    default:
      return {
        backgroundColor: 'var(--emr-bg-card)',
        color: 'var(--emr-text-secondary)',
        border: '1px solid var(--emr-border-color)',
      };
  }
};

/**
 * Styles for the Mantine-compatible (color + mantineVariant) API.
 * @param tone semantic tone derived from the Mantine color name
 * @param treatment fill treatment derived from the Mantine variant
 */
const getToneStyles = (tone: BadgeTone, treatment: EMRBadgeMantineVariant): CSSProperties => {
  switch (treatment) {
    case 'filled':
      // Neutral has no white-on-tone solid; keep it as a readable tinted chip.
      if (tone === 'neutral') {
        return {
          backgroundColor: 'var(--emr-bg-accent-secondary)',
          color: 'var(--emr-secondary)',
          border: '1px solid var(--emr-border-secondary)',
        };
      }
      return {
        backgroundColor: toneSolid(tone),
        color: 'var(--emr-text-inverse)',
        border: `1px solid ${toneSolid(tone)}`,
      };
    case 'outline':
      return {
        backgroundColor: 'transparent',
        color: toneTintText(tone),
        border: `1px solid ${toneBorder(tone)}`,
      };
    case 'transparent':
    case 'white':
      return {
        backgroundColor: 'transparent',
        color: toneTintText(tone),
        border: 'none',
      };
    case 'dot':
      // Neutral chip with a tone-colored dot rail (Command keeps the chip muted).
      return {
        backgroundColor: 'var(--emr-bg-card)',
        color: 'var(--emr-text-secondary)',
        border: '1px solid var(--emr-border-color)',
        // tone surfaces via the dot indicator (Mantine renders `dot` color from --badge-dot-color)
        ['--badge-dot-color' as string]: toneSolid(tone),
      };
    case 'light':
    default:
      return {
        backgroundColor: toneTintBg(tone),
        color: toneTintText(tone),
        border: `1px solid ${toneBorder(tone)}`,
      };
  }
};

/**
 * EMRBadge Component
 *
 * @example
 * // Semantic (original) API — unchanged
 * <EMRBadge variant="success">Active</EMRBadge>
 * <EMRBadge variant="version">V1.0.0</EMRBadge>
 *
 * // Mantine-compatible API — for mechanical conversion of raw <Badge>
 * <EMRBadge color="green" mantineVariant="light">Verified</EMRBadge>
 * <EMRBadge color="blue" mantineVariant="filled" circle>{count}</EMRBadge>
 * <EMRBadge color="red" leftSection={<IconX size={12} />}>Failed</EMRBadge>
 */
export const EMRBadge = memo(
  forwardRef<HTMLDivElement, EMRBadgeProps>(function EMRBadge(
    {
      children,
      variant,
      color,
      mantineVariant = 'light',
      size = 'sm',
      leftSection,
      rightSection,
      circle,
      fullWidth,
      radius,
      tt = 'none',
      className,
      style,
      styles,
      onClick,
      onKeyDown,
      role,
      tabIndex,
      title,
      'data-testid': dataTestId,
      ...rest
    }: EMRBadgeProps,
    ref: Ref<HTMLDivElement>
  ): React.ReactElement {
    // Resolve which API to use:
    // - explicit `variant` always wins (legacy behavior preserved)
    // - else if `color` given → Mantine-compatible tone styling
    // - else default to legacy 'info'
    const toneStyles = useMemo(() => {
      if (variant) {
        return getVariantStyles(variant);
      }
      if (color !== undefined) {
        return getToneStyles(colorToTone(color), mantineVariant);
      }
      return getVariantStyles('info');
    }, [variant, color, mantineVariant]);

    // The underlying Mantine `variant` only affects DOM structure for `dot`
    // (renders the dot indicator); all visuals come from `style`.
    const renderedMantineVariant = mantineVariant === 'dot' ? 'dot' : 'light';

    return (
      <Badge
        ref={ref}
        variant={renderedMantineVariant}
        size={size}
        radius="sm"
        circle={circle}
        fullWidth={fullWidth}
        leftSection={leftSection}
        rightSection={rightSection}
        className={className}
        styles={styles}
        onClick={onClick}
        onKeyDown={onKeyDown}
        role={role}
        tabIndex={tabIndex}
        title={title}
        data-testid={dataTestId}
        {...rest}
        style={{
          ...toneStyles,
          borderRadius: radius ?? 6,
          fontWeight: 'var(--emr-font-bold)',
          textTransform: tt,
          // caller style wins (merged last) so fine-tuning still works
          ...style,
        }}
      >
        {children}
      </Badge>
    );
  })
);

/**
 * Helper function to get EMRBadge variant from FHIR status
 * Useful for mapping Questionnaire.status to badge variants
 * @param status
 */
export function getStatusBadgeVariant(status: string): EMRBadgeVariant {
  switch (status) {
    case 'active':
      return 'status-active';
    case 'draft':
      return 'status-draft';
    case 'retired':
      return 'status-archived';
    default:
      return 'info';
  }
}
