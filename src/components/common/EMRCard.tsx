// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Box, type BoxProps, type ElementProps } from '@mantine/core';
import { forwardRef, type ReactNode } from 'react';

export type EMRCardShadow = 'card' | 'card-hover' | 'none';
export type EMRCardRibbon = 'gradient' | 'error' | 'none';

export interface EMRCardProps
  extends BoxProps,
    ElementProps<'div', keyof BoxProps> {
  /** Card content (any children — this is a GENERIC deck, not a structured card). */
  children?: ReactNode;
  /**
   * Border radius. Defaults to the 12px Command deck radius
   * (`--emr-border-radius-xl`). Pass a number/string to override.
   */
  radius?: number | string;
  /**
   * Resting shadow. `'card'` (default) = soft navy-tinted deck shadow,
   * `'card-hover'` = the elevated shadow, `'none'` = flat (nested surfaces).
   */
  shadow?: EMRCardShadow;
  /**
   * Interactive cards elevate on hover and get a pointer cursor.
   * Use for clickable list rows / KPI tiles / navigation cards.
   */
  interactive?: boolean;
  /** Click handler (also implies interactive affordance when set). */
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  /**
   * Render a subtle hairline border (`--emr-border-default`). Per Command,
   * primary content decks are BORDERLESS — only set this for nested / inner
   * secondary surfaces (a card inside a card, a bordered table wrapper).
   */
  withBorder?: boolean;
  /**
   * KPI/stat top ribbon. `'gradient'` = 3px brand-gradient ribbon,
   * `'error'` = 3px error ribbon for critical tiles, `'none'` (default).
   */
  ribbon?: EMRCardRibbon;
  /** Background override. Defaults to `var(--emr-bg-card)`. */
  bg?: string;
  /**
   * The caller's CSS module owns the entire visual surface (background, radius,
   * shadow, `:hover`, `::before` ribbons, animations, responsive radius, …).
   * When true, EMRCard injects ZERO inline visual styles — it renders a pure
   * semantic deck slot carrying only `className` / `style` / spacing props /
   * `ref` / `data-*`, so the module class fully controls the look. Use this for
   * components whose surface is styled via a `.module.css` class that inline
   * background/borderRadius/boxShadow would otherwise clobber. The `radius`,
   * `shadow`, `withBorder`, `ribbon`, and `bg` props are IGNORED in this mode;
   * `interactive`/`onClick` still wire the click handler + pointer affordance
   * but add no inline shadow (the module owns hover). Default false.
   */
  cssOwned?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const SHADOW_VAR: Record<EMRCardShadow, string | undefined> = {
  card: 'var(--emr-shadow-card)',
  'card-hover': 'var(--emr-shadow-card-hover)',
  none: undefined,
};

const RIBBON_BG: Record<Exclude<EMRCardRibbon, 'none'>, string> = {
  gradient: 'var(--emr-gradient-primary)',
  error: 'var(--emr-error)',
};

/**
 * EMRCard — the generic "deck" surface for the Command design system.
 *
 * This is the borderless, rounded, soft-shadowed white card that hosts ANY
 * children. It is the wrapper replacement for raw `<Paper>` / generic `<Card>`:
 *
 * ```tsx
 * // Before
 * <Paper p="md" radius="md" withBorder>{children}</Paper>
 * // After (primary deck — drop withBorder, it gets the Command shadow instead)
 * <EMRCard p="md">{children}</EMRCard>
 *
 * // Clickable tile
 * <EMRCard p="md" interactive onClick={handleOpen}>{children}</EMRCard>
 *
 * // KPI tile with gradient top ribbon
 * <EMRCard p="lg" ribbon="gradient">{children}</EMRCard>
 *
 * // Nested inner surface (keep the hairline)
 * <EMRCard p="sm" shadow="none" withBorder>{children}</EMRCard>
 *
 * // CSS-module-owned surface — the .module.css class owns background, radius,
 * // shadow, :hover, ::before ribbon, animation. EMRCard injects NO inline
 * // visual styles so the class is not clobbered. Conversion agents: use this
 * // for any raw <Paper>/<Card> whose look lives entirely in a CSS module.
 * <EMRCard cssOwned className={styles.notificationCard} p="md">{children}</EMRCard>
 * ```
 *
 * For STRUCTURED cards with a title/badges/actions API use `EMRContentCard`;
 * for a titled collapsible section use `EMRContentSection`. EMRCard is for the
 * generic "put anything in a deck" case those two cannot express.
 *
 * Built on Mantine `Box`, so every spacing prop (`p`/`px`/`py`/`pt`/`pb`/`pl`/
 * `pr`/`m`/`mt`/`mb`/...) and `data-*` attribute is forwarded natively.
 */
export const EMRCard = forwardRef<HTMLDivElement, EMRCardProps>(function EMRCard(
  {
    children,
    radius = 'var(--emr-border-radius-xl)',
    shadow = 'card',
    interactive = false,
    onClick,
    withBorder = false,
    ribbon = 'none',
    bg,
    cssOwned = false,
    className,
    style,
    ...rest
  },
  ref
) {
  const isInteractive = interactive || Boolean(onClick);
  const restingShadow = SHADOW_VAR[shadow];
  // Interactive cards rest on the card shadow and lift to card-hover; an
  // explicit shadow="card-hover" keeps that elevated shadow at rest too.
  // In cssOwned mode the module owns hover, so no inline hover shadow.
  const hoverShadow = !cssOwned && isInteractive ? 'var(--emr-shadow-card-hover)' : undefined;

  // cssOwned: the caller's CSS module fully owns the surface — render a pure
  // semantic slot with NO inline visual styles (only the caller's style, the
  // click affordance, and forwarded spacing/data-* props).
  const cardStyle: React.CSSProperties = cssOwned
    ? {
        cursor: isInteractive ? 'pointer' : undefined,
        ...style,
      }
    : {
        position: 'relative',
        background: bg ?? 'var(--emr-bg-card)',
        borderRadius: typeof radius === 'number' ? `${radius}px` : radius,
        boxShadow: restingShadow,
        border: withBorder ? '1px solid var(--emr-border-default)' : undefined,
        cursor: isInteractive ? 'pointer' : undefined,
        transition: 'box-shadow 150ms ease, transform 150ms ease',
        overflow: ribbon !== 'none' ? 'hidden' : undefined,
        ...style,
      };

  return (
    <Box
      ref={ref}
      className={className}
      style={cardStyle}
      onClick={onClick}
      data-emr-card=""
      data-interactive={isInteractive || undefined}
      onMouseEnter={
        hoverShadow
          ? (e) => {
              e.currentTarget.style.boxShadow = hoverShadow;
            }
          : undefined
      }
      onMouseLeave={
        hoverShadow
          ? (e) => {
              e.currentTarget.style.boxShadow = restingShadow ?? '';
            }
          : undefined
      }
      {...rest}
    >
      {!cssOwned && ribbon !== 'none' && (
        <Box
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            right: 0,
            height: '3px',
            background: RIBBON_BG[ribbon],
            pointerEvents: 'none',
          }}
        />
      )}
      {children}
    </Box>
  );
});
