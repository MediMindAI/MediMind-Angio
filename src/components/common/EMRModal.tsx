// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Modal, Box, Group, Text, LoadingOverlay } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconX, IconDeviceFloppy } from '@tabler/icons-react';
import type { ReactNode, ComponentType, CSSProperties } from 'react';
import { useId, useMemo } from 'react';
import { EMRButton } from './EMRButton';
import { useTranslation } from '../../contexts/TranslationContext';
import classes from './EMRModal.module.css';

/** T-shirt size options for modal width */
export type EMRModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

const sizePixelMap: Record<EMRModalSize, number | string> = {
  sm: 580,
  md: 780,
  lg: 980,
  xl: 1200,
  xxl: '95vw',  // Full-width for complex forms
};

const iconSizeMap: Record<EMRModalSize, number> = {
  sm: 20,
  md: 22,
  lg: 24,
  xl: 26,
  xxl: 28,
};

const iconContainerSizeMap: Record<EMRModalSize, number> = {
  sm: 42,
  md: 46,
  lg: 50,
  xl: 54,
  xxl: 58,
};

const minBodyHeightMap: Record<EMRModalSize, number | string> = {
  sm: 200,
  md: 280,
  lg: 360,
  xl: 440,
  xxl: 'calc(92vh - 140px)',  // Takes most of the viewport height - increased for patient detail
};

export interface EMRModalProps {
  opened: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: EMRModalSize;
  icon?: ComponentType<{ size?: number | string; color?: string }>;
  subtitle?: string | ReactNode;
  /**
   * Footer content. Three modes:
   * - `undefined` (default): the standard cancel/submit action row (or nothing,
   *   if `onSubmit` is also undefined and `showFooter` isn't forced).
   * - a `ReactNode`: render this node in the footer chrome instead of the
   *   default cancel/submit buttons.
   * - `null`: render NO footer chrome at all (for consumers that own their own
   *   footer/actions inside `children`, e.g. command palettes, detail views).
   */
  footer?: ReactNode | null;
  showFooter?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  onSubmit?: () => void;
  submitLoading?: boolean;
  submitDisabled?: boolean;
  submitIcon?: ComponentType<{ size?: number | string }>;
  closeOnClickOutside?: boolean;
  closeOnEscape?: boolean;
  withCloseButton?: boolean;
  zIndex?: number;
  testId?: string;
  /** Force fullscreen mode (default: only fullscreen on mobile) */
  fullScreen?: boolean;
  /** Submit button color override */
  submitColor?: string;
  /** Disable focus trap (needed for modals with contenteditable/rich text editors) */
  trapFocus?: boolean;
  /** When set alongside submitLoading, shows a blurred overlay with this message over the body */
  processingMessage?: string;
  /**
   * Chrome variant. When 'reading-room', the modal subtree re-skins to the
   * fixed-dark PACS reading-room palette in BOTH light and dark app themes
   * (radiology convention — see EMRModal.module.css). Default undefined keeps
   * the standard theme-following rendering for every other call site.
   */
  chrome?: 'reading-room';
  /**
   * When false, renders NO header chrome at all (no tick bar, icon, title, or
   * close button). For consumers that supply their own header inside `children`
   * — command palettes, full-bleed detail views, gradient-header modals.
   * The dialog still gets an accessible name from `title` (aria-label on the
   * content node), so pass a meaningful `title` even when headerless.
   * Default true keeps today's standard slim deck header.
   */
  withHeader?: boolean;
  /**
   * When true, the body has zero padding (the content area renders flush to the
   * card edges). For consumers that own their own internal padding/layout.
   * Default false keeps the standard 24px (16px fullscreen) body padding.
   */
  noBodyPadding?: boolean;
  /**
   * Card corner radius override (px). Defaults to 12 (0 when fullscreen). Passed
   * straight through to Mantine. Fullscreen always wins (radius 0) regardless.
   */
  radius?: number;
  /**
   * Whether to vertically/horizontally center the card. Defaults to centered on
   * desktop, top-anchored isn't used. Pass through for consumers that need to
   * force a specific centering (rarely needed). Fullscreen ignores this.
   */
  centered?: boolean;
  /**
   * Overlay appearance passthrough (backgroundOpacity / blur). Defaults to the
   * standard 0.35 opacity + 12px blur (0/0 when fullscreen). Override for
   * consumers that want a different scrim (e.g. heavier dim for command palette).
   */
  overlayProps?: { backgroundOpacity?: number; blur?: number };
  /** Extra className applied to the Mantine content card (additive — combined
   *  with the reading-room class when both are set). */
  contentClassName?: string;
  /** Extra className applied to the modal body wrapper Box. */
  bodyClassName?: string;
}

/**
 * EMRModal - Premium Medical Interface Modal
 *
 * Refined, professional aesthetic for healthcare applications.
 * Features elegant gradients, subtle depth, and polished interactions.
 * @param root0
 * @param root0.opened
 * @param root0.onClose
 * @param root0.title
 * @param root0.children
 * @param root0.size
 * @param root0.icon
 * @param root0.subtitle
 * @param root0.footer
 * @param root0.showFooter
 * @param root0.submitLabel
 * @param root0.cancelLabel
 * @param root0.onSubmit
 * @param root0.submitLoading
 * @param root0.submitDisabled
 * @param root0.submitIcon
 * @param root0.closeOnClickOutside
 * @param root0.closeOnEscape
 * @param root0.withCloseButton
 * @param root0.zIndex
 * @param root0.testId
 */
export function EMRModal({
  opened,
  onClose,
  title,
  children,
  size = 'md',
  icon: Icon,
  subtitle,
  footer,
  showFooter,
  submitLabel,
  cancelLabel,
  onSubmit,
  submitLoading = false,
  submitDisabled = false,
  submitIcon: SubmitIcon = IconDeviceFloppy,
  closeOnClickOutside = true,
  closeOnEscape = true,
  withCloseButton = true,
  zIndex = 1100,
  testId,
  fullScreen: forceFullScreen,
  trapFocus = true,
  processingMessage,
  chrome,
  withHeader = true,
  noBodyPadding = false,
  radius,
  centered,
  overlayProps,
  contentClassName,
  bodyClassName,
}: EMRModalProps): React.ReactElement {
  const { t } = useTranslation();
  // Mobile detection for full-screen mode
  const isMobile = useMediaQuery('(max-width: 768px)');
  // Combine mobile and forced fullscreen for style calculations
  const isFullScreen = forceFullScreen || isMobile;

  // Resolve the card width as a raw CSS length (px or vw string).
  //
  // We do NOT hand this to Mantine's `size` prop: this app pins the document
  // root font-size to 10px while Mantine's `--mantine-scale` stays 1, so
  // Mantine's number→rem size conversion under-scales every modal to 62.5% of
  // its intended px (xl 1200 → 750px). Instead we set the `--modal-size` CSS
  // var DIRECTLY (in real px / vw) via styles.root below, which the Mantine
  // content rule consumes verbatim (`flex: 0 0 var(--modal-size)`), immune to
  // the root-font / scale mismatch.
  const rawSize = sizePixelMap[size];
  const rawSizeCss = typeof rawSize === 'number' ? `${rawSize}px` : rawSize;
  const modalSizeCss = isFullScreen ? '100%' : rawSizeCss;
  const iconSize = iconSizeMap[size];
  const iconContainerSize = isMobile ? 40 : iconContainerSizeMap[size];
  const minBodyHeight = minBodyHeightMap[size];
  // `footer === null` is the explicit "no footer chrome" opt-out (additive — no
  // existing caller passes null). It wins over `showFooter` and `onSubmit`.
  const shouldShowFooter =
    footer === null ? false : (showFooter ?? (footer !== undefined || onSubmit !== undefined));
  const isProcessing = submitLoading && !!processingMessage;

  // Memoized style objects to prevent recreation on every render.
  //
  // Mantine v8 layout note (centering fix, 2026-06-11): the modal DOM is
  //   .mantine-Modal-root
  //     └ .mantine-Modal-inner    ← position:fixed; width:100vw;
  //                                  display:flex; align/justify:center
  //                                  → THIS element centers the card
  //         └ .mantine-Modal-content  ← the actual card (width = --modal-size)
  //
  // Passing these flex-column/max-height/overflow styles via
  // <Modal.Content style={...}> caused Mantine v8 to forward the SAME inline
  // style onto BOTH the content card AND the centering `.inner` wrapper. The
  // injected `flex-direction: column` flipped the inner's main axis, which let
  // the card shrink-wrap its children (≈538px) instead of honoring the `size`
  // width — making every EMRModal look narrow/cramped. We now route these
  // card-only styles through `styles={{ content }}` (see <Modal.Root> below),
  // so the `.inner` centering wrapper keeps Mantine's defaults untouched and
  // the card fills its intended `size`.
  const contentStyles = useMemo<CSSProperties>(() =>
    isFullScreen
      ? {
          overflow: 'hidden',
          boxShadow: 'none',
          maxHeight: '100vh',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 0,
        }
      : {
          overflow: 'hidden',
          boxShadow: 'var(--emr-modal-shadow)',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
        },
    [isFullScreen]
  );

  // styles.root injects --modal-size DIRECTLY (raw px/vw), bypassing Mantine's
  // broken number→rem size conversion (see modalSizeCss note above). The card
  // (.mantine-Modal-content) reads it via `flex: 0 0 var(--modal-size)`.
  // styles.content keeps card-only layout off the `.inner` centering wrapper.
  const rootStyles = useMemo<Record<string, CSSProperties>>(() => ({
    root: { '--modal-size': modalSizeCss } as CSSProperties,
    content: contentStyles,
  }), [contentStyles, modalSizeCss]);

  const modalBodyStyles = useMemo<CSSProperties>(() => ({
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  }), []);

  // Command identity (2026-06-11): the slim header — a card-background row with
  // a 4×15px gradient tick bar before the title, hairline separator below. The
  // legacy full-width gradient band (+ frosted glass icon, noise texture,
  // highlight line) is retired in favor of the calmer "deck" treatment.
  const headerStyles = useMemo<CSSProperties>(() => ({
    padding: isFullScreen ? '16px 16px' : '20px 24px',
    background: 'var(--emr-bg-card)',
    position: isFullScreen ? 'sticky' : 'relative',
    top: 0,
    borderBottom: '1px solid var(--emr-border-color)',
    flexShrink: 0,
    zIndex: 10,
    paddingTop: isMobile ? 'max(16px, env(safe-area-inset-top))' : '20px',
  }), [isFullScreen, isMobile]);

  // 4×15px gradient tick bar preceding the title (Command section-header motif).
  const tickBarStyles = useMemo<CSSProperties>(() => ({
    width: 4,
    height: 15,
    minWidth: 4,
    borderRadius: 2,
    background: 'var(--emr-gradient-primary)',
  }), []);

  const iconContainerStyles = useMemo<CSSProperties>(() => ({
    width: iconContainerSize,
    height: iconContainerSize,
    minWidth: iconContainerSize,
    borderRadius: 10,
    background: 'var(--emr-secondary-alpha-08)',
    border: '1px solid var(--emr-border-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }), [iconContainerSize]);

  const titleStyles = useMemo<CSSProperties>(() => ({
    letterSpacing: '-0.01em',
    lineHeight: 'var(--emr-line-height-snug)',
  }), []);

  const closeButtonStyles = useMemo<CSSProperties>(() => ({
    width: isMobile ? 44 : 36,
    height: isMobile ? 44 : 36,
    minWidth: isMobile ? 44 : 36,
    minHeight: isMobile ? 44 : 36,
    borderRadius: isMobile ? 12 : 8,
    border: 'none',
    background: 'transparent',
    color: 'var(--emr-text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  }), [isMobile]);

  const bodyStyles = useMemo<CSSProperties>(() => ({
    paddingTop: noBodyPadding ? 0 : (isFullScreen ? '16px' : '24px'),
    paddingRight: noBodyPadding ? 0 : (isFullScreen ? '16px' : '24px'),
    paddingLeft: noBodyPadding ? 0 : (isFullScreen ? '16px' : '24px'),
    paddingBottom: noBodyPadding
      ? (isMobile ? 'env(safe-area-inset-bottom)' : 0)
      : (isMobile ? 'max(16px, env(safe-area-inset-bottom))' : (isFullScreen ? '16px' : '24px')),
    background: 'var(--emr-bg-card)',
    minHeight: isFullScreen ? 0 : (typeof minBodyHeight === 'number' ? minBodyHeight : 200),
    flex: 1,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    position: 'relative',
  }), [isFullScreen, isMobile, minBodyHeight, noBodyPadding]);

  const footerStyles = useMemo<CSSProperties>(() => ({
    paddingTop: '16px',
    paddingRight: isFullScreen ? '16px' : '24px',
    paddingLeft: isFullScreen ? '16px' : '24px',
    paddingBottom: isMobile ? 'max(16px, env(safe-area-inset-bottom))' : '16px',
    background: 'var(--emr-bg-page)',
    borderTop: '1px solid var(--emr-border-default)',
    flexShrink: 0,
    position: isFullScreen ? 'sticky' : 'relative',
    bottom: 0,
    zIndex: 10,
  }), [isFullScreen, isMobile]);

  const mobileButtonStyles = useMemo<CSSProperties | undefined>(
    () => isFullScreen ? { minHeight: 48 } : undefined,
    [isFullScreen]
  );

  // Static style objects (no dependencies, never change)
  const headerGroupStyles = useMemo<CSSProperties>(() => ({
    position: 'relative',
  }), []);

  const headerInnerGroupStyles = useMemo<CSSProperties>(() => ({
    flex: 1,
    minWidth: 0,
  }), []);

  const titleContainerStyles = useMemo<CSSProperties>(() => ({
    minWidth: 0,
    flex: 1,
  }), []);

  const subtitleStyles = useMemo<CSSProperties>(() => ({
    letterSpacing: '0.01em',
  }), []);

  // C6-WH-H3 remediation 2026-05-20: stable id so screen readers announce the
  // modal title. Cascades to every modal in the app (warehouse + everywhere).
  // WCAG 4.1.2 (Name, Role, Value).
  const titleId = useId();

  // C6-M1 (WCAG 4.1.2): the dialog's accessible name. Mantine puts role="dialog"
  // on its <section> content node and only wires aria-labelledby to it when a
  // real <Modal.Title> is mounted. EMRModal renders a custom gradient header
  // (not Modal.Title), so the dialog had NO accessible name. Using the compound
  // <Modal.Root>/<Modal.Content> form lets us put aria-label directly on the
  // content node — naming the dialog from `title` with no extra DOM heading.
  const dialogAriaLabel = typeof title === 'string' ? title : undefined;

  return (
    <Modal.Root
      opened={opened}
      onClose={onClose}
      // `size` intentionally omitted — width is driven by the `--modal-size`
      // CSS var injected via styles.root (modalSizeCss). Mantine's own
      // number→rem size conversion is broken by this app's 10px document root
      // (see modalSizeCss note above), so we set the px value directly.
      centered={centered ?? (!isMobile && !forceFullScreen)}
      fullScreen={forceFullScreen || isMobile}
      closeOnClickOutside={isProcessing ? false : closeOnClickOutside}
      closeOnEscape={isProcessing ? false : closeOnEscape}
      trapFocus={trapFocus}
      // C6-M2 (WCAG 2.4.3): return focus to the element that opened the modal
      // when it closes (Esc / outside-click / close button) instead of dumping
      // focus to the top of the page. Mantine's default is already true — set
      // explicitly so a future refactor can't silently regress it.
      returnFocus
      padding={0}
      zIndex={zIndex}
      radius={isFullScreen ? 0 : (radius ?? 12)}
      // v8 centering fix (2026-06-11): route card-only layout styles through
      // `styles.content` so they NEVER leak onto the `.inner` centering wrapper.
      styles={rootStyles}
      transitionProps={{
        transition: isFullScreen ? 'slide-up' : 'fade',
        duration: 180,
      }}
    >
      <Modal.Overlay
        backgroundOpacity={isFullScreen ? 0 : (overlayProps?.backgroundOpacity ?? 0.35)}
        blur={isFullScreen ? 0 : (overlayProps?.blur ?? 12)}
      />
      <Modal.Content
        // C6-M1: name the role="dialog" node directly from `title` — see comment
        // on dialogAriaLabel above. Additive ARIA, no behavior or layout change.
        // Layout styles now flow through <Modal.Root styles.content> (above) so
        // they don't leak onto the `.inner` centering wrapper in Mantine v8.
        aria-label={dialogAriaLabel}
        className={
          [chrome === 'reading-room' ? classes.emrModalReadingRoom : undefined, contentClassName]
            .filter(Boolean)
            .join(' ') || undefined
        }
        data-testid={testId}
      >
        <Modal.Body style={modalBodyStyles}>
      {/* ═══════════════════════════════════════════════════════════════
          HEADER - Command slim deck: gradient tick bar + title on card bg.
          Suppressed entirely when withHeader={false} (consumer owns header).
          ═══════════════════════════════════════════════════════════════ */}
      {withHeader && (
      <Box style={headerStyles}>
        <Group justify="space-between" align="center" wrap="nowrap" style={headerGroupStyles}>
          <Group gap="md" wrap="nowrap" style={headerInnerGroupStyles}>
            {/* 4×15px gradient tick bar (Command section-header motif) */}
            <Box style={tickBarStyles} />

            {/* Optional icon - navy-tinted deck chip */}
            {Icon && (
              <Box style={iconContainerStyles}>
                <Icon size={iconSize} color="var(--emr-modal-icon-color)" />
              </Box>
            )}

            {/* Title & Subtitle */}
            <Box style={titleContainerStyles}>
              <Text
                id={titleId}
                fw={600}
                size="md"
                c="var(--emr-text-primary)"
                style={titleStyles}
                truncate
                role="heading"
                aria-level={2}
              >
                {title}
              </Text>
              {subtitle && (
                typeof subtitle === 'string' ? (
                  <Text
                    size="xs"
                    c="var(--emr-text-secondary)"
                    mt={2}
                    truncate
                    style={subtitleStyles}
                  >
                    {subtitle}
                  </Text>
                ) : (
                  <Box mt={2}>{subtitle}</Box>
                )
              )}
            </Box>
          </Group>

          {/* Close button - touch-friendly (44px on mobile) */}
          {withCloseButton && (
            <Box
              component="button"
              type="button"
              onClick={onClose}
              style={closeButtonStyles}
              aria-label={t('common.close')}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--emr-bg-hover)';
                e.currentTarget.style.color = 'var(--emr-text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--emr-text-secondary)';
              }}
            >
              <IconX size={16} strokeWidth={1.5} aria-hidden="true" />
            </Box>
          )}
        </Group>
      </Box>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          BODY - Clean with subtle warmth (scrollable on mobile)
          ═══════════════════════════════════════════════════════════════ */}
      <Box style={bodyStyles} className={bodyClassName}>
        {isProcessing && (
          <>
            <LoadingOverlay
              visible
              zIndex={100}
              overlayProps={{ radius: 'sm', blur: 2 }}
              loaderProps={{ type: 'bars', size: 'md' }}
            />
            <Box
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, calc(-50% + 40px))',
                zIndex: 101,
                textAlign: 'center',
              }}
            >
              <Text size="sm" c="var(--emr-text-secondary)">{processingMessage}</Text>
            </Box>
          </>
        )}
        {children}
      </Box>

      {/* ═══════════════════════════════════════════════════════════════
          FOOTER - Sticky on mobile with safe area padding
          ═══════════════════════════════════════════════════════════════ */}
      {shouldShowFooter && (
        <Box style={footerStyles}>
          {footer ?? (
            <Group justify={isFullScreen ? 'stretch' : 'flex-end'} gap="sm" grow={isFullScreen}>
              <EMRButton
                variant="secondary"
                size={isFullScreen ? 'md' : 'sm'}
                onClick={onClose}
                disabled={submitLoading}
                style={mobileButtonStyles}
              >
                {cancelLabel || t('common.cancel')}
              </EMRButton>
              {onSubmit && (
                <EMRButton
                  variant="primary"
                  size={isFullScreen ? 'md' : 'sm'}
                  onClick={onSubmit}
                  loading={submitLoading}
                  disabled={submitDisabled}
                  icon={submitLoading ? undefined : SubmitIcon}
                  style={mobileButtonStyles}
                >
                  {submitLabel || t('common.save')}
                </EMRButton>
              )}
            </Group>
          )}
        </Box>
      )}
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   EMRModalSection - Elegant form grouping with subtle visual hierarchy
   ═══════════════════════════════════════════════════════════════════════════ */

export interface EMRModalSectionProps {
  title: ReactNode;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'accent' | 'muted';
  icon?: ComponentType<{ size: number; color?: string }>;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export function EMRModalSection({
  title,
  children,
  variant = 'primary',
  icon: SectionIcon,
}: EMRModalSectionProps): React.ReactElement {
  const primaryStyle: { accent: string; bg: string; border: string } = {
    accent: 'var(--emr-primary)',
    bg: 'var(--emr-gradient-subtle-primary)',
    border: 'var(--emr-border-default)',
  };
  const variantMap: Record<string, { accent: string; bg: string; border: string }> = {
    primary: primaryStyle,
    secondary: {
      accent: 'var(--emr-secondary)',
      bg: 'var(--emr-gradient-subtle-secondary)',
      border: 'var(--emr-border-default)',
    },
    accent: {
      accent: 'var(--emr-accent)',
      bg: 'var(--emr-gradient-subtle-accent)',
      border: 'var(--emr-border-default)',
    },
    muted: {
      accent: 'var(--emr-text-secondary)',
      bg: 'var(--emr-bg-page)',
      border: 'var(--emr-border-default)',
    },
  };
  const styles = variantMap[variant] || primaryStyle;

  return (
    <Box
      style={{
        background: styles.bg,
        borderRadius: 10,
        padding: '18px 20px',
        border: `1px solid ${styles.border}`,
        marginBottom: 16,
      }}
    >
      {/* Section header */}
      <Group gap={10} mb={16}>
        {/* Accent line */}
        <Box
          style={{
            width: 3,
            height: 16,
            borderRadius: 2,
            background: styles.accent,
          }}
        />

        {/* Optional icon */}
        {SectionIcon && (
          <Box
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: styles.accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SectionIcon size={12} color="var(--emr-bg-card)" />
          </Box>
        )}

        <Text
          component="div"
          size="xs"
          fw={600}
          c="var(--emr-text-primary)"
          style={{
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {title}
        </Text>
      </Group>

      {children}
    </Box>
  );
}
