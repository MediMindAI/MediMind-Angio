/**
 * useAnatomyColors — derives {fill, stroke} colors from Competency values.
 *
 * Wraps the COMPETENCY_COLORS constant from theme-colors.ts so consumers
 * don't need to import it directly. The hook form lets us expand later
 * (e.g. dark-mode-aware overrides) without touching callers.
 */

import type { Competency } from '../../types/anatomy';
import { COMPETENCY_COLORS } from '../../constants/theme-colors';

export type CompetencyColorMap = typeof COMPETENCY_COLORS;

/**
 * Hook form — returns the full competency-to-colors map. Use for legends
 * or when you need to iterate over all competencies.
 */
export function useAnatomyColors(): CompetencyColorMap {
  return COMPETENCY_COLORS;
}

/**
 * Pure helper — returns `{ fill, stroke }` for a specific competency.
 * Safe outside React (used from `AnatomyView` during SVG injection).
 */
export function colorForCompetency(
  competency: Competency,
): { fill: string; stroke: string } {
  return COMPETENCY_COLORS[competency];
}
