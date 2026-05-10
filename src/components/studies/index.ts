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
    key: 'upperExtremityVascular',
    route: null,
    available: false,
    icon: IconWaveSawTool,
    translationKey: 'studies.upperExtremityVascular',
  },
  {
    key: 'abdominalAorticIliac',
    route: null,
    available: false,
    icon: IconHeartbeat,
    translationKey: 'studies.abdominalAorticIliac',
  },
  {
    key: 'iliacPelvicVenous',
    route: null,
    available: false,
    icon: IconShieldCheckered,
    translationKey: 'studies.iliacPelvicVenous',
  },
];

/**
 * Lookup helper: returns the plugin whose route EXACTLY matches the given
 * pathname (trailing slashes trimmed, `/studies/<plugin.route>` aliases
 * accepted for backward compatibility).
 *
 * Wave 2.2: previously this used `endsWith(plugin.route)` which would
 * silently hijack any future route ending in the same suffix
 * (e.g. `/admin/edit-venous-le` would match `/venous-le`). Exact match
 * closes the audit Part-03 HIGH finding.
 */
export function findPluginByPath(pathname: string): StudyPlugin | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  for (const plugin of STUDY_PLUGINS) {
    if (!plugin.route) continue;
    if (path === plugin.route) return plugin;
    if (path === `/studies${plugin.route}`) return plugin;
  }
  return null;
}
