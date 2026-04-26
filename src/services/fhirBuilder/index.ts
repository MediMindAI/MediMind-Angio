/**
 * Public entry point for the FHIR Bundle builder.
 *
 * Wave 2.6 split the original 2,000-line `fhirBuilder.ts` into per-resource
 * modules under `src/services/fhirBuilder/`. This barrel preserves the
 * original import surface so callers continue to write
 * `import { buildFhirBundle } from '../../services/fhirBuilder'`.
 */

export { buildFhirBundle, downloadFhirBundle } from './buildBundle';
export {
  buildEncounterBundle,
  type BuildEncounterBundleInput,
} from './buildEncounterBundle';

// Re-export the types so callers importing from `fhirBuilder` don't have to
// reach into the narrow fhir types file separately.
export type { Bundle, DiagnosticReport, Observation } from '../../types/fhir';
