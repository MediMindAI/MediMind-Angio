// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * UI Library Discipline — `no-raw-mantine-visual` rule.
 *
 * Bans NEW raw `@mantine/core` / `@mantine/dates` visual-component imports
 * that have a standardized EMR-prefixed replacement in the design system.
 * Every flagged import names its replacement so the fix is mechanical.
 *
 * The EMR component library (EMRButton, EMRModal, EMRTable, EMRFormFields,
 * …) carries the project's theme tokens, mobile-tap-target sizing, dark-mode
 * handling, validation idioms, and a11y rules that raw Mantine doesn't. Using
 * raw Mantine for a replaceable component re-introduces all the bugs those
 * wrappers exist to prevent.
 *
 * Severity is configured at the call-site in `eslint.config.mjs`. The
 * recommendation is `'warn'`: ~1,300 legacy files predate the library, so an
 * `'error'` would break CI everywhere. Per-module triage flips its slice to
 * `'error'` once the slice is clean.
 *
 * Exemptions (the library's OWN implementations + tests) are applied inside
 * the rule via a filename substring check — the same idiom as
 * `no-direct-medplum-mutation.mjs`'s `allowedFiles`.
 *
 * - Type-only imports (`import type { ButtonProps }`) are NOT flagged — they
 *   don't render anything; the deny map targets runtime visual usage only.
 *
 * Modeled on `eslint-rules/no-direct-medplum-mutation.mjs`.
 */

// Mantine import name → EMR replacement component. Keep in sync with
// explanations/ui-component-library.md and scripts/audit/ui-library-sweep.mjs.
//
// DIVISION OF LABOR with the pre-existing `no-restricted-imports` config in
// eslint.config.mjs (severity: error): that rule owns the classic identity
// set (Button, Modal, Badge, Tabs, Table, all form inputs, @mantine/dates).
// THIS rule owns only the pervasive components that rule does NOT cover —
// they appear in 300-550 files each, so they stay `warn` until per-module
// slices are converted. Do not re-add the overlap: double-reporting.
const DENY_MAP = {
  ActionIcon: 'EMRIconButton',
  Alert: 'EMRAlert',
  Card: 'EMRContentCard',
  Paper: 'EMRContentCard',
  Tooltip: 'EMRTooltip',
  Notification: 'EMRToast',
  Breadcrumbs: 'EMRBreadcrumbs',
};

const MANTINE_SOURCES = new Set(['@mantine/core', '@mantine/dates']);

const DEFAULT_ALLOWED_FILES = [
  // ─── The library's OWN implementations (these WRAP raw Mantine on purpose) ───
  'src/components/common/',
  'src/components/shared/EMRFormFields/',
  'src/components/shared/EMRTable/',
];

/** @type {import('eslint').Rule.RuleModule} */
export const noRawMantineVisual = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Use the EMR-prefixed component-library wrapper instead of a raw @mantine/core / @mantine/dates visual component.',
      url: 'https://medimind.ge/docs/eslint/no-raw-mantine-visual',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allowedFiles: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Substring patterns of file paths exempt from the rule (the library wrappers + tests).',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      rawMantine:
        "Raw Mantine '{{name}}' from '{{source}}' — use {{replacement}} from the EMR component library instead. Raw Mantine for a replaceable component bypasses the theme, dark-mode, tap-target and a11y rules the wrapper carries.",
    },
  },

  create(context) {
    const filename = context.filename ?? context.getFilename();
    const options = (context.options && context.options[0]) || {};
    const allowedFiles = options.allowedFiles ?? DEFAULT_ALLOWED_FILES;

    // Exempt the library's own implementations + any test/spec file. Substring
    // match against the absolute filename so config can use path fragments.
    if (allowedFiles.some((needle) => filename.includes(needle))) {
      return {};
    }
    if (/\.(test|spec)\.[jt]sx?$/.test(filename) || filename.includes('__tests__')) {
      return {};
    }

    return {
      ImportDeclaration(node) {
        if (typeof node.source.value !== 'string') return;
        if (!MANTINE_SOURCES.has(node.source.value)) return;

        // Whole-declaration `import type { ... }` — never rendered, skip.
        if (node.importKind === 'type') return;

        for (const spec of node.specifiers) {
          if (spec.type !== 'ImportSpecifier') continue;
          // Per-specifier `import { type ButtonProps }` — skip type-only.
          if (spec.importKind === 'type') continue;

          const importedName =
            spec.imported?.type === 'Identifier' ? spec.imported.name : undefined;
          if (!importedName) continue;

          const replacement = DENY_MAP[importedName];
          if (!replacement) continue;

          context.report({
            node: spec,
            messageId: 'rawMantine',
            data: {
              name: importedName,
              source: node.source.value,
              replacement,
            },
          });
        }
      },
    };
  },
};

export default noRawMantineVisual;
