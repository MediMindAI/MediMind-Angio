/**
 * Centralized localStorage Key Registry
 *
 * Mirrors MediMind's naming convention: 'emr-kebab-case'
 * so that when this standalone app is folded into MediMind,
 * user preferences port over without a data migration.
 */

export const STORAGE_KEYS = {
  /** User's chosen language: 'ka' | 'en' | 'ru' */
  LANGUAGE: 'emr-language',
  /** User's chosen theme: 'light' | 'dark' | 'system' */
  THEME: 'emr-theme',
  /** Current study draft prefix — use keyStudyDraft(studyId) */
  STUDY_DRAFT_PREFIX: 'angio-study-draft-',
  /** Currently selected study type */
  SELECTED_STUDY: 'angio-selected-study',
} as const;

export function keyStudyDraft(studyId: string): string {
  return `${STORAGE_KEYS.STUDY_DRAFT_PREFIX}${studyId}`;
}

/**
 * Legacy key mapping — handled by migratedGetItem for forward-compat
 * with MediMind's older key names.
 */
const LEGACY_KEY_MAP: Record<string, string> = {
  emrLanguage: STORAGE_KEYS.LANGUAGE,
  emrTheme: STORAGE_KEYS.THEME,
};

const REVERSE_LEGACY_MAP: Record<string, string[]> = {};
for (const [legacyKey, newKey] of Object.entries(LEGACY_KEY_MAP)) {
  (REVERSE_LEGACY_MAP[newKey] ??= []).push(legacyKey);
}

/**
 * Reads a localStorage value, falling back to legacy key names if present,
 * and migrating forward silently.
 */
export function migratedGetItem(newKey: string): string | null {
  if (typeof localStorage === 'undefined') return null;

  const value = localStorage.getItem(newKey);
  if (value !== null) return value;

  const legacyKeys = REVERSE_LEGACY_MAP[newKey];
  if (!legacyKeys) return null;

  for (const legacyKey of legacyKeys) {
    const legacyValue = localStorage.getItem(legacyKey);
    if (legacyValue !== null) {
      try {
        localStorage.setItem(newKey, legacyValue);
        localStorage.removeItem(legacyKey);
      } catch {
        // quota exceeded — still return the value
      }
      return legacyValue;
    }
  }

  return null;
}
