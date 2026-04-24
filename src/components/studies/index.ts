// SPDX-License-Identifier: Apache-2.0
/**
 * STUDY_PLUGINS — canonical registry of supported vascular studies.
 *
 * Adding a new study means adding one entry here; App.tsx's router and
 * StudyPicker's card list both iterate this registry, so a new entry
 * shows up in both places automatically (no additional switch-on-key
 * ceremony needed).
 *
 * Deeper integration points (FHIR builder branches, PDF section
 * selection, narrative service, competency functions) still live in
 * per-study switch blocks because their parameter shapes diverge enough
 * that a uniform signature would be lossy. See the Wave 3 doc for the
 * rationale.
 */

import {
  IconActivity,
  IconBrain,
  IconHeartbeat,
  IconShieldCheckered,
  IconWaveSawTool,
} from '@tabler/icons-react';
import type { StudyPlugin } from '../../types/studyPlugin';
import { VenousLEForm } from './venous-le/VenousLEForm';
import { ArterialLEForm } from './arterial-le/ArterialLEForm';
import { CarotidForm } from './carotid/CarotidForm';

export const STUDY_PLUGINS: ReadonlyArray<StudyPlugin> = [
  {
    key: 'venousLE',
    route: '/venous-le',
    available: true,
    icon: IconActivity,
    FormComponent: VenousLEForm,
    translationKey: 'studies.venousLE',
  },
  {
    key: 'arterialLE',
    route: '/arterial-le',
    available: true,
    icon: IconWaveSawTool,
    FormComponent: ArterialLEForm,
    translationKey: 'studies.arterialLE',
  },
  {
    key: 'carotid',
    route: '/carotid',
    available: true,
    icon: IconBrain,
    FormComponent: CarotidForm,
    translationKey: 'studies.carotid',
  },
  {
    key: 'abdominalVenous',
    route: null,
    available: false,
    icon: IconHeartbeat,
    translationKey: 'studies.abdominalVenous',
  },
  {
    key: 'dialysisAortic',
    route: null,
    available: false,
    icon: IconShieldCheckered,
    translationKey: 'studies.dialysisAortic',
  },
];

/**
 * Lookup helper: returns the plugin whose route matches the given
 * pathname (trailing slashes trimmed, `/studies/<key>` aliases accepted
 * for backward compatibility with earlier App.tsx routing).
 */
export function findPluginByPath(pathname: string): StudyPlugin | null {
  const path = pathname.replace(/\/+$/, '');
  for (const plugin of STUDY_PLUGINS) {
    if (!plugin.route) continue;
    if (path.endsWith(plugin.route)) return plugin;
    // Back-compat alias: /studies/<last-segment-of-route>
    const routeTail = plugin.route.replace(/^\//, '');
    if (path.endsWith(`/studies/${routeTail}`)) return plugin;
  }
  return null;
}
