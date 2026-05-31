// SPDX-License-Identifier: Apache-2.0
/**
 * Shared 5-band stenosis-severity → diagram color + legend helpers.
 *
 * Carotid and arterial-LE both color their anatomy diagrams with the same
 * traffic-light scale (`SEVERITY_COLORS`: green → amber → orange → red →
 * dark-red) and build an identical under-diagram legend. These helpers are the
 * single source so the two studies stay in lock-step; previously each inlined
 * its own copy (`carotidBandColor` + an in-place legend builder).
 */

import { SEVERITY_COLORS, type Severity } from '../../constants/theme-colors';
import type { AnatomyLegendItem } from './AnatomyLegend';

/** Severity band → diagram `{fill, stroke}` (strips any extra palette keys). */
export function severityBandColor(band: Severity): { fill: string; stroke: string } {
  const c = SEVERITY_COLORS[band];
  return { fill: c.fill, stroke: c.stroke };
}

/**
 * The 5 severity bands as legend entries, each labeled via `t(${prefix}.${band})`
 * and colored by the same `severityBandColor` the vessels use, so legend ↔
 * diagram always agree. `prefix` is e.g. `'carotid.severity'` or
 * `'arterialLE.severity'`.
 */
export function severityLegendItems(
  t: (key: string, fallback?: string) => string,
  prefix: string,
): ReadonlyArray<AnatomyLegendItem> {
  return (['normal', 'mild', 'moderate', 'severe', 'occluded'] as const).map((band) => ({
    key: band,
    label: t(`${prefix}.${band}`, band),
    ...severityBandColor(band),
  }));
}
