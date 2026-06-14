// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Paper, Group, Stack, Text, Skeleton, UnstyledButton, Box, Progress, useMantineColorScheme } from '@mantine/core';
import { IconTrendingUp, IconTrendingDown, IconMinus } from '@tabler/icons-react';
import type { ComponentType } from 'react';
import { useState, useMemo, memo } from 'react';

/** Icon props type for Tabler icons */
interface IconProps {
  size?: number | string;
  stroke?: number;
  color?: string;
}

export type EMRStatCardVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';

/** Visual style mode for different backgrounds */
export type EMRStatCardMode = 'default' | 'hero' | 'outlined';

/** Sparkline data point */
export interface SparklineDataPoint {
  value: number;
  timestamp?: Date | string;
}

/** Size presets for stat cards - provides responsive sizing */
export type EMRStatCardSize = 'xs' | 'sm' | 'md' | 'lg';

/** Size configuration for different breakpoints */
interface SizeConfig {
  iconSize: number;
  iconContainerSize: number;
  fontSize: string;
  labelSize: string;
  padding: string;
  sparklineHeight: number;
  gap: number;
}

const sizeConfigs: Record<EMRStatCardSize, SizeConfig> = {
  xs: { iconSize: 16, iconContainerSize: 32, fontSize: 'var(--emr-font-2xl)', labelSize: 'var(--emr-font-xs)', padding: 'xs', sparklineHeight: 20, gap: 4 },
  sm: { iconSize: 18, iconContainerSize: 36, fontSize: 'var(--emr-font-3xl)', labelSize: 'var(--emr-font-xs)', padding: 'sm', sparklineHeight: 24, gap: 6 },
  md: { iconSize: 22, iconContainerSize: 44, fontSize: 'var(--emr-font-5xl)', labelSize: 'var(--emr-font-xs)', padding: 'md', sparklineHeight: 32, gap: 8 },
  lg: { iconSize: 26, iconContainerSize: 52, fontSize: 'var(--emr-font-6xl)', labelSize: 'var(--emr-font-sm)', padding: 'lg', sparklineHeight: 40, gap: 10 },
};

export interface EMRStatCardProps {
  icon: ComponentType<IconProps>;
  value: number | string;
  label: string;
  /** Optional badge text (e.g., "FREE", "NEW") */
  badge?: string;
  trend?: {
    value: string;
    direction: 'up' | 'down' | 'neutral';
  };
  variant?: EMRStatCardVariant;
  /** Visual mode: default (card bg), hero (glass for gradient bg), outlined */
  mode?: EMRStatCardMode;
  /** Size preset: xs, sm, md, lg (default: md) */
  size?: EMRStatCardSize;
  /** Progress bar value (0-100) */
  progress?: number;
  loading?: boolean;
  onClick?: () => void;
  active?: boolean;
  /** @deprecated Use size="sm" instead. Compact size for dense layouts */
  compact?: boolean;
  /** Sparkline data for mini-graph visualization */
  sparklineData?: SparklineDataPoint[] | number[];
  /** Sparkline height in pixels (default: based on size) */
  sparklineHeight?: number;
  /** Show sparkline area fill (default: true) */
  sparklineFill?: boolean;
  /** Optional subtitle for additional context */
  subtitle?: string;
  'data-testid'?: string;
}

// Premium color map for each variant
const variantColorMap: Record<EMRStatCardVariant, string> = {
  primary: 'var(--emr-primary)',
  secondary: 'var(--emr-secondary)',
  success: 'var(--emr-success)',
  warning: 'var(--emr-warning)',
  error: 'var(--emr-error)',
  info: 'var(--emr-info)',
};

// Light mode: Premium gradient backgrounds for icon containers
const variantIconGradientMapLight: Record<EMRStatCardVariant, string> = {
  primary: 'var(--emr-icon-gradient-primary)',
  secondary: 'var(--emr-icon-gradient-secondary)',
  success: 'var(--emr-icon-gradient-success)',
  warning: 'var(--emr-icon-gradient-warning)',
  error: 'var(--emr-icon-gradient-error)',
  info: 'var(--emr-icon-gradient-info)',
};

// Dark mode: Premium gradient backgrounds for icon containers
const variantIconGradientMapDark: Record<EMRStatCardVariant, string> = {
  primary: 'var(--emr-icon-bg-blue)',
  secondary: 'var(--emr-icon-bg-info)',
  success: 'var(--emr-icon-bg-success)',
  warning: 'var(--emr-icon-bg-warning)',
  error: 'var(--emr-icon-bg-error)',
  info: 'var(--emr-icon-bg-info)',
};

// Light mode: Visible card backgrounds per variant - solid tints
const variantCardBgMapLight: Record<EMRStatCardVariant, string> = {
  primary: 'var(--emr-stat-card-bg)',
  secondary: 'var(--emr-stat-card-bg)',
  success: 'var(--emr-stat-card-bg)',
  warning: 'var(--emr-stat-card-bg)',
  error: 'var(--emr-stat-card-bg)',
  info: 'var(--emr-stat-card-bg)',
};

// Dark mode: Subtle card background gradients per variant
const variantCardBgMapDark: Record<EMRStatCardVariant, string> = {
  primary: 'var(--emr-stat-bg-primary)',
  secondary: 'var(--emr-stat-bg-secondary)',
  success: 'var(--emr-stat-bg-success)',
  warning: 'var(--emr-stat-bg-warning)',
  error: 'var(--emr-stat-bg-error)',
  info: 'var(--emr-stat-bg-info)',
};

// Light mode: Left accent border colors per variant
const variantAccentMapLight: Record<EMRStatCardVariant, string> = {
  primary: 'var(--emr-accent-line-primary)',
  secondary: 'var(--emr-accent-line-secondary)',
  success: 'var(--emr-accent-line-success)',
  warning: 'var(--emr-accent-line-warning)',
  error: 'var(--emr-accent-line-error)',
  info: 'var(--emr-accent-line-info)',
};

// Dark mode: Left accent border colors per variant (glowing accents)
const variantAccentMapDark: Record<EMRStatCardVariant, string> = {
  primary: 'var(--emr-accent-line-blue)',
  secondary: 'var(--emr-accent-line-info)',
  success: 'var(--emr-accent-line-success)',
  warning: 'var(--emr-accent-line-warning)',
  error: 'var(--emr-accent-line-error)',
  info: 'var(--emr-accent-line-info)',
};

// Sparkline stroke colors per variant
const variantSparklineStrokeMap: Record<EMRStatCardVariant, string> = {
  primary: 'var(--emr-sparkline-stroke-primary)',
  secondary: 'var(--emr-sparkline-stroke-secondary)',
  success: 'var(--emr-sparkline-stroke-success)',
  warning: 'var(--emr-sparkline-stroke-warning)',
  error: 'var(--emr-sparkline-stroke-error)',
  info: 'var(--emr-sparkline-stroke-info)',
};

// Sparkline fill colors per variant
const variantSparklineFillMap: Record<EMRStatCardVariant, string> = {
  primary: 'var(--emr-sparkline-fill-primary)',
  secondary: 'var(--emr-sparkline-fill-secondary)',
  success: 'var(--emr-sparkline-fill-success)',
  warning: 'var(--emr-sparkline-fill-warning)',
  error: 'var(--emr-sparkline-fill-error)',
  info: 'var(--emr-sparkline-fill-info)',
};

/** Inline Sparkline SVG component */
interface SparklineProps {
  data: number[];
  height: number;
  strokeColor: string;
  fillColor: string;
  showFill: boolean;
  isHero?: boolean;
}

function Sparkline({ data, height, strokeColor, fillColor, showFill, isHero = false }: SparklineProps): React.ReactElement | null {
  if (!data || data.length < 2) {
    return null;
  }

  const width = 100; // SVG viewBox width (percentage-based)
  const padding = 2;
  const effectiveWidth = width - padding * 2;
  const effectiveHeight = height - padding * 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Generate path points
  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * effectiveWidth;
    const y = padding + effectiveHeight - ((value - min) / range) * effectiveHeight;
    return { x, y };
  });

  // Create SVG path
  const linePath = points.map((point, i) => (i === 0 ? `M ${point.x},${point.y}` : `L ${point.x},${point.y}`)).join(' ');

  // Create fill path (closed area below line)
  const lastPoint = points[points.length - 1];
  const areaPath = showFill && lastPoint
    ? `${linePath} L ${lastPoint.x},${height - padding} L ${padding},${height - padding} Z`
    : '';

  const finalStrokeColor = isHero ? 'var(--emr-text-inverse-secondary)' : strokeColor;
  const finalFillColor = isHero ? 'var(--emr-glass-white-15)' : fillColor;

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ display: 'block' }}
      aria-hidden="true"
    >
      {showFill && <path d={areaPath} fill={finalFillColor} />}
      <path d={linePath} fill="none" stroke={finalStrokeColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const EMRStatCard = memo(function EMRStatCard({
  icon: IconComponent,
  value,
  label,
  badge,
  trend,
  variant = 'primary',
  mode = 'default',
  size,
  progress,
  loading = false,
  onClick,
  active = false,
  compact = false,
  sparklineData,
  sparklineHeight: customSparklineHeight,
  sparklineFill = true,
  subtitle,
  'data-testid': dataTestId = 'emr-stat-card',
}: EMRStatCardProps): React.ReactElement {
  const [isHovered, setIsHovered] = useState(false);
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const isClickable = !!onClick;
  const variantColor = variantColorMap[variant];
  const isHero = mode === 'hero';

  // Command identity: big value typography — navy (var(--emr-primary)) in light,
  // text-primary in dark; inverse on hero/gradient backgrounds.
  const valueColor = isHero
    ? 'var(--emr-text-inverse)'
    : isDark
      ? 'var(--emr-text-primary)'
      : 'var(--emr-primary)';

  // Command identity: 3px gradient TOP ribbon; error/critical variant = error ribbon.
  const ribbonBackground =
    variant === 'error' ? 'var(--emr-gradient-error)' : 'var(--emr-gradient-primary)';

  // Resolve size: explicit size prop > compact prop (deprecated) > default 'md'
  const resolvedSize: EMRStatCardSize = size ?? (compact ? 'sm' : 'md');
  const sizeConfig = sizeConfigs[resolvedSize];
  const sparklineHeight = customSparklineHeight ?? sizeConfig.sparklineHeight;

  // Normalize sparkline data to number array
  const normalizedSparklineData = useMemo(() => {
    if (!sparklineData || sparklineData.length < 2) {
      return null;
    }
    return sparklineData.map((point) => (typeof point === 'number' ? point : point.value));
  }, [sparklineData]);

  // Select theme-appropriate maps
  const variantIconGradientMap = isDark ? variantIconGradientMapDark : variantIconGradientMapLight;
  const variantCardBgMap = isDark ? variantCardBgMapDark : variantCardBgMapLight;
  const variantAccentMap = isDark ? variantAccentMapDark : variantAccentMapLight;

  const formattedValue = typeof value === 'number' ? value.toLocaleString() : value;

  const handleKeyDown = (event: React.KeyboardEvent): void => {
    if (isClickable && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onClick?.();
    }
  };

  const getTrendIcon = (): React.ReactElement | null => {
    if (!trend) {return null;}

    const getTrendColor = (): string => {
      // In hero mode, use white/light colors for better contrast on gradient background
      if (isHero) {
        if (trend.direction === 'up') {return 'var(--emr-success-light)';}
        if (trend.direction === 'down') {return 'var(--emr-error-light)';}
        return 'var(--emr-text-inverse-secondary)';
      }
      if (trend.direction === 'up') {return 'var(--emr-success)';}
      if (trend.direction === 'down') {return 'var(--emr-error)';}
      return 'var(--emr-text-secondary)';
    };
    const trendColor = getTrendColor();

    const getTrendIconComponent = (): typeof IconTrendingUp => {
      if (trend.direction === 'up') {return IconTrendingUp;}
      if (trend.direction === 'down') {return IconTrendingDown;}
      return IconMinus;
    };
    const TrendIcon = getTrendIconComponent();

    return (
      <Group gap={4} data-testid={`${dataTestId}-trend`}>
        <TrendIcon size={16} color={trendColor} />
        <Text size="xs" c={trendColor} fw={600}>
          {trend.value}
        </Text>
      </Group>
    );
  };

  const getAriaLabel = (): string => {
    let label_text = `${label}: ${formattedValue}`;
    if (trend) {
      label_text += `, trend ${trend.direction}: ${trend.value}`;
    }
    return label_text;
  };

  // Memoized container styles based on mode, variant, and theme
  const containerStyles = useMemo((): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      height: '100%',
      position: 'relative',
      overflow: 'hidden',
      borderRadius: '12px',
      transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
      cursor: isClickable ? 'pointer' : 'default',
    };

    if (isHero) {
      return {
        ...baseStyles,
        background: isHovered ? 'var(--emr-glass-white-15)' : 'var(--emr-glass-white-10)',
        border: '1px solid var(--emr-glass-border)',
        boxShadow: isHovered ? 'var(--emr-shadow-md)' : 'none',
      };
    }

    if (isDark) {
      // Premium dark mode styling
      if (mode === 'outlined') {
        return {
          ...baseStyles,
          background: 'var(--emr-card-surface-2)',
          border: isHovered ? '1px solid var(--emr-card-border-hover)' : '1px solid var(--emr-card-border-subtle)',
          boxShadow: isHovered
            ? 'var(--emr-shadow-card-dark-hover), var(--emr-card-inner-glow)'
            : 'var(--emr-card-inner-glow)',
        };
      }

      // Default dark mode with variant-specific background
      const getDarkBorder = (): string => {
        if (isHovered) {return '1px solid var(--emr-card-border-hover)';}
        if (active) {return '1px solid var(--emr-card-border-glow)';}
        return '1px solid var(--emr-card-border-subtle)';
      };
      return {
        ...baseStyles,
        background: `var(--emr-card-bg-gradient), ${variantCardBgMap[variant]}`,
        border: getDarkBorder(),
        boxShadow: isHovered
          ? 'var(--emr-shadow-card-dark-hover), var(--emr-card-inner-glow)'
          : 'var(--emr-shadow-card-dark), var(--emr-card-inner-glow)',
      };
    }

    // Light mode styling
    if (mode === 'outlined') {
      return {
        ...baseStyles,
        background: 'var(--emr-bg-card)',
        border: isHovered ? `1px solid ${variantColor}` : '1px solid var(--emr-border-color)',
        boxShadow: isHovered ? 'var(--emr-shadow-md)' : 'var(--emr-shadow-sm)',
      };
    }

    // Default mode - Command "deck": borderless card on a soft navy-tinted shadow.
    // Hover/active surface a navy border as an interaction affordance.
    const getLightBorder = (): string => {
      if (isHovered) {return '1px solid var(--emr-secondary)';}
      if (active) {return '1px solid var(--emr-primary)';}
      return '1px solid transparent';
    };
    return {
      ...baseStyles,
      backgroundColor: 'var(--emr-bg-card)',
      border: getLightBorder(),
      boxShadow: isHovered
        ? 'var(--emr-shadow-card-hover)'
        : 'var(--emr-shadow-card)',
    };
  }, [isClickable, isHero, isHovered, isDark, mode, variantCardBgMap, variant, active, variantColor]);

  // Memoized icon container styles
  const iconStyles = useMemo((): React.CSSProperties => {
    const iconContainerSize = sizeConfig.iconContainerSize;

    if (isHero) {
      return {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: iconContainerSize,
        height: iconContainerSize,
        minWidth: iconContainerSize, // Ensure minimum touch target
        minHeight: iconContainerSize,
        borderRadius: '10px',
        background: 'var(--emr-glass-white-15)',
        color: 'var(--emr-text-inverse)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        transform: isHovered ? 'scale(1.05)' : 'scale(1)',
      };
    }

    return {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: iconContainerSize,
      height: iconContainerSize,
      minWidth: Math.max(iconContainerSize, 44), // Ensure minimum 44px touch target
      minHeight: Math.max(iconContainerSize, 44),
      borderRadius: '10px',
      background: variantIconGradientMap[variant],
      border: isDark
        ? '1px solid var(--emr-glass-border)'
        : '1px solid var(--emr-accent-transparent)',
      color: variantColor,
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      transform: isHovered ? 'scale(1.05)' : 'scale(1)',
    };
  }, [sizeConfig.iconContainerSize, isHero, isHovered, variantIconGradientMap, variant, isDark, variantColor]);

  const content = (
    <Paper
      p={sizeConfig.padding as 'xs' | 'sm' | 'md' | 'lg'}
      radius={0}
      shadow={undefined}
      data-testid={isClickable ? undefined : dataTestId}
      data-emr-stat-card=""
      data-active={active}
      data-variant={variant}
      data-mode={mode}
      data-size={resolvedSize}
      aria-label={isClickable ? undefined : getAriaLabel()}
      style={containerStyles}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Command identity: 3px gradient TOP ribbon (error variant = error ribbon) */}
      {mode !== 'hero' && (
        <Box
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            right: 0,
            height: '3px',
            background: ribbonBackground,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Card content */}
      <Box pt={mode !== 'hero' ? 4 : 0}>
        {loading ? (
          <Stack gap="sm" data-testid={`${dataTestId}-skeleton`}>
            <Group justify="space-between">
              <Skeleton height={sizeConfig.iconContainerSize} width={sizeConfig.iconContainerSize} radius="md" />
              <Skeleton height={20} width={60} radius="sm" />
            </Group>
            <Skeleton height={resolvedSize === 'xs' || resolvedSize === 'sm' ? 28 : 36} width="50%" radius="sm" />
            <Skeleton height={14} width="70%" radius="sm" />
          </Stack>
        ) : (
          <Stack gap={sizeConfig.gap}>
            {/* Main row: Icon + Value/Label inline */}
            <Group gap="sm" align="center" wrap="nowrap">
              <Box style={iconStyles} data-testid={`${dataTestId}-icon`}>
                <IconComponent size={sizeConfig.iconSize} />
              </Box>
              <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                <Group gap="xs" align="baseline" wrap="nowrap">
                  <Text
                    fw={700}
                    c={valueColor}
                    data-testid={`${dataTestId}-value`}
                    style={{
                      fontSize: sizeConfig.fontSize,
                      lineHeight: 'var(--emr-line-height-none)',
                      letterSpacing: '-0.03em',
                      flexShrink: 0,
                    }}
                  >
                    {formattedValue}
                  </Text>
                  {badge && (
                    <Box
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: 'var(--emr-font-xs)',
                        fontWeight: 'var(--emr-font-bold)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.4px',
                        background: isHero
                          ? 'var(--emr-glass-white-20)'
                          : 'linear-gradient(135deg, var(--emr-bg-card) 0%, var(--emr-bg-page) 100%)',
                        border: isHero ? 'none' : '1px solid var(--emr-border-color)',
                        color: isHero ? 'var(--emr-text-inverse)' : 'var(--emr-text-secondary)',
                        flexShrink: 0,
                      }}
                    >
                      {badge}
                    </Box>
                  )}
                  {getTrendIcon()}
                </Group>
                <Text
                  fw={600}
                  c={isHero ? 'var(--emr-text-inverse-secondary)' : 'var(--emr-text-secondary)'}
                  data-testid={`${dataTestId}-label`}
                  style={{
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontSize: sizeConfig.labelSize,
                  }}
                >
                  {label}
                </Text>
                {subtitle && (
                  <Text
                    size="xs"
                    c={isHero ? 'var(--emr-text-inverse-secondary)' : 'var(--emr-text-secondary)'}
                    data-testid={`${dataTestId}-subtitle`}
                  >
                    {subtitle}
                  </Text>
                )}
              </Stack>
            </Group>
            {typeof progress === 'number' && (
              <Progress
                value={Math.min(100, Math.max(0, progress))}
                size={resolvedSize === 'xs' ? 4 : 6}
                radius="xl"
                color={isHero ? 'white' : undefined}
                styles={{
                  root: {
                    backgroundColor: isHero ? 'var(--emr-glass-white-20)' : 'var(--emr-bg-hover)',
                  },
                  section: {
                    background: isHero
                      ? 'linear-gradient(90deg, var(--emr-light-accent), var(--emr-text-inverse))'
                      : variantAccentMap[variant],
                  },
                }}
              />
            )}
            {normalizedSparklineData && (
              <Box data-testid={`${dataTestId}-sparkline`}>
                <Sparkline
                  data={normalizedSparklineData}
                  height={sparklineHeight}
                  strokeColor={variantSparklineStrokeMap[variant]}
                  fillColor={variantSparklineFillMap[variant]}
                  showFill={sparklineFill}
                  isHero={isHero}
                />
              </Box>
            )}
          </Stack>
        )}
      </Box>
    </Paper>
  );

  if (isClickable) {
    return (
      <UnstyledButton
        onClick={onClick}
        onKeyDown={handleKeyDown}
        style={{
          width: '100%',
          height: '100%',
          minHeight: 44, // Touch-friendly minimum height
          minWidth: 44, // Touch-friendly minimum width
        }}
        data-testid={dataTestId}
        data-active={active}
        data-variant={variant}
        data-size={resolvedSize}
        role="button"
        tabIndex={0}
        aria-label={getAriaLabel()}
      >
        {content}
      </UnstyledButton>
    );
  }

  return content;
});

/** Re-export size configs for programmatic access */
export { sizeConfigs as EMRStatCardSizeConfigs };
