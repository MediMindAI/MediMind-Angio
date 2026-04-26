import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { STORAGE_KEYS, migratedGetItem } from '../constants/storage-keys';

export type Language = 'ka' | 'en' | 'ru';

type TranslationValue = string | { [key: string]: TranslationValue };
type TranslationObject = { [key: string]: TranslationValue };

const STORAGE_KEY = STORAGE_KEYS.LANGUAGE;
const DEFAULT_LANGUAGE: Language = 'ka';

/** Russian plural suffix resolver per CLDR rules */
function getRussianPluralSuffix(count: number): '_one' | '_few' | '_many' {
  const absCount = Math.abs(count);
  const mod10 = absCount % 10;
  const mod100 = absCount % 100;
  if (mod10 === 1 && mod100 !== 11) return '_one';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return '_few';
  return '_many';
}

function deepMerge(target: TranslationObject, source: TranslationObject): TranslationObject {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    if (sourceValue === undefined) continue;
    if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
      const targetValue = result[key];
      const targetObj =
        targetValue && typeof targetValue === 'object' ? (targetValue as TranslationObject) : {};
      result[key] = deepMerge(targetObj, sourceValue);
    } else {
      result[key] = sourceValue;
    }
  }
  return result;
}

const translationsCache: Partial<Record<Language, TranslationObject>> = {};

/**
 * Dynamically load translation modules for a language.
 * Per-study translations live in `translations/<study>/<lang>.json`.
 */
async function loadTranslations(lang: Language): Promise<TranslationObject> {
  if (translationsCache[lang]) return translationsCache[lang]!;

  // Load core + per-study translation files. Each try/catch lets us ship
  // without a study's translation file yet — missing ones fall back to key.
  const moduleImports = await Promise.all([
    import(`../translations/${lang}.json`),
    import(`../translations/venous-le/${lang}.json`).catch(() => ({ default: {} })),
    import(`../translations/abdominal-venous/${lang}.json`).catch(() => ({ default: {} })),
    import(`../translations/arterial-le/${lang}.json`).catch(() => ({ default: {} })),
    import(`../translations/carotid/${lang}.json`).catch(() => ({ default: {} })),
    import(`../translations/dialysis-aortic/${lang}.json`).catch(() => ({ default: {} })),
    import(`../translations/ceap/${lang}.json`).catch(() => ({ default: {} })),
  ]);

  let merged: TranslationObject = {};
  for (const mod of moduleImports) {
    const data = (mod.default ?? mod) as TranslationObject;
    merged = deepMerge(merged, data);
  }

  translationsCache[lang] = merged;
  return merged;
}

export interface TranslationContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string, paramsOrDefault?: Record<string, unknown> | string) => string;
  isLoading: boolean;
}

const TranslationContext = createContext<TranslationContextValue | null>(null);

interface TranslationProviderProps {
  children: ReactNode;
}

export function TranslationProvider({ children }: TranslationProviderProps) {
  const [lang, setLangState] = useState<Language>(() => {
    const stored = migratedGetItem(STORAGE_KEY);
    if (stored === 'ka' || stored === 'en' || stored === 'ru') return stored;
    return DEFAULT_LANGUAGE;
  });

  const [translations, setTranslations] = useState<TranslationObject | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Per-effect cancellation flag. Unlike a shared mountedRef, this is captured
    // by each effect run individually, so a STALE load (e.g. user toggled
    // en → ka quickly and the older en load resolves AFTER ka finished) sees
    // its own `cancelled === true` and no-ops instead of clobbering current state.
    let cancelled = false;

    const load = async (): Promise<void> => {
      setIsLoading(true);
      try {
        // Pre-load English fallback in parallel
        if (lang !== 'en' && !translationsCache.en) {
          loadTranslations('en').catch((e) =>
            console.warn('Failed to pre-load English fallback:', e)
          );
        }

        const loaded = await loadTranslations(lang);
        if (!cancelled) {
          setTranslations(loaded);
          setIsLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          // eslint-disable-next-line no-console
          console.warn(`[TranslationContext] load failed for ${lang}:`, error);
          if (lang !== 'en' && translationsCache.en) {
            setTranslations(translationsCache.en);
          }
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [lang]);

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newLang);
    }
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', newLang);
    }
  }, []);

  const t = useCallback(
    (key: string, paramsOrDefault?: Record<string, unknown> | string): string => {
      const isDefaultValue = typeof paramsOrDefault === 'string';
      const params = isDefaultValue ? undefined : paramsOrDefault;
      const defaultValue = isDefaultValue ? paramsOrDefault : key;

      if (!translations) return defaultValue;

      const getValue = (obj: TranslationObject, path: string): string | undefined => {
        if (obj && typeof obj === 'object' && path in obj && typeof obj[path] === 'string') {
          return obj[path];
        }
        const keys = path.split('.');
        let current: TranslationValue = obj;
        for (const k of keys) {
          if (current && typeof current === 'object' && k in current) {
            current = (current as TranslationObject)[k]!;
          } else {
            return undefined;
          }
        }
        return typeof current === 'string' ? current : undefined;
      };

      let value: string | undefined;

      // Russian pluralization
      if (lang === 'ru' && params && typeof params.count === 'number') {
        value = getValue(translations, `${key}${getRussianPluralSuffix(params.count)}`);
      }

      // Base key
      if (!value) value = getValue(translations, key);

      // English fallback
      if (!value && translationsCache.en) {
        value = getValue(translationsCache.en, key);
      }

      if (!value) return defaultValue;

      // Parameter interpolation — supports {name} and {{name}}
      if (params) {
        return value.replace(/\{\{?(\w+)\}?\}/g, (match, paramKey: string) => {
          const v = params[paramKey];
          return v !== undefined && v !== null ? String(v) : match;
        });
      }

      return value;
    },
    [translations, lang]
  );

  const value = useMemo(() => ({ lang, setLang, t, isLoading }), [lang, setLang, t, isLoading]);

  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>;
}

const defaultTranslationContext: TranslationContextValue = {
  lang: 'en',
  setLang: () => {
    /* no-op */
  },
  t: (key: string) => key,
  isLoading: false,
};

export function useTranslation(): TranslationContextValue {
  const context = useContext(TranslationContext);
  return context ?? defaultTranslationContext;
}

export { TranslationContext };
