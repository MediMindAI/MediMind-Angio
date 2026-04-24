// SPDX-License-Identifier: Apache-2.0
/**
 * StudyPlugin — the per-study registration shape.
 *
 * A StudyPlugin describes everything the shell / landing / router needs to
 * know about a vascular study: its FormComponent, route, and display
 * metadata. It deliberately does NOT include deep integration points
 * (narrative generation, FHIR-builder dispatch, PDF section rendering)
 * because those still branch on `studyType` in places where the parameter
 * shape varies meaningfully per study. Consolidating those would force
 * lossy generic signatures.
 *
 * Adding a 4th study means:
 *   1. Add the plugin entry in `components/studies/index.ts`
 *   2. (Eventually) add per-study branches to the FHIR builder, PDF
 *      document, and narrative service.
 *
 * Step 1 alone now gets you routing + landing-card rendering for free.
 */

import type { ComponentType } from 'react';

/**
 * Icon component shape as rendered on StudyPicker cards. Matches the
 * @tabler/icons-react signature subset we depend on.
 */
export interface StudyIconProps {
  readonly size?: number | string;
  readonly stroke?: number;
}

export interface StudyPlugin {
  /**
   * Unique key. Matches the translation prefix under `studies.*` in the
   * locale JSON files (e.g. `venousLE` → `studies.venousLE.title`).
   */
  readonly key: string;

  /**
   * Route path — used by both the minimal router in App.tsx and the
   * StudyPicker card click handler. Optional for studies that aren't
   * routable yet (coming-soon cards).
   */
  readonly route: string | null;

  /**
   * When `false`, the landing card is shown as disabled / "coming soon"
   * and the route is not wired.
   */
  readonly available: boolean;

  /** Icon shown on the landing card + (optionally) in nav chrome. */
  readonly icon: ComponentType<StudyIconProps>;

  /**
   * Top-level form component to render when the user navigates to this
   * study's route. Optional for unavailable studies — such plugins
   * contribute to the picker only.
   */
  readonly FormComponent?: ComponentType;

  /**
   * Translation key prefix. e.g. `studies.venousLE` implies the
   * `.title` / `.description` / `.short` sub-keys are read from the
   * locale JSON.
   */
  readonly translationKey: string;
}
