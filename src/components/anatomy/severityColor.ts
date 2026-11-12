// SPDX-License-Identifier: Apache-2.0
/**
 * Shared 5-band stenosis-severity → diagram color + legend helpers.
 *
 * Carotid and arterial-LE both color their anatomy diagrams with the same
 * scale (`SEVERITY_COLORS`: grey = normal, red = significant stenosis,
 * black = occlusion) and build an identical under-diagram legend. These helpers are the
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
 * The 3 diagram colors as legend entries — normal (grey), hemodynamically
 * significant stenosis (red), occlusion (black) — labeled via
 * `t(${prefix}.${key})` and colored by the same `severityBandColor` the vessels
 * use, so legend ↔ diagram always agree. `prefix` is e.g.
 * `'carotid.severity'` or `'arterialLE.severity'`.
 */
export function severityLegendItems(
  t: (key: string, fallback?: string) => string,
  prefix: string,
): ReadonlyArray<AnatomyLegendItem> {
  const entries: ReadonlyArray<{ key: string; band: Severity; fallback: string }> = [
    { key: 'normal', band: 'normal', fallback: 'Normal' },
    { key: 'significant', band: 'severe', fallback: 'Hemodynamically significant stenosis' },
    { key: 'occluded', band: 'occluded', fallback: 'Occlusion' },
  ];
  return entries.map(({ key, band, fallback }) => ({
    key,
    label: t(`${prefix}.${key}`, fallback),
    ...severityBandColor(band),
  }));
}

/**
 * Click-to-cycle step for the diagram: walks the 3 visible colors
 * grey → red → black → grey. Bands that share a color collapse first
 * (mild reads as grey, severe as red), so every click visibly changes the
 * vessel. A manual red paint is stored as `moderate` — the lowest
 * hemodynamically significant band (≥ 50 %).
 */
export function nextSeverityBand(current: Severity): Severity {
  if (current === 'occluded') return 'normal';
  if (current === 'moderate' || current === 'severe') return 'occluded';
  return 'moderate';
}
