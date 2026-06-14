#!/usr/bin/env node
/**
 * UI Library Sweep — single-source-of-truth guard for the EMR design system.
 *
 * Finds "orphaned" UI usage that bypasses the central component library:
 *   A. Raw @mantine/core | @mantine/dates VISUAL component imports in app code
 *      where an EMR wrapper exists (components/common + EMRFormFields + EMRTable).
 *   B. Raw visual imports with NO wrapper yet (informational — wrapper backlog).
 *   C. Hardcoded hex colors in EMR CSS modules / TSX (should be theme.css vars).
 *
 * Layout/behavior primitives (Box, Group, Stack, Grid, Text, ...) are ALLOWED —
 * the design system's identity lives in wrappers + tokens, not in layout.
 *
 * The library's own implementation files are exempt (wrappers legitimately
 * compose raw Mantine internally).
 *
 * Usage: node scripts/audit/ui-library-sweep.mjs
 * Output: audit-findings/ui-orphans-<DATE>.{md,json}
 */
import { readdirSync, readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN_ROOTS = [
  'src',
  
];

/** Library implementation dirs — exempt from the raw-import rule. */
const LIBRARY_DIRS = [
  'src/components/common',
  'src/components/shared/EMRFormFields',
  'src/components/shared/EMRTable',
];

/** raw Mantine visual component → canonical EMR wrapper */
const WRAPPED = {
  Button: 'EMRButton',
  ActionIcon: 'EMRIconButton',
  Modal: 'EMRModal',
  Badge: 'EMRBadge',
  Tabs: 'EMRTabs',
  Alert: 'EMRAlert',
  Card: 'EMRContentCard / EMRContentSection',
  Paper: 'EMRContentCard / EMRContentSection',
  Table: 'EMRTable (components/shared/EMRTable)',
  Tooltip: 'EMRTooltip',
  Notification: 'EMRToast',
  Breadcrumbs: 'EMRBreadcrumbs',
  Stepper: 'EMRWizardStepper / EMRProgressStepper',
  TextInput: 'EMRTextInput',
  Textarea: 'EMRTextarea',
  Select: 'EMRSelect',
  MultiSelect: 'EMRMultiSelect',
  NumberInput: 'EMRNumberInput',
  Checkbox: 'EMRCheckbox',
  Switch: 'EMRSwitch',
  Radio: 'EMRRadioGroup',
  Slider: 'EMRSlider',
  Autocomplete: 'EMRAutocomplete',
  ColorInput: 'EMRColorInput',
  SegmentedControl: 'EMRViewToggle',
  // @mantine/dates
  DateInput: 'EMRDatePicker',
  DatePicker: 'EMRDatePicker',
  DatePickerInput: 'EMRDatePicker',
  DateTimePicker: 'EMRDateTimePicker',
  TimeInput: 'EMRTimeInput',
};

/** Visual components with no wrapper yet — reported as backlog, not failures. */
const UNWRAPPED_VISUAL = new Set([
  'ThemeIcon', 'Timeline', 'Progress', 'RingProgress', 'Avatar', 'Pagination',
  'Drawer', 'Menu', 'Chip', 'Pill', 'PillsInput', 'Rating', 'PasswordInput',
  'FileInput', 'NativeSelect', 'TagsInput', 'Accordion', 'Indicator', 'List',
  'Fieldset', 'JsonInput', 'Spoiler', 'Burger', 'CloseButton', 'Stepper',
]);

const TEST_RE = /\.(test|spec)\.tsx?$|__tests__|\.example\.tsx$|\.stories\.tsx$/;

/**
 * Files allowed to use hex colors (token definitions / intentional palettes /
 * documented carve-outs). See audit-findings/ui-orphan-exceptions.md and the
 * "CLINICAL & NON-MANTINE CARVE-OUTS" section of COMMAND-UI-REBUILD-GOAL.md.
 */
const HEX_ALLOW = [
  /styles\/theme\.css$/,
  /constants\/theme-colors\.ts$/,
  /LabReportPrint\.css$/, // print stylesheet — printer-safe literals
  /styles\/print\.css$/, // print stylesheet — redefines --emr-* tokens with printer-safe literals (same case as theme.css)
  // PDF carve-out (goal §5): @react-pdf/renderer uses its own StyleSheet, not
  // Mantine/CSS-vars. The chrome-token rule does not apply to the PDF tree.
  /components\/pdf\//,
  // Color-picker swatch palette — these hex ARE the component's selectable color
  // data (incl. purple/pink the user can pick), not chrome.
  /EMRFormFields\/EMRColorInput\.tsx$/,
  // Anatomy diagnostic rendering carve-out (goal §5): the occluded-vessel hatch
  // pattern + competency legend are clinical data-viz SVG, not chrome.
  /anatomy\/AnatomyView\.tsx$/,
  /anatomy\/AnatomyLegend\.tsx$/,
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue;
      yield* walk(p);
    } else {
      yield p;
    }
  }
}

const isLibraryFile = (rel) => LIBRARY_DIRS.some((d) => rel.startsWith(d));

const wrapped = [];   // { file, components: [{raw, wrapper}] }
const unwrapped = []; // { file, components: [raw] }
const hexHits = [];   // { file, count, samples }

const IMPORT_RE = /import\s*(?:type\s*)?\{([^}]+)\}\s*from\s*['"]@mantine\/(core|dates)['"]/g;
const HEX_RE = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;

for (const scanRoot of SCAN_ROOTS) {
  let abs;
  try { abs = join(ROOT, scanRoot); statSync(abs); } catch { continue; }
  for (const file of walk(abs)) {
    const rel = relative(ROOT, file);
    if (TEST_RE.test(rel)) continue;

    if (/\.tsx?$/.test(rel) && !isLibraryFile(rel)) {
      const src = readFileSync(file, 'utf8');
      const foundWrapped = [];
      const foundUnwrapped = [];
      for (const m of src.matchAll(IMPORT_RE)) {
        const names = m[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0].replace(/^type\s+/, '').trim()).filter(Boolean);
        for (const n of names) {
          if (WRAPPED[n]) foundWrapped.push({ raw: n, wrapper: WRAPPED[n] });
          else if (UNWRAPPED_VISUAL.has(n)) foundUnwrapped.push(n);
        }
      }
      if (foundWrapped.length) wrapped.push({ file: rel, components: foundWrapped });
      if (foundUnwrapped.length) unwrapped.push({ file: rel, components: foundUnwrapped });
    }

    if (/\.(css|tsx)$/.test(rel) && !HEX_ALLOW.some((re) => re.test(rel))) {
      const src = readFileSync(file, 'utf8');
      const lines = src.split('\n');
      const hits = [];
      lines.forEach((line, i) => {
        if (line.includes('--emr-') && /:\s*#/.test(line) === false) return; // var refs fine
        const ms = line.match(HEX_RE);
        if (ms) hits.push({ line: i + 1, text: line.trim().slice(0, 110) });
      });
      if (hits.length) hexHits.push({ file: rel, count: hits.length, samples: hits.slice(0, 3) });
    }
  }
}

wrapped.sort((a, b) => b.components.length - a.components.length);
hexHits.sort((a, b) => b.count - a.count);

const date = process.env.SWEEP_DATE || new Date().toISOString().slice(0, 10);
mkdirSync(join(ROOT, 'audit-findings'), { recursive: true });

const totalWrappedImports = wrapped.reduce((s, f) => s + f.components.length, 0);
const totalHex = hexHits.reduce((s, f) => s + f.count, 0);

const json = { date, summary: {
  filesWithConvertibleRawImports: wrapped.length,
  convertibleRawImports: totalWrappedImports,
  filesWithUnwrappedVisuals: unwrapped.length,
  filesWithHexColors: hexHits.length,
  hexColorLines: totalHex,
}, wrapped, unwrapped, hexHits };
writeFileSync(join(ROOT, `audit-findings/ui-orphans-${date}.json`), JSON.stringify(json, null, 2));

const md = `# UI Library Orphan Sweep — ${date}

Single-source-of-truth check: raw Mantine *visual* usage outside the EMR
component library, plus hardcoded hex colors. Layout primitives are allowed.

## Summary
| Metric | Count |
|---|---|
| Files importing raw visual components **with an EMR wrapper available** | **${wrapped.length}** |
| Total convertible raw imports | ${totalWrappedImports} |
| Files using visual components with **no wrapper yet** (backlog) | ${unwrapped.length} |
| Files with hardcoded hex colors | ${hexHits.length} (${totalHex} lines) |

## A. Convertible — raw import where a wrapper exists
${wrapped.map((f) => `- \`${f.file}\` — ${f.components.map((c) => `${c.raw}→${c.wrapper.split(' ')[0]}`).join(', ')}`).join('\n') || '_none — clean!_'}

## B. No wrapper yet (build-wrapper backlog, not conversion targets)
${unwrapped.map((f) => `- \`${f.file}\` — ${[...new Set(f.components)].join(', ')}`).join('\n') || '_none_'}

## C. Hardcoded hex colors (should be theme.css variables)
${hexHits.slice(0, 80).map((f) => `- \`${f.file}\` — ${f.count} line(s)`).join('\n') || '_none — clean!_'}
${hexHits.length > 80 ? `\n…and ${hexHits.length - 80} more files (see JSON).` : ''}
`;
writeFileSync(join(ROOT, `audit-findings/ui-orphans-${date}.md`), md);

console.log(`UI sweep complete:
  convertible raw-import files : ${wrapped.length} (${totalWrappedImports} imports)
  unwrapped-visual files       : ${unwrapped.length}
  hex-color files              : ${hexHits.length} (${totalHex} lines)
  → audit-findings/ui-orphans-${date}.{md,json}`);
