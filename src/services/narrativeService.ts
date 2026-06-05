/**
 * Narrative service — thin wrapper + form-state adapter.
 *
 * Keeps the study-specific `generateNarrative` call site out of the UI layer.
 * The form UI and PDF renderer both call `narrativeFromFormState(form)` and
 * receive a consistent `NarrativeOutput` regardless of study type.
 *
 * For studies that don't yet have a narrative generator (arterial LE, carotid,
 * IVC, or venous right/left-only variants) we return an empty structure so the
 * caller can still render a shell.
 */

import type { FormState } from '../types/form';
import {
  isArterialFindings,
  isArterialPressures,
  isCarotidFindings,
  isCarotidNascet,
  isIliacFindings,
  isVenousFindings,
} from '../types/parameters';
import type { VenousSegmentFindings, VenousSegmentFinding } from '../components/studies/venous-le/config';
import {
  generateNarrative,
  type NarrativeOutput,
  type NarrativeKeyEntry,
} from '../components/studies/venous-le/narrativeGenerator';
import { generateArterialNarrative } from '../components/studies/arterial-le/narrativeGenerator';
import { generateCarotidNarrative } from '../components/studies/carotid/narrativeGenerator';
import { generateIliacNarrative } from '../components/studies/iliac-pelvic-venous/narrativeGenerator';
import { suggestNascetCategory } from '../components/studies/carotid/stenosisCalculator';
import type { CarotidNascetClassification } from '../components/studies/carotid/config';
import enCore from '../translations/en.json';
import enArterialLE from '../translations/arterial-le/en.json';
import enCarotid from '../translations/carotid/en.json';
import enCeap from '../translations/ceap/en.json';
import enVenousLE from '../translations/venous-le/en.json';
import enIliac from '../translations/iliac-pelvic-venous/en.json';

export { generateNarrative };
export type { NarrativeOutput, NarrativeKeyEntry };

const EMPTY_NARRATIVE: NarrativeOutput = Object.freeze({
  rightFindings: '',
  leftFindings: '',
  conclusions: [],
  rightFindingsKeys: [],
  leftFindingsKeys: [],
  conclusionsKeys: [],
  rightFindingsEntries: [],
  leftFindingsEntries: [],
  conclusionsEntries: [],
});

/**
 * Produce a narrative for any form state. Only venous-LE studies currently
 * generate prose; other study types return an empty narrative.
 *
 * The venous findings are pulled from `form.parameters` under the conventional
 * `segmentFindings` key, which the form renderer populates via the per-segment
 * table. If absent we return an empty narrative.
 */
export function narrativeFromFormState(form: FormState): NarrativeOutput {
  // Wave 2.5: `parameters` is `Record<string, unknown>`; the read boundary
  // uses `is*Findings` / `isCarotidNascet` / `isArterialPressures` type guards
  // (from `types/parameters.ts`) instead of `as unknown as <Type>` casts.
  // Soft failure (return EMPTY_NARRATIVE) on missing or wrong-shape data.
  if (
    form.studyType === 'venousLEBilateral' ||
    form.studyType === 'venousLERight' ||
    form.studyType === 'venousLELeft'
  ) {
    const raw = form.parameters['segmentFindings'];
    if (!isVenousFindings(raw)) return EMPTY_NARRATIVE;
    return generateNarrative(raw);
  }

  if (form.studyType === 'arterialLE') {
    const rawFindings = form.parameters['segmentFindings'];
    const rawPressures = form.parameters['pressures'];
    if (!isArterialFindings(rawFindings)) return EMPTY_NARRATIVE;
    const pressures = isArterialPressures(rawPressures) ? rawPressures : {};
    const rawRunoff = form.parameters['runoff'];
    const runoff =
      typeof rawRunoff === 'object' && rawRunoff !== null
        ? (rawRunoff as import('../components/studies/arterial-le/config').RunoffAssessment)
        : {};
    return generateArterialNarrative(rawFindings, pressures, runoff);
  }

  if (form.studyType === 'carotid') {
    const rawFindings = form.parameters['segmentFindings'];
    const rawNascet = form.parameters['nascet'];
    if (!isCarotidFindings(rawFindings)) return EMPTY_NARRATIVE;
    const manual = isCarotidNascet(rawNascet) ? rawNascet : {};
    // The conclusion must follow the entered velocities, not just a manually
    // picked category. A manual pick still wins (clinician override); when a
    // side is left blank we auto-classify it from SRU velocity criteria so
    // pathological speeds can't read as "normal" and a clean study isn't
    // forced to "< 50 %".
    const nascet: CarotidNascetClassification = {
      right: manual.right ?? suggestNascetCategory(rawFindings, 'right'),
      left: manual.left ?? suggestNascetCategory(rawFindings, 'left'),
    };
    return generateCarotidNarrative(rawFindings, nascet);
  }

  if (form.studyType === 'iliacPelvicVenous') {
    const raw = form.parameters['segmentFindings'];
    if (!isIliacFindings(raw)) return EMPTY_NARRATIVE;
    return generateIliacNarrative(raw);
  }

  return EMPTY_NARRATIVE;
}

/**
 * Convenience helper for callers that already hold a findings map (e.g. the
 * smoke-test page). Re-exported for parity with the form-state variant.
 */
export function narrativeFromFindings(
  findings: Readonly<Record<string, VenousSegmentFinding | undefined>>
): NarrativeOutput {
  return generateNarrative(findings as VenousSegmentFindings);
}

// ============================================================================
// Localized narrative
// ============================================================================

/**
 * Minimal `t()` shape the localized builder needs.
 *
 * Our TranslationContext exposes `t(key, paramsOrDefault)` where the second
 * argument is either a params object or a fallback string. For the narrative
 * pipeline we always pass params, so a single overload is enough here.
 */
export type TranslateFn = (
  key: string,
  paramsOrDefault?: Record<string, unknown> | string,
) => string;

export interface LocalizedNarrative {
  readonly rightFindings: string;
  readonly leftFindings: string;
  readonly conclusions: ReadonlyArray<string>;
}

/**
 * Resolve a single `NarrativeKeyEntry` to a localized sentence.
 * Exported for direct unit testing (Wave 3.8 — Part 03 HIGH).
 */
export function resolveEntry(entry: NarrativeKeyEntry, t: TranslateFn): string {
  const params = entry.params;
  if (!params) {
    return t(entry.key);
  }
  // Wave 3.8 (Part 03 HIGH) — generalize from the venous-only special-case
  // (`vein` + bare `side`) to also resolve carotid + arterial generator
  // params (`vessel`, `severity`, `morphology`, `waveform`, `category`,
  // `abiBand`, plus pre-prefixed `side: 'carotid.side.left'`). The carotid
  // and arterial generators ship every translatable param value as a
  // dotted translation key (e.g. `carotid.vessel.cca-prox`), so any string
  // value containing a `.` is passed through `t()`. The legacy bare
  // `side: 'left' | 'right'` from the venous generator is namespaced into
  // `venousLE.sides.<value>` for back-compat.
  const resolved: Record<string, string | number> = {};
  for (const [paramKey, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      if (value.includes('.')) {
        // Already a translation key — resolve directly.
        resolved[paramKey] = t(value);
      } else if (paramKey === 'side') {
        // Legacy bare side from the venous generator.
        resolved[paramKey] = t(`venousLE.sides.${value}`);
      } else {
        resolved[paramKey] = value;
      }
    } else {
      resolved[paramKey] = value;
    }
  }
  return t(entry.key, resolved);
}

/**
 * Build a fully-localized narrative by running each parametrized key entry
 * through `t()` with resolved `{vein}` / `{side}` placeholders.
 *
 * The English `narrativeFromFormState` helper remains for back-compat; this
 * helper is the preferred entry point for any UI or PDF path that should
 * flip language with the active `t` function.
 */
export function buildLocalizedNarrative(
  findings: VenousSegmentFindings,
  t: TranslateFn,
): LocalizedNarrative {
  const base = generateNarrative(findings);

  const rightSentences = base.rightFindingsEntries.map((e) => resolveEntry(e, t));
  const leftSentences = base.leftFindingsEntries.map((e) => resolveEntry(e, t));
  const conclusions = base.conclusionsEntries.map((e) => resolveEntry(e, t));

  return {
    rightFindings: rightSentences.join(' '),
    leftFindings: leftSentences.join(' '),
    conclusions,
  };
}

/**
 * Study-type-agnostic localized narrative. Unlike `buildLocalizedNarrative`
 * (venous-only), this routes through `narrativeFromFormState`, so arterial-LE
 * and carotid narratives reach the PDF too. (Prior bug: `resolveStudyAssets`
 * only built `localized` for venous, silently dropping carotid/arterial
 * findings + conclusions from the report.)
 */
export function buildLocalizedNarrativeFromForm(
  form: FormState,
  t: TranslateFn,
): LocalizedNarrative {
  const base = narrativeFromFormState(form);
  return {
    rightFindings: base.rightFindingsEntries.map((e) => resolveEntry(e, t)).join(' '),
    leftFindings: base.leftFindingsEntries.map((e) => resolveEntry(e, t)).join(' '),
    conclusions: base.conclusionsEntries.map((e) => resolveEntry(e, t)),
  };
}

// ============================================================================
// English fallback resolver — for the FHIR DiagnosticReport.conclusion, which
// is canonical English (the venous generator already emits English `.conclusions`
// directly; carotid + arterial emit only `conclusionsEntries`, so we resolve
// those to English here using the bundled en translation namespaces).
// ============================================================================

function deepMergeEn(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const k of Object.keys(source)) {
    const v = source[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const existing = target[k];
      const next: Record<string, unknown> =
        existing && typeof existing === 'object' && !Array.isArray(existing)
          ? { ...(existing as Record<string, unknown>) }
          : {};
      deepMergeEn(next, v as Record<string, unknown>);
      target[k] = next;
    } else {
      target[k] = v;
    }
  }
}

const EN_TREE: Record<string, unknown> = {};
for (const ns of [enCore, enArterialLE, enCarotid, enCeap, enVenousLE, enIliac]) {
  deepMergeEn(EN_TREE, ns);
}

function getEnValue(path: string): string | undefined {
  let current: unknown = EN_TREE;
  for (const k of path.split('.')) {
    if (current && typeof current === 'object' && k in current) {
      current = (current as Record<string, unknown>)[k];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

/** English-only `t` mirroring TranslationContext's lookup + `{name}`/`{{name}}` interpolation. */
const englishT: TranslateFn = (key, paramsOrDefault) => {
  const isDefault = typeof paramsOrDefault === 'string';
  const params = isDefault ? undefined : paramsOrDefault;
  const fallback = isDefault ? paramsOrDefault : key;
  const value = getEnValue(key);
  if (value === undefined) return fallback;
  if (params) {
    return value.replace(/\{\{?(\w+)\}?\}/g, (match, paramKey: string) => {
      const v = params[paramKey];
      return v !== undefined && v !== null ? String(v) : match;
    });
  }
  return value;
};

/**
 * English conclusion sentences for a narrative — used by the FHIR
 * DiagnosticReport builder when `narrative.conclusions` is empty (carotid/arterial).
 */
export function resolveConclusionsEnglish(narrative: NarrativeOutput): string[] {
  return narrative.conclusionsEntries.map((e) => resolveEntry(e, englishT));
}
