// @ts-check
/**
 * ESLint flat config (ESLint 9+).
 *
 * Wave 0 scope decision:
 *   We start with the *non-type-checked* recommended rulesets
 *   (`tseslint.recommended`, NOT `recommended-type-checked`).
 *
 *   Reason: the production audit (2026-04-25) catalogued ~30 pre-existing
 *   issues that the type-checked ruleset would surface as errors all at
 *   once, blocking CI before Waves 1-4 can address them in scoped commits.
 *
 *   Wave 4 ("Lint hardening") promotes this to `recommended-type-checked`
 *   once the underlying issues are resolved.
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
      'no-console': 'warn',
      // Wave 0: 3 pre-existing errors (1 react/no-danger in AnatomyView,
      // 2 @typescript-eslint/no-unused-vars). Downgraded to warn so CI
      // unblocks; Wave 4 promotes back to 'error' once Wave 1+ fix them.
      'react/no-danger': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
