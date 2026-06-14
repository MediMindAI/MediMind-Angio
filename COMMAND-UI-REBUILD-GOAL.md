# GOAL: Rebuild & standardize the ENTIRE angio UI to the "Command" design system

> **How to launch:** in the `medimind-angio` repo, run
> `/goal` and paste this file's mission (or: `/goal rebuild the entire angio platform UI
> to the Command design system per COMMAND-UI-REBUILD-GOAL.md`).
> This is a multi-hour autonomous rebuild — work area by area until convergence.

---

## 1. Mission (one sentence)

Convert **every page and component** in this repo to the migrated **"Command"** UI
library so the whole platform shares one consistent visual identity — **zero raw
Mantine visual orphans, zero hardcoded chrome colors, full Command idioms, with
all behavior preserved.**

The Command library, design tokens, agents, and skills were migrated into this
repo on 2026-06-13. **Read `audit-findings/COMMAND-MIGRATION-2026-06-13.md` first** —
it lists exactly what landed, what was deferred, and the known starting baseline.

---

## 2. Canonical references (read BEFORE touching code)

| What | Where |
|------|-------|
| **Design spec (overriding authority)** | `src/styles/DESIGN-DIRECTION.md` |
| **Tokens (only colors allowed)** | `src/styles/theme.css` (`--emr-*`) |
| **Wrappers (build with these only)** | `src/components/common/`, `src/components/shared/EMRFormFields/`, `src/components/shared/EMRTable/` |
| **Mantine bridge** | `src/styles/mantineTheme.ts` |
| **Audit rules** | `.claude/skills/ui-audit/references/medimind-rules.md` |
| **Migration record + deferred items** | `audit-findings/COMMAND-MIGRATION-2026-06-13.md` |

---

## 3. The Command-aware toolchain (use these — do NOT hand-write UI)

- **`/ui-audit <route>`** — diagnose a page across 10 dimensions → ranked fix report.
- **`/ui-upgrade <route>`** — drives the `frontend-designer` agent to apply the upgrade.
- **`frontend-designer` agent** — builds/upgrades UI to the Command direction. **ALL visual work goes through this agent.**
- **`qa-ui-ux-tester` agent** — verifies viewports, dark mode, a11y, and the `UI12` raw-Mantine orphan check.
- **`npm run ui:orphans`** — the convergence metric (writes `audit-findings/ui-orphans-<date>.md`).

---

## 4. Environment (angio specifics — NOT the medplum EMR)

- **Dev server:** `npm run dev` → **port 3001**. If busy: `lsof -ti :3001 | xargs kill -9` then restart.
- **NO authentication.** Navigate directly to any route — there is no login.
- **Routes:** `/` (home), `/encounters`, `/encounter/:encounterId/:studyType`,
  `/demo/anatomy`, `/carotid`, `/venous-le`, `/arterial-le`, `/studies/*`.
- **Stack:** Vite + React 19.2 + Mantine 8.3.6, single app (no monorepo, no Medplum).
- **i18n:** `useTranslation()` from `src/contexts/TranslationContext` (`t, lang, setLang`; ka/en/ru). Add new UI keys to `src/translations/{en,ka,ru}.json`.
- **Theme:** `useTheme()` from `src/contexts/ThemeContext`; storage key `emr-theme`; lang key `emr-language`.

---

## 5. HARD RULES (non-negotiable — a violation fails the goal)

1. **EMR wrappers only.** Raw Mantine VISUAL components (`Button`, `Modal`, `Badge`,
   `TextInput`, `Select`, `Tabs`, `Alert`, `Tooltip`, `ActionIcon`, `Paper`, `Card`,
   `Table`, `Checkbox`, date pickers, …) outside the library dirs are **orphans →
   must be replaced** with `EMRButton`/`EMRModal`/`EMRBadge`/… Layout primitives
   (`Box`, `Group`, `Stack`, `Grid`, `SimpleGrid`, `Flex`, `Text`, `ScrollArea`,
   `Collapse`, `Divider`, `Menu`, `Popover`) are allowed.
2. **Only theme colors.** Blues `#1a365d / #2b6cb0 / #3182ce / #bee3f8`, red (error),
   green (success). **NO purple, orange, amber, yellow, or any Tailwind/Chakra hex** in chrome.
   Every chrome color must resolve to a `var(--emr-*)` token — no hardcoded hex.
3. **Command idioms** (per `DESIGN-DIRECTION.md`): borderless 12px decks on
   `--emr-shadow-card`; gradient tick-bar section headers; solid-navy info badges;
   navy focus rings + solid-navy checked states; alerts = deck + 4px semantic left rail;
   primary buttons = brand gradient; NO `backdrop-filter`; animations ≤ 150–200ms.
4. **Use the `frontend-designer` agent** for every visual change. Don't write UI by hand.
5. **Preserve behavior exactly.** Forms must still submit, validate, and map to the
   same FHIR/data shapes; anatomy rendering, study logic, and PDF output unchanged.
   This is a *visual/structural* rebuild, not a feature change.
6. **No git stash / branch / commit.** Apply edits in place; leave staging to the user.
7. **No writes to `.env*`, service worker, or PWA files** without explicit approval.
8. **Verify by LOADING the page** (light + dark + 375px mobile) — unit tests alone are
   not verification. Zero new console errors.

### CLINICAL & NON-MANTINE CARVE-OUTS (do NOT "fix" these)

- **Competency colors are clinical data-viz, NOT chrome.** `COMPETENCY_COLORS` /
  `--emr-competency-*` (normal/occluded/incompetent/inconclusive/ablated — including
  the **amber `#f59e0b` for reflux**) encode medical meaning. **Leave them exactly as
  they are.** Do not flag them as "forbidden amber." Same for `SEVERITY_COLORS` /
  stenosis-severity scales — clinical, not chrome.
- **The anatomy SVG colorizer** (`src/components/anatomy/**`, `useAnatomyColors`,
  `AnatomyView`) mutates SVG `fill` attrs by clinical state. Only restyle the **chrome
  around** the anatomy view (toolbars, panels, legends) — never the diagnostic fills.
- **PDF components** (`src/components/pdf/**`, `@react-pdf/renderer`) use their own
  StyleSheet, **not Mantine**. The orphan rule does NOT apply there. Leave PDF styling
  alone unless a brand color is literally wrong; keep Georgian-font rendering intact.

---

## 6. Scope — the entire platform, area by area

Work in this order (lowest-risk → highest, dependencies first):

| # | Area | Path | Notes |
|---|------|------|-------|
| 0 | **Wrapper prop-mismatch fixes** | `src/components/{common,shared}` consumers | The 11 old wrappers were overwritten with Command versions — fix any pages that broke on the new prop APIs FIRST so the app compiles. |
| 1 | **Global layout / chrome** | `src/components/layout/**` | Top nav, headers, footers, page shells → Command chrome (decks, tick-bar headers). Highest visibility. |
| 2 | **Home + Encounters** | `/`, `/encounters` routes | List/table surfaces → `EMRTable`; cards → `EMRContentCard`. |
| 3 | **Encounter / study shell** | `/encounter/:id/:studyType` | The form-host shell + tabs/steppers. |
| 4 | **Study forms** | `src/components/studies/**` (venous-le, arterial-le, carotid, iliac-pelvic-venous, …) | Heavy form usage → `EMRFormFields` wrappers; section headers; validation UX. Convert each study one at a time. |
| 5 | **Shared form fields/validators** | `src/components/form/**` | Reconcile angio's older form layer with `EMRFormFields` — replace duplicated inputs with wrappers. |
| 6 | **Anatomy view chrome** | `src/components/anatomy/**` | Chrome only — see carve-out above. |
| 7 | **Demo / misc routes** | `/demo/anatomy`, any leftover | Sweep for stragglers. |

> PDF (`src/components/pdf/**`) is intentionally **out of scope** for the Mantine-wrapper
> conversion (carve-out §5). Only touch it if a literal forbidden brand hex appears in chrome text.

---

## 7. Per-area workflow (repeat until the area is clean)

1. **Audit** — `/ui-audit <route>` → produces a ranked fix report under `audit-findings/ui-audit/`.
2. **Upgrade** — `/ui-upgrade <route>` (or spawn `frontend-designer` directly) to apply:
   - raw Mantine visual → EMR wrapper (per the §5.1 mapping)
   - hardcoded chrome hex → `var(--emr-*)` token
   - Command idioms (decks, tick-bar headers, navy badges/checked states, gradient buttons)
   - mobile fixes (44px tap targets, 16px min font, no horizontal scroll)
   - loading / empty / error states
3. **Translate** — any new literal UI text → `t('…')` keys in `src/translations/{en,ka,ru}.json`.
4. **Verify** — load the route at **light + dark + 375px** via Playwright (`scripts/playwright/cmd.ts`,
   port 3001, no login). Confirm: renders, **zero new console errors**, behavior unchanged
   (forms submit/validate, data maps identically).
5. **Re-sweep** — `npm run ui:orphans`; confirm the area's orphan + hex counts dropped.
6. Move to the next area only when the current one is visually correct and behavior-verified.

---

## 8. Convergence / DONE criteria (all must hold)

- ✅ `npm run ui:orphans` → **0 convertible raw-import files** and **0 chrome hardcoded-hex
  files** across `src/**` (clinical competency/severity colors and PDF excluded by carve-out).
- ✅ Every route renders correctly in **light, dark, and 375px mobile** with **zero new console errors**.
- ✅ Every form still submits, validates, and produces the **same FHIR/data output** as before.
- ✅ Anatomy diagnostic colors and PDF exports are **unchanged**.
- ✅ Every visual change was made via the `frontend-designer` agent.
- ✅ No forbidden colors anywhere in chrome; all chrome color via `var(--emr-*)`.
- ✅ The `no-raw-mantine-visual` ESLint rule passes clean enough to be flipped from
  `warn` → `error` per converted area (`eslint.config.js`).

---

## 9. Known starting state & deferred items

- **Baseline at migration (2026-06-13):** `npm run ui:orphans` reported **13 convertible
  raw-Mantine files** + **23 hardcoded-hex files**. Re-run it at the start to get the current number.
- **Rich-text editor deferred:** `EMRRichTextEditor` was NOT migrated (needs 10 `@tiptap/*`
  packages). Its export is commented out in `src/components/shared/EMRFormFields/index.ts`.
  If a study form needs rich text, `npm i @tiptap/react @tiptap/starter-kit @tiptap/core
  @tiptap/pm @tiptap/extension-link @tiptap/extension-image @tiptap/extension-placeholder
  @tiptap/extension-text-align @tiptap/extension-underline` and re-enable the export.
- **Domain components intentionally NOT migrated** (they were medplum-specific):
  EMRSidebar, EMRBedGrid, EMRNotificationCenter, EMRMeasurementInput, EMRDiagnosisInput,
  EMROfflineBanner. Build angio-native equivalents only where a page actually needs one.
- **Playwright `--fullpage`** flag isn't supported by angio's `cmd.ts` — normal viewport
  screenshots work fine.

---

## 10. Working discipline

- **Match before you add:** read each file before editing; copy its existing style.
- **One area at a time**, small batches (≤ 3 files per edit pass for multi-file CSS work) —
  never a global regex sweep across the codebase (it corrupts nested JSX/CSS).
- **Preserve, don't rewrite:** if a wrapper can't express a usage 1:1, record a justified
  exception in `audit-findings/ui-orphan-exceptions.md` rather than forcing a misfit or
  falling back to inline styling.
- Keep a running progress log (which areas are done / verified) so the goal can resume cleanly.
