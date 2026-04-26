// SPDX-License-Identifier: Apache-2.0
/**
 * EncounterStudyWrapper — Phase 3a route adapter for the encounter pivot.
 *
 * Mounts at `/encounter/:encounterId/:studyType` and serves three jobs:
 *   1. Validate URL params (both must be present + studyType must be a
 *      known `StudyType` member) — bounce to `/` on any failure.
 *   2. Confirm the encounter exists in the store AND that `studyType` is
 *      actually one of its `selectedStudyTypes` — prevents arbitrary URL
 *      access to studies the encounter never opted into.
 *   3. Render the matching study's `FormComponent` inside an
 *      `<EncounterProvider>` so the form (and any descendants) can read
 *      the encounter via `useEncounter()`.
 *
 * StudyType ↔ plugin.key matching scheme
 * --------------------------------------
 * `STUDY_PLUGINS` (Wave 2.2) uses coarse keys — `venousLE`, `arterialLE`,
 * `carotid`. The `StudyType` union is finer (`venousLEBilateral`,
 * `venousLERight`, `venousLELeft` all share a single `venousLE` plugin).
 *
 * We use scheme (a) from the Phase 3a brief: keep the precise `StudyType`
 * in the URL (so per-study forms can read laterality from the route or
 * from the encounter), and resolve `StudyType → plugin.key` via a small
 * `STUDY_TYPE_TO_PLUGIN_KEY` map in this file. Scheme (a) wins because
 * it leaves the existing plugin registry untouched while letting Phase 3b
 * forms surface laterality without a separate URL parameter.
 *
 * Adding a new study type means adding one entry to that map AND wiring
 * the form/plugin downstream — no change to the wrapper itself.
 *
 * Sync read on mount
 * ------------------
 * We use `loadEncounterSync` (localStorage) for the in-render guard so
 * the wrapper can decide redirect-vs-render without an async hop. The
 * `<EncounterProvider>` we mount immediately afterwards still does its
 * own async IDB refresh — the sync guard is purely a fast-path check
 * that the user isn't deep-linking into a stale URL.
 */

import { Navigate, useParams } from 'react-router-dom';
import { STUDY_PLUGINS } from './index';
import { EncounterProvider } from '../../contexts/EncounterContext';
import { loadEncounterSync } from '../../services/encounterStore';
import type { StudyType } from '../../types/study';

/**
 * Allow-list of `StudyType` values. Mirrors the discriminated union in
 * `types/study.ts`; updates there must be reflected here. Centralising
 * the string check keeps `useParams()`'s `string` widening from leaking
 * unsafe casts elsewhere in the file.
 */
const VALID_STUDY_TYPES: ReadonlySet<StudyType> = new Set<StudyType>([
  'venousLEBilateral',
  'venousLERight',
  'venousLELeft',
  'arterialLE',
  'carotid',
  'ivcDuplex',
]);

/**
 * Maps the URL's `StudyType` to the coarse `STUDY_PLUGINS.key` whose
 * `FormComponent` should render. See header comment for rationale.
 *
 * NOTE: `ivcDuplex` is in `StudyType` (Phase 0 catalog) but has no plugin
 * yet — leaving it out causes the wrapper to fall through to the
 * `plugin not found` redirect, which is the correct behaviour until a
 * plugin entry is added.
 */
const STUDY_TYPE_TO_PLUGIN_KEY: Readonly<Partial<Record<StudyType, string>>> = {
  venousLEBilateral: 'venousLE',
  venousLERight: 'venousLE',
  venousLELeft: 'venousLE',
  arterialLE: 'arterialLE',
  carotid: 'carotid',
  // ivcDuplex: no plugin yet — falls through to redirect.
};

function isValidStudyType(value: string): value is StudyType {
  return VALID_STUDY_TYPES.has(value as StudyType);
}

export function EncounterStudyWrapper(): React.ReactElement {
  const { encounterId, studyType } = useParams<{
    encounterId: string;
    studyType: string;
  }>();

  // Guard 1: missing params → bounce to landing.
  if (!encounterId || !studyType) {
    return <Navigate to="/" replace />;
  }

  // Guard 2: studyType not in the known catalog → bounce to landing.
  if (!isValidStudyType(studyType)) {
    return <Navigate to="/" replace />;
  }

  // Guard 3: encounter doesn't exist in storage → bounce to landing.
  // Sync read; the EncounterProvider re-confirms via IDB on mount.
  const encounter = loadEncounterSync(encounterId);
  if (!encounter) {
    return <Navigate to="/" replace />;
  }

  // Guard 4: studyType not in this encounter's selectedStudyTypes →
  // bounce to landing. Closes the deep-link-into-unrelated-study hole.
  if (!encounter.selectedStudyTypes.includes(studyType)) {
    return <Navigate to="/" replace />;
  }

  // Resolve StudyType → plugin via the coarse-key map.
  const pluginKey = STUDY_TYPE_TO_PLUGIN_KEY[studyType];
  if (!pluginKey) {
    return <Navigate to="/" replace />;
  }
  const plugin = STUDY_PLUGINS.find((p) => p.key === pluginKey);
  if (!plugin?.FormComponent) {
    return <Navigate to="/" replace />;
  }
  const Form = plugin.FormComponent;

  return (
    <EncounterProvider encounterId={encounterId}>
      <Form />
    </EncounterProvider>
  );
}
