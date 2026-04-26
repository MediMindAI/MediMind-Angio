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
 *
 * Falls back to the `inconclusive` palette for any value outside the
 * 4-state `Competency` enum. A stale draft, a renamed enum after a
 * schema migration, or a hand-edited localStorage payload would
 * otherwise return `undefined` and crash the destructure on the
 * caller side, unmounting the entire study form (Area 01 CRITICAL).
 */
export function colorForCompetency(
  competency: Competency,
): { fill: string; stroke: string } {
  const colors = COMPETENCY_COLORS[competency];
  if (!colors) {
    // eslint-disable-next-line no-console
    console.warn('[anatomy] unknown competency value, falling back to inconclusive:', competency);
    return COMPETENCY_COLORS.inconclusive;
  }
  return colors;
}
