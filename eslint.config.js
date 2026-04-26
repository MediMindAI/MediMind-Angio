// @ts-check
/**
 * ESLint flat config (ESLint 9+).
 *
 * Wave 3.10 ("Build/security hardening") promoted these rules from `warn`
 * to `error` after Waves 1+2 cleaned up the underlying violations:
 *
 *   - `react/no-danger`              warn -> error  (file override for AnatomyView)
 *   - `@typescript-eslint/no-unused-vars`  warn -> error  (file override for one legacy helper)
 *   - `no-console` (src only)        warn -> error  (allow `warn` + `error`)
 *
 * Type-checked rules (`recommended-type-checked`) remain off — Wave 4 will
 * flip to that profile and turn on `parserOptions.project` once the slower
 * lint pass is acceptable in CI.
 *
 * Layering rules (deliberate):
 *   - `src/**`              strict (errors), no console.log
 *   - `scripts/**` + `test/**`  console allowed (CLI tools / test harness)
 *   - test files (.test.ts, .test.tsx)  allow `console.log` for debug
 */
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'public/**',
      '*.config.{js,cjs,mjs,ts}',
      'scripts/.cache/**',
      'scripts/.raw/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // ─── Base config: applies to ALL TS sources ────────────────────────────
  {
    files: ['src/**/*.{ts,tsx}', 'scripts/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
        // Wave 4 will flip to `project: './tsconfig.json'` once
        // type-checked rules are enabled.
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2022,
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react/no-danger': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  // ─── src/** only: tightened rules ──────────────────────────────────────
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      // Production code may not use bare `console.log`. `console.warn` and
      // `console.error` remain legal — they're how we surface fallback /
      // error paths the user-visible UI doesn't otherwise show.
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  // ─── AnatomyView: trusted-SVG host opt-out ─────────────────────────────
  // The component injects our own SVG asset (loaded from /public/anatomy/),
  // not user input. Asset IDs are sanitized at build time by
  // scripts/tag-anatomy.ts. The inline-injection pattern is required so
  // the colorizer can mutate inline `fill` attrs at runtime.
  {
    files: ['src/components/anatomy/AnatomyView.tsx'],
    rules: {
      'react/no-danger': 'off',
    },
  },
  // ─── Legacy helper kept for compatibility ─────────────────────────────
  // `pickCat` in carotid/narrativeGenerator.ts is exported indirectly and
  // intentionally kept available for downstream fallback resolvers; the
  // current TS analysis can't see that path.
  // TODO Wave 4: re-evaluate if pickCat can be removed or `_pickCat`-prefixed.
  {
    files: ['src/components/studies/carotid/narrativeGenerator.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  },
  // ─── scripts/** + test/**: CLI/test conveniences ──────────────────────
  // These run outside the browser and legitimately use console.log for
  // user-facing CLI output and test debug. Keep no-console off entirely.
  {
    files: ['scripts/**/*.ts', 'test/**/*.ts', 'src/**/*.test.{ts,tsx}'],
    rules: {
      'no-console': 'off',
    },
  },
);
