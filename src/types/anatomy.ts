/**
 * Anatomy types — segments, sides, and competency states.
 *
 * A *segment* is a named anatomical region on a vascular diagram (e.g. the
 * great saphenous vein in the thigh). Each study type owns its own list of
 * segments, which is why `SegmentId` is a plain `string` rather than an
 * enum — the allowed values are determined by the `StudyType`.
 *
 * *Competency* describes the clinical state of a venous segment:
 *   - Normal       — continent / filled black in diagrams
 *   - Ablated      — previously treated / hollow with outline
 *   - Incompetent  — reflux present / filled red
 *   - Inconclusive — insufficient data / filled gray
 *
 * For arterial studies, competency is reinterpreted as stenosis severity
 * via the `ArterialStenosis` grade, but the underlying `Competency` shape
 * is reused for the diagram overlay (see pdfTheme competency colors).
 */

/** Laterality — which side of the body the finding applies to. */
export type Side = 'left' | 'right' | 'bilateral' | 'midline';

/**
 * A segment identifier. Opaque string keyed by the study config.
 * Example values: "gsv-thigh", "ssv", "cfv", "ata-right", "ccr-left".
 */
export type SegmentId = string;

/**
 * Clinical state for a venous segment (and generic state used by every
 * diagram overlay). One canonical palette lives in
 * `src/constants/theme-colors.ts` (`COMPETENCY_COLORS`) and is consumed
 * by:
 *   - the on-screen overlay (`overlayStrokeFor` in AnatomyView.tsx),
 *   - the segment-table competency dropdown,
 *   - `pdfTheme.ts` for the printed report,
 *   - the freehand drawing toolbar palette (so a pen colour and a
 *     template-applied colour mean the same thing).
 *
 *   - normal       — patent, blue
 *   - occluded     — thrombus / non-compressible vein, red
 *   - incompetent  — reflux, amber
 *   - inconclusive — insufficient data, gray
 *   - ablated      — post-procedural, green
 */
export type Competency = 'normal' | 'occluded' | 'incompetent' | 'inconclusive' | 'ablated';

/**
 * Arterial stenosis grade — NASCET-style categories used for carotid and
 * peripheral arterial studies. These map to the `Competency` palette for
 * diagram coloring (normal -> normal, mild -> inconclusive, etc.) but
 * retain their own semantic label in reports.
 */
export type ArterialStenosis =
  | 'normal'
  | 'mild' // <50%
  | 'moderate' // 50-69%
  | 'severe' // 70-99%
  | 'occluded';

/**
 * Per-segment finding captured from the clinician.
 *
 * `reflux.durationMs` is stored in milliseconds (UCUM `ms`) to avoid the
 * floating-point accumulation risk of storing seconds. Diameter is stored
 * in millimeters (UCUM `mm`) as an integer * 10 would be overkill for the
 * precision typically reported (0.1 mm).
 */
export interface SegmentState {
  readonly segmentId: SegmentId;
  readonly side: Side;
  readonly competency: Competency;
  /** Optional arterial grade for arterial studies. */
  readonly stenosis?: ArterialStenosis;
  /** Peak reflux duration in milliseconds (UCUM `ms`). */
  readonly refluxDurationMs?: number;
  /** Vessel diameter in millimeters (UCUM `mm`). */
  readonly diameterMm?: number;
  /** Peak systolic velocity in cm/s (UCUM `cm/s`). */
  readonly peakSystolicVelocityCmS?: number;
  /** Free-text note from the reader. */
  readonly note?: string;
}
