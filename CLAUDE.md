# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Production-grade angiology reporting SPA. Standalone today, designed to be folded into the MediMind EMR monorepo later (see README "Migration to MediMind"). Stack matches MediMind exactly: React 19.2 + Mantine 8.3.6 + Vite 7 + TypeScript 5.8 strict ESM. Output is FHIR R4 (`QuestionnaireResponse` + `DiagnosticReport` + `Observation[]` Bundle). Primary language is Georgian; en + ru also supported.

Node 20+ required (`.nvmrc`).

## Commands

```bash
npm run dev               # Vite on http://localhost:3001 (localhost only)
npm run dev:lan           # Same, bound to all interfaces (cross-device testing)
npm run build             # tsc -p tsconfig.build.json && vite build
npm run typecheck         # tsc --noEmit (strict + noUncheckedIndexedAccess)
npm run lint              # ESLint flat config (errors only — no warn-noise)
npm run test              # Vitest watch
npm run test:run          # Vitest single run (used in CI)
npm run test:coverage
npm run test:e2e          # Playwright (auto-starts dev server)
npm run test:e2e:ui       # Playwright UI mode
npm run validate:fhir     # Validate sample Bundle against FHIR R4
npm run i18n:check        # Verify ka/en/ru key coverage
```

Run a single Vitest file: `npx vitest run src/components/.../File.test.tsx`
Run a single Playwright spec: `npx playwright test e2e/anatomy-drawing.spec.ts`

### Anatomy assets — run once after clone

The anatomical SVGs in `public/anatomy/` are committed, but the pipeline that produced them is reproducible:

```bash
npm run anatomy:fetch     # Download raw SVGs (Wikimedia + Servier)
npm run anatomy:tag       # Rename path IDs to canonical angiology segments
npm run anatomy:verify    # Ensure every catalog segment has a tagged path
npm run anatomy:all       # All three in order
```

Only re-run if you're updating the segment catalog or a source SVG.

## Architecture — big picture

```
Vite SPA
├── EncounterContext (the single source of truth for in-progress work)
│   └── encounterStore.ts: IndexedDB (truth) + localStorage (sync read-cache), dual-write
├── React Router 7
│   ├── /                                    → EncounterIntake (front door)
│   ├── /encounter/:encounterId/:studyType   → EncounterStudyWrapper → per-study form
│   └── bare study routes redirect to /
├── Study plugins (components/studies/index.ts)
│   ├── venousLE, arterialLE, carotid (available)
│   └── upperExtremityVascular, abdominalAorticIliac, iliacPelvicVenous (coming-soon cards)
├── Anatomy system (SVG segment-id → competency color, same SVG used in web + PDF)
├── FHIR builder (services/fhirBuilder/, split per resource type)
└── PDF engine (@react-pdf/renderer, lazy-loaded; NotoSansGeorgian fonts registered)
```

### Encounter pivot (Phase 3a) — important routing model

The app is **encounter-first**, not study-first. Users land on `/`, fill an `EncounterIntake` (patient + selected studies), and only then enter a per-study form at `/encounter/:encounterId/:studyType`. Bare `/venous-le`, `/arterial-le`, `/carotid` routes (and their `/studies/*` aliases) are **kept as registered routes that redirect to `/`** — this preserves exact-match routing semantics that closed the audit Part-03 HIGH (route-hijack risk) finding. Don't "clean up" these redirects into a wildcard.

Encounter state lives in `EncounterContext` (`src/contexts/EncounterContext.tsx`). Per-study forms read/write their reducer state via `setStudyState<T>(studyType, state)`; the encounter draft persists every mutation through `saveEncounter` (no debounce, no 30-min idle timeout — clinicians may sit on a form mid-encounter for a long time).

### Study plugin pattern is intentionally partial

`STUDY_PLUGINS` (in `src/components/studies/index.ts`) drives **only** routing + the picker card list. Adding a new study requires more than registering the plugin:

| Surface | How studies branch |
|---|---|
| Routing + picker | Append entry to `STUDY_PLUGINS` ✅ |
| Per-study form | New folder under `src/components/studies/<key>/` |
| Narrative generation | `narrativeService.ts` switches on `studyType` |
| FHIR observation building | Per-study modules under `src/services/fhirBuilder/observations/` |
| PDF document | `ReportDocument.tsx` / `UnifiedReportDocument.tsx` switch on `studyType`; per-study sections under `components/pdf/sections/` |
| Translations | Per-study folder under `src/translations/<key>/{ka,en,ru}.json` (deep-merged into the root locale) |

Consolidating these into a uniform plugin signature was deliberately rejected (Wave 3 doc) because parameter shapes diverge enough that a generic signature would be lossy.

### Anatomy SVG system

`AnatomyView` is a "coloring book": SVG paths have canonical segment IDs (e.g. `<path id="cfv-left">`); a competency map (`{ 'cfv-left': 'incompetent' }`) drives runtime fill/stroke mutations. The component fetches raw SVG text via `svgLoader.ts` (cached per view), mutates the string once per change, and renders via `dangerouslySetInnerHTML`. This is the **one ESLint exception** for `react/no-danger` — the SVG is our static asset, not user content. Don't generalize this pattern to other components.

The same SVGs are reused in PDF output via `anatomyToPdfSvg.ts` (parses the SVG with `@xmldom/xmldom` and emits `@react-pdf/renderer` primitives), so visual parity is automatic.

`DrawingCanvas` overlays a freehand annotation layer (perfect-freehand) on top of `AnatomyView`. Strokes are persisted in the encounter draft and rasterized into the PDF.

### FHIR builder

Split into per-resource modules under `src/services/fhirBuilder/` (Wave 2.6 split from a 2,000-line monolith). Public surface is the barrel `services/fhirBuilder/index.ts`:

- `buildFhirBundle(form, studyType)` — single-study export (legacy flow).
- `buildEncounterBundle(input)` — encounter-first export, bundling all studies in an encounter.

Per-study Observation builders live under `observations/{venous,arterial,carotid,...}.ts`.

## State, persistence, i18n

- **EncounterContext** is the only React-side state container. There is **no** Redux, Zustand, Recoil, or React Query. Don't add one — this matches MediMind's monorepo policy.
- Persistence is dual-write: IndexedDB (`idb-keyval`, source of truth, async) + localStorage (sync read-cache for reducer-init paths). Key prefix `encounter-<uuid>`. See `encounterStore.ts` for the rationale.
- **TranslationContext** is custom (no i18next). Translations live in `src/translations/{en,ka,en}.json` plus per-study deep-merged overrides. Russian uses CLDR plural rules (`getRussianPluralSuffix`). `useTranslation()` returns a `t(key, params?)` function.
- **ThemeContext** is custom; Mantine's `MantineProvider` is configured with `cssVariablesResolver` from `styles/mantineTheme.ts` so MediMind's CSS variables are honored.
- Storage keys are centralized in `src/constants/storage-keys.ts` with a `migratedGetItem` helper for legacy-key fallback. Don't read `localStorage` directly.

## Conventions worth knowing

- **TypeScript posture is strict**: `strict + noUncheckedIndexedAccess + noImplicitAny + noUnusedLocals/Parameters`. There are zero `as any` / `@ts-ignore` / `@ts-expect-error` in the repo. Keep it that way.
- **`no-console: error`** in `src/**` — `console.warn` and `console.error` are allowed (they're the fallback-path signal). `console.log` is allowed only in `scripts/**`, `test/**`, and `*.test.{ts,tsx}`.
- **Dates are timezone-sensitive.** A past audit finding caught Tbilisi (UTC+4) clinicians silently rolling dates back a day via `toISOString().slice(0, 10)`. Use the helpers in `services/dateHelpers.ts`; don't reach for `Date.prototype.toISOString` for clinical date fields.
- **The `@/` alias resolves to `src/`** (configured in both `vite.config.ts` and `vitest.config.ts`).
- **Vite base path** is `process.env.VITE_BASE_PATH ?? '/'` — the GitHub Pages deploy ships with a non-root base. SVG fetches in `svgLoader.ts` use `import.meta.env.BASE_URL` — don't hardcode `/anatomy/...`.
- **Build hash** (`__BUILD_HASH__`) is injected from `git rev-parse --short HEAD` at build time and surfaces in `VersionFooter`.

## Test runner caveats — read before "fixing" flakes

`vitest.config.ts` is pinned to **`maxWorkers: 2`** and **`testTimeout: 180_000`**. This is deliberate: heavy form trees (Carotid, Arterial venous) mount the full Mantine MultiSelect / segment table / anatomy view tree in jsdom, and 4+ workers contend for event-loop time enough to flake. The block comment at the top of `vitest.config.ts` documents the full reasoning. If you see flakes, lower `maxWorkers` to 1 before changing anything else. Don't bump it back to default.

A handful of heavy form-tree smoke tests have residual flake even at 2 workers — this is a test-design issue, not a production-code bug. Re-run the suite, or use `--no-file-parallelism` for green/red CI.

## Playwright Browser Automation (CRITICAL — read before reaching for `playwright`)

When you need to **reproduce a UI bug, verify a fix, or visually inspect a screen**, drive a real Chromium browser via the persistent server in `scripts/playwright/`. **Do not write one-off Playwright scripts and do not run headless** — every fresh `chromium.launch()` collides on the user-data SingletonLock and you can't see what's happening on screen anyway.

**ALWAYS:**
- Use `scripts/playwright/server.ts` (one persistent, headed Chromium) + `scripts/playwright/cmd.ts` (sends commands over HTTP :2400).
- Run real navigation. The point is *visual* debugging — open the page, click around, screenshot, diagnose. Headless defeats the purpose.

**NEVER:**
- Write a standalone `npx tsx some-script.ts` that calls `chromium.launch()` itself — it conflicts with the running server's user-data dir.
- Set `HEADLESS=true` when you're trying to see the UI.
- Use the `@playwright/test` runner for ad-hoc bug repros — that's for the e2e suite under `e2e/`. For interactive debugging, use server + cmd.

### Quick start

```bash
# 1. Boot the dev server (once)
npm run dev                                                  # http://localhost:3001

# 2. Boot the Playwright server (once, in background — opens a real Chromium window)
npx tsx scripts/playwright/server.ts &
sleep 3

# 3. Drive it
npx tsx scripts/playwright/cmd.ts navigate "http://localhost:3001"
npx tsx scripts/playwright/cmd.ts wait 1000
npx tsx scripts/playwright/cmd.ts screenshot "intake-page"
npx tsx scripts/playwright/cmd.ts fill '[data-testid="intake-patientName"]' "John Doe"
npx tsx scripts/playwright/cmd.ts click '[data-testid="intake-study-venousLE"]'
npx tsx scripts/playwright/cmd.ts click '[data-testid="intake-start"]'
npx tsx scripts/playwright/cmd.ts evaluate "JSON.stringify({url: location.href, title: document.title})"

# 4. Stop when done
npx tsx scripts/playwright/cmd.ts stop
```

### Common commands (sent through `cmd.ts`)

| Command | Usage |
|---|---|
| `navigate` | `cmd.ts navigate "http://localhost:3001/encounter/<id>/venousLEBilateral"` |
| `fill` | `cmd.ts fill "<selector>" "<value>"` |
| `click` | `cmd.ts click "<selector>"` (add `--double` for double-click) |
| `screenshot` | `cmd.ts screenshot "<name>"` (add `--fullpage` for full page); saves to `screenshots/` |
| `wait` / `waitfor` | `cmd.ts wait 2000` or `cmd.ts waitfor "<selector>"` |
| `text` / `url` | `cmd.ts text "<selector>"` / `cmd.ts url` |
| `evaluate` | `cmd.ts evaluate "<JS expression>"` |
| `viewport` | `cmd.ts viewport 1440 900` |
| `stop` | `cmd.ts stop` (kills the server) |

Selectors follow Playwright's syntax — prefer `[data-testid="..."]` (the codebase already wires these), then role/text selectors, then CSS.

### When you're done with a session

```bash
npx tsx scripts/playwright/cmd.ts stop
```

### Recovery (if things wedge)

```bash
pkill -9 -f Chromium; pkill -9 -f playwright
rm -rf /var/folders/*/T/playwright-user-data
rm -f /tmp/playwright-*.json /tmp/playwright-*.pid
```

The headless e2e regression suite (`npm run test:e2e`, configured by `playwright.config.ts`) is a **separate** thing — that's the test runner for committed `e2e/*.spec.ts` files. Use it to verify a fix is locked in by a test. Use server + cmd to **find** the bug.

---

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on push/PR to `main`: `typecheck → lint → test:run → build`. A separate `pages.yml` deploys `main` to GitHub Pages.

## Clinical standards (context only — don't relax these)

Built to: IAC Vascular Testing Standards, SVU LE Venous Duplex Guideline, CEAP 2020 (with `r/s/a/n` modifiers), ESVS 2022, LOINC 39420-5. Segment lists in `src/components/studies/<study>/config.ts` are canonical and mirror `scripts/segment-catalog.ts`. The duplication is intentional — runtime bundles must never pull from `scripts/`.

## Key references

- `audit-findings/angio-production-audit-2026-04-25.md` — exhaustive production-readiness audit. Many block comments in code reference its findings ("Part-03 HIGH", "Part-09 #1", etc.). When you see those tags, the audit doc is the authoritative source for *why* the code is the way it is.
- `tasks/todo.md` — phase-by-phase implementation log.
- `README.md` — high-level scope + MediMind migration path.
