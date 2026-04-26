// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Modal, Box, Group, Text, LoadingOverlay } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconX, IconDeviceFloppy } from '@tabler/icons-react';
import type { ReactNode, ComponentType, CSSProperties } from 'react';
import { useMemo } from 'react';
import { EMRButton } from './EMRButton';
import { useTranslation } from '../../contexts/TranslationContext';

/** T-shirt size options for modal width */
export type EMRModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

const sizePixelMap: Record<EMRModalSize, number | string> = {
  sm: 580,
  md: 780,
  lg: 980,
  xl: 1200,
  xxl: '95vw',
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
  xxl: 'calc(92vh - 140px)',
};

/* ─────────────────────────────────────────────────────────────────────────
   Module-level style constants — hoisted out of the component because they
   depend on nothing in render scope. Recomputing them per-render via
   `useMemo(..., [])` allocates a fresh object on every modal mount, which
   defeats memoization downstream. (Wave 4.5 — Area 06 MEDIUM.)
   ───────────────────────────────────────────────────────────────────────── */

const MODAL_BODY_STYLES: CSSProperties = {
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
};

const NOISE_TEXTURE_STYLES: CSSProperties = {
  position: 'absolute',
  inset: 0,
  opacity: 0.03,
  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
  pointerEvents: 'none',
};

const HIGHLIGHT_LINE_STYLES: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 24,
  right: 24,
  height: 1,
  background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
  pointerEvents: 'none',
};

const TITLE_STYLES: CSSProperties = {
  letterSpacing: '-0.01em',
  lineHeight: 'var(--emr-line-height-snug)',
};

const HEADER_GROUP_STYLES: CSSProperties = {
  position: 'relative',
};

const HEADER_INNER_GROUP_STYLES: CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const TITLE_CONTAINER_STYLES: CSSProperties = {
  minWidth: 0,
  flex: 1,
};

const SUBTITLE_STYLES: CSSProperties = {
  letterSpacing: '0.01em',
};

export interface EMRModalProps {
  opened: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: EMRModalSize;
  icon?: ComponentType<{ size?: number | string; color?: string }>;
  subtitle?: string | ReactNode;
  footer?: ReactNode;
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
}

/**
 * EMRModal - Premium Medical Interface Modal
 *
 * Refined, professional aesthetic for healthcare applications.
 * Features elegant gradients, subtle depth, and polished interactions.
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
}: EMRModalProps): React.ReactElement {
  const { t } = useTranslation();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isFullScreen = forceFullScreen || isMobile;

  const sizePixels = isFullScreen ? '100%' : sizePixelMap[size];
  const iconSize = iconSizeMap[size];
  const iconContainerSize = isMobile ? 40 : iconContainerSizeMap[size];
  const minBodyHeight = minBodyHeightMap[size];
  const shouldShowFooter = showFooter ?? (footer !== undefined || onSubmit !== undefined);
  const isProcessing = submitLoading && !!processingMessage;

  const mobileContentStyles = useMemo<CSSProperties>(() =>
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
          boxShadow: 'var(--emr-shadow-xl)',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
        },
    [isFullScreen]
  );

  const headerStyles = useMemo<CSSProperties>(() => ({
    padding: isFullScreen ? '16px 16px' : '20px 24px',
    background: 'var(--emr-gradient-primary)',
    position: isFullScreen ? 'sticky' : 'relative',
    top: 0,
    borderLeft: isFullScreen ? 'none' : '4px solid var(--emr-accent)',
    boxShadow: 'inset 0 -1px 0 rgba(255, 255, 255, 0.1), 0 2px 8px rgba(0, 0, 0, 0.15)',
    flexShrink: 0,
    zIndex: 10,
    paddingTop: isMobile ? 'max(16px, env(safe-area-inset-top))' : '20px',
  }), [isFullScreen, isMobile]);

  const iconContainerStyles = useMemo<CSSProperties>(() => ({
    width: iconContainerSize,
    height: iconContainerSize,
    minWidth: iconContainerSize,
    borderRadius: 10,
    background: 'var(--emr-glass-bg)',
    backdropFilter: 'blur(8px)',
    border: '1px solid var(--emr-glass-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'var(--emr-shadow-sm)',
  }), [iconContainerSize]);

  const closeButtonStyles = useMemo<CSSProperties>(() => ({
    width: isMobile ? 44 : 36,
    height: isMobile ? 44 : 36,
    minWidth: isMobile ? 44 : 36,
    minHeight: isMobile ? 44 : 36,
    borderRadius: isMobile ? 12 : 8,
    border: 'none',
    background: 'var(--emr-white-alpha-10)',
    color: 'var(--emr-text-inverse)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  }), [isMobile]);

  const bodyStyles = useMemo<CSSProperties>(() => ({
    paddingTop: isFullScreen ? '16px' : '24px',
    paddingRight: isFullScreen ? '16px' : '24px',
    paddingLeft: isFullScreen ? '16px' : '24px',
    paddingBottom: isMobile ? 'max(16px, env(safe-area-inset-bottom))' : (isFullScreen ? '16px' : '24px'),
    background: 'var(--emr-bg-card)',
    minHeight: isFullScreen ? 0 : (typeof minBodyHeight === 'number' ? minBodyHeight : 200),
    flex: 1,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    position: 'relative',
  }), [isFullScreen, isMobile, minBodyHeight]);

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

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size={sizePixels}
      centered={!isMobile && !forceFullScreen}
      fullScreen={forceFullScreen || isMobile}
      closeOnClickOutside={isProcessing ? false : closeOnClickOutside}
      closeOnEscape={isProcessing ? false : closeOnEscape}
      trapFocus={trapFocus}
      withCloseButton={false}
      padding={0}
      zIndex={zIndex}
      radius={isFullScreen ? 0 : 12}
      overlayProps={{
        backgroundOpacity: isFullScreen ? 0 : 0.35,
        blur: isFullScreen ? 0 : 12,
      }}
      transitionProps={{
        transition: isFullScreen ? 'slide-up' : 'fade',
        duration: 180,
      }}
      styles={{
        content: mobileContentStyles,
        body: MODAL_BODY_STYLES,
      }}
      data-testid={testId}
    >
      {/* Header */}
      <Box style={headerStyles}>
        <Box style={NOISE_TEXTURE_STYLES} />
        <Box style={HIGHLIGHT_LINE_STYLES} />

        <Group justify="space-between" align="center" wrap="nowrap" style={HEADER_GROUP_STYLES}>
          <Group gap="md" wrap="nowrap" style={HEADER_INNER_GROUP_STYLES}>
            {Icon && (
              <Box style={iconContainerStyles}>
                <Icon size={iconSize} color="var(--emr-text-inverse)" />
              </Box>
            )}

            <Box style={TITLE_CONTAINER_STYLES}>
              <Text
                fw={500}
                size="md"
                c="var(--emr-text-inverse)"
                style={TITLE_STYLES}
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
                    c="var(--emr-text-inverse-secondary)"
                    mt={2}
                    truncate
                    style={SUBTITLE_STYLES}
                  >
                    {subtitle}
                  </Text>
                ) : (
                  <Box mt={2}>{subtitle}</Box>
                )
              )}
            </Box>
          </Group>

          {withCloseButton && (
            <Box
              component="button"
              type="button"
              onClick={onClose}
              style={closeButtonStyles}
              aria-label={t('common.close', 'Close')}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--emr-white-alpha-20)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--emr-white-alpha-10)';
              }}
            >
              <IconX size={16} strokeWidth={1.5} aria-hidden="true" />
            </Box>
          )}
        </Group>
      </Box>

      {/* Body */}
      <Box style={bodyStyles}>
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

      {/* Footer */}
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
    </Modal>
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
  const variantMap: Record<string, { accent: string; bg: string; border: string }> = {
    primary: {
      accent: 'var(--emr-primary)',
      bg: 'var(--emr-gradient-subtle-primary)',
      border: 'var(--emr-border-default)',
    },
    secondary: {
      accent: 'var(--emr-secondary)',
      bg: 'var(--emr-gradient-subtle-primary)',
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
  const styles = variantMap[variant] ?? variantMap.primary!;

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
      <Group gap={10} mb={16}>
        <Box
          style={{
            width: 3,
            height: 16,
            borderRadius: 2,
            background: styles.accent,
          }}
        />

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
