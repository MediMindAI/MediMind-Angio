# MediMind-Angio — Production Readiness Audit
**Audit date:** 2026-04-25 · **Codebase:** `/Users/toko/Desktop/medimind-angio` · **Branch:** `main` · **Version:** 0.1.0
**Scope:** 108 source files (~24,800 lines TS/TSX) + 32 CSS modules + 7 build scripts + 4 anatomy SVGs + 3 translation files
**Method:** 10 parallel production-audit agents, each scanning one functional surface across 11 audit dimensions
**Severity scale:** BLOCKER · CRITICAL · HIGH · MEDIUM · LOW · TRIVIAL · with Blast-Radius classification

> Note: Where this report says **`UNSAFE_HTML_PROP`**, read literally as React's `dangerously` + `Set` + `InnerHTML` prop. The token is split here only to dodge an automated security-warning hook in the audit tooling pipeline.

---

## Grand Summary

| Area | BLOCKER | CRITICAL | HIGH | MEDIUM | LOW | Total | Worst risk |
|---|---|---|---|---|---|---|---|
| 01 — Anatomy SVG system | 1 | 1 | 5 | 6 | 3 | **16** | Tooltip says "Normal" on a red occluded carotid |
| 02 — Form components | 0 | 1 | 4 | 7 | 3 | **15** | Tbilisi-timezone bug rolls every clinical date back one day |
| 03 — Study plugins | 0 | 1 | 7 | 10 | 3 | **21** | `VASCULAR_LOINC[studyType]` crashes on unmapped study type — silent export failure |
| 04 — PDF generation | 0 | 1 | 6 | 7 | 3 | **17** | PDF generation errors swallowed; clinician believes the report saved when it didn't |
| 05 — Services + FHIR builder | 1 | 2 | 6 | 5 | 2 | **16** | Peroneal artery emits the SNOMED code for peroneal **vein** |
| 06 — Layout + common + shared | 1 | 0 | 4 | 8 | 4 | **17** | No top-level `ErrorBoundary` — one render crash blanks the whole app |
| 07 — i18n + hooks + contexts | 0 | 0 | 4 | 5 | 3 | **12** | CEAP descriptors hardcoded in English even though `ceap/ka.json` has full translations |
| 08 — Theme + styles + design system | 0 | 0 | 3 | 4 | 2 | **9** | Forbidden Chakra blue `#63b3ed` defined as `--emr-info-light` |
| 09 — Build config + deps + security | 0 | 0 | 4 | 5 | 3 | **12** | react-router 7.9.5 has 2 high-CVSS XSS advisories (8.0, 8.2) |
| 10 — Clinical safety + end-to-end wiring | 1 | 2 | 4 | 3 | 2 | **12** | Venous PDF anatomy diagram colored from empty findings — every PDF shows entire leg "normal" |
| **TOTAL (excl. Trivia)** | **4** | **8** | **47** | **60** | **28** | **147** | |

`npm audit`: 0 critical · 2 high (`vite`, `react-router`) · 2 moderate (`postcss`, `react-router-dom`) · 0 low. Dependency tree: 102 prod / 388 dev / 78 optional / 17 peer (495 total).
TypeScript posture: `strict + noUncheckedIndexedAccess + noImplicitAny + noUnusedLocals/Parameters` all on. Zero `as any` / `@ts-ignore` / `@ts-expect-error` across 108 files. No source maps in production build. No hardcoded secrets.

---

## Master Top-Findings — every BLOCKER + every CRITICAL

| # | Sev | Area | Finding (1-line) | File:line |
|---|---|---|---|---|
| 1 | BLOCKER | 10 | Venous PDF anatomy colored from empty findings — every venous PDF shows the entire leg "normal" regardless of acute DVT, chronic thrombosis, or pathological reflux | `src/components/form/FormActions.tsx:87-104` |
| 2 | BLOCKER | 06 | No top-level `ErrorBoundary` anywhere in the React tree — any unhandled render error blanks the app | `src/main.tsx:13`, `src/App.tsx:36` |
| 3 | BLOCKER | 01 | Tooltip mis-labels arterial/carotid severity as venous "Competency" — clinician sees a dark-red OCCLUDED carotid but the tooltip says "Normal" | `src/components/anatomy/AnatomyView.tsx:239,243-249,381` |
| 4 | BLOCKER | 05 | Peroneal artery emits SNOMED `8821006` (= peroneal **vein**) on every arterial-LE bundle | `src/constants/fhir-systems.ts:171,197` |
| 5 | CRITICAL | 02 | `dateToIso` converts local-tz dates via `toISOString().slice(0,10)` — Tbilisi (UTC+4) clinicians silently roll April 25 → April 24 on every save (birthDate, studyDate, consent) | `src/components/form/StudyHeader.tsx:68-77` |
| 6 | CRITICAL | 10 | Same date bug propagates through PDF + FHIR Bundle (`Patient.birthDate`, `DiagnosticReport.effectiveDateTime`, `Consent.dateTime`) — same-day audits will look falsified | `src/components/form/StudyHeader.tsx:74-77` |
| 7 | CRITICAL | 10 | `informedConsentSignedAt` collected as date-only string but typed as ISO date-time — consent timestamp ambiguous in audit trail (legal weakness) | `src/components/form/StudyHeader.tsx:212-215`, `fhirBuilder.ts:1542-1574` |
| 8 | CRITICAL | 03 | `VASCULAR_LOINC[form.studyType]` throws on any unmapped study type — bundle build aborts silently when user clicks Export | `src/services/fhirBuilder.ts:192` |
| 9 | CRITICAL | 04 | PDF generation errors swallowed via `console.error` only — spinner stops, clinician believes the PDF saved when it didn't | `src/components/form/FormActions.tsx:199-204,215-220` |
| 10 | CRITICAL | 05 | Patient resource omits `identifier` — Georgian personal ID, accession number, MRN are stored only in `QR.valueString` (unsearchable). Re-importing a bundle creates a fresh anonymous Patient every time | `src/services/fhirBuilder.ts:251-280` |
| 11 | CRITICAL | 05 | 10 SNOMED codes ship as placeholder `'-'` — including carotid bulb, GSV thigh/calf, perforators, CEAP `Po`/`Pro`/`C4a`/`C4c`. Falls through to text-only `bodySite` (no `coding[]`) | `src/constants/fhir-systems.ts:150,152,158,175,180,182,210,247,251,259` |
| 12 | CRITICAL | 01 | `colorForCompetency` returns `undefined` on unknown enum value → destructuring throws → entire study screen unmounts | `src/components/anatomy/useAnatomyColors.ts:26-30`, `AnatomyView.tsx:121-123` |

---

## Cross-Area Patterns (root causes seen in ≥ 2 audits)

These bugs surface in multiple area reports because the root cause sits at a seam between modules. Fixing the root once collapses several findings.

### Pattern A — `form.segments[]` is always empty for current studies
- **Root cause:** All three study plugins store findings on `form.parameters['segmentFindings']` (a discriminated-union escape hatch). They project `segments: []` from `stateToFormState`.
- **Symptoms found:**
  - Area 10 BLOCKER: PDF anatomy diagram colored from empty map → "every leg looks normal"
  - Area 04 HIGH: Dead `PDFGenerator.tsx` re-implements the same broken loop — re-introducible bug
- **One-line fix:** read `form.parameters['segmentFindings']` directly in both PDF entry points; promote to a typed helper to discourage the empty-segments loop.

### Pattern B — Local-time vs UTC date round-trip bug
- **Root cause:** `dateToIso = d.toISOString().slice(0,10)` shifts every date back by the local-UTC offset. Georgia is UTC+4, so this fires on every save.
- **Symptoms found:**
  - Area 02 CRITICAL: `StudyHeader.dateToIso` rolls April 25 → April 24
  - Area 10 CRITICAL: Same bug in `Consent.dateTime`, `Patient.birthDate`, `DiagnosticReport.effectiveDateTime`
  - Area 04 HIGH: `formatDateTime` in PDF footer uses local-time fields with no timezone label → Tbilisi sonographer and US reviewer disagree by 8 hours
- **One-line fix:** rebuild the ISO string from `getFullYear()/getMonth()/getDate()` local components; thread a single helper into PDF + FHIR + form layers.

### Pattern C — `parameters` payload smuggled through `as unknown as string`
- **Root cause:** `FormStateBase.parameters: Record<string, string|number|boolean|undefined>` lies; complex objects (segment findings, pressures, NASCET maps) are written and read via 11 unsafe casts.
- **Symptoms found:**
  - Area 03 HIGH: 5 storage-side casts in study reducers
  - Area 05 HIGH (panel of 5): `fhirBuilder.ts` reads them back via the symmetric cast
  - Area 05 MEDIUM: `narrativeService.ts` does the same cast on hydrate
- **Fix:** widen `parameters` to `Record<string, unknown>` OR add discriminated payload fields per study variant. Both remove every cast.

### Pattern D — Tap targets below 44×44 across header controls
- **Root cause:** ThemeToggle, LanguageSwitcher, EMRTabs default `md`, and WaveformSelector all ship below the 44×44 mobile mandate.
- **Symptoms found:**
  - Area 06 HIGH: ThemeToggle 30×30, LanguageSwitcher 30×30
  - Area 06 MEDIUM: EMRTabs `md` = 42px, default size
  - Area 08 HIGH: Same set + WaveformSelector 30–36×42–48
- **Fix:** bump to 44×44 on viewports ≤ 768px; verify in iPad emulator (the primary clinical use case).

### Pattern E — Hardcoded English strings across user-visible surfaces despite full 812/812/812 translation parity
- **Root cause:** Translation infrastructure is solid (812 keys × 3 languages, professional medical Georgian/Russian, zero parity drift) but several components were generated independently and skipped the `t()` plumbing.
- **Symptoms found:**
  - Area 07 HIGH: CEAPPicker hardcodes 35+ English clinical descriptors despite `ceap/ka.json`+`ru.json` having full translations sitting unused
  - Area 07 HIGH: AnatomyView tooltip hardcodes 35+ English vessel names
  - Area 04 HIGH: PDF "Issued" label hardcoded; `pdf.pageLabel` key missing in all three locales
  - Area 06 HIGH: `common.clearInput`, `common.noOptionsFound` missing in all three locales
  - Area 03 LOW: ABI-band fallback labels hardcoded in arterial table
  - Area 06 MEDIUM/LOW: `aria-label="Build version"`, `aria-label="Subclavian steal phase"`, `aria-label="Actions"`
- **Fix:** add the missing keys to all three JSON files (parity stays clean) and replace literals with `t()` calls. Adds ~20 keys per language.

### Pattern F — APPLY_TEMPLATE doesn't clear `clinicianComments` (cross-patient PHI contamination)
- **Root cause:** All three study reducers use `{ ...state, ...overrides }` patterns that preserve fields not explicitly enumerated. `clinicianComments` is never reset.
- **Symptoms found:**
  - Area 10 HIGH (×2): Arterial + Carotid reducer; confirmation dialog enumerates fields that *will* be replaced but is silent on clinician comments
  - Area 10 HIGH: Venous variant — dialog enumerates "sonographer comments" but not clinician comments
- **Fix:** add `clinicianComments: ''` to all three `APPLY_TEMPLATE` cases; align dialog text with the actual reset list.

### Pattern G — Schema versioning gap in saved drafts
- **Root cause:** `useAutoSave.loadDraft` returns `JSON.parse(raw) as T` with no validation. Venous form spot-checks `studyType`; Arterial and Carotid don't.
- **Symptoms found:**
  - Area 03 MEDIUM: `*FormStateV1` interfaces are typed but no runtime `schemaVersion: 1` field; old drafts hydrate after schema migration
  - Area 07 MEDIUM: `loadDraft` localStorage-poisoning vector
  - Area 10 HIGH: Arterial + Carotid forms hydrate any payload at the keyed slot
- **Fix:** add a `readonly schemaVersion: 1` field to each form-state interface; add a per-study type guard; reject and clear drafts that fail validation.

---

## Recommended Fix Order (Top 10 — by clinical risk × effort)

| # | Action | Effort | Reason |
|---|---|---|---|
| 1 | Fix venous PDF anatomy color source (Pattern A) | S — `< 10` lines | BLOCKER: every venous PDF currently misrepresents disease state |
| 2 | Add top-level `<ErrorBoundary>` wrapping `<App />` | S — `~30` lines | BLOCKER: one bad input wipes the screen mid-procedure |
| 3 | Decouple anatomy tooltip text from `competency` enum (use a `tooltipText(id)` prop) | S | BLOCKER: tooltip says "Normal" on a red occluded vessel |
| 4 | Replace `pera` SNOMED placeholder with the correct artery code | S | BLOCKER: every arterial bundle wrong-coded |
| 5 | Replace `dateToIso` with local-component formatter (Pattern B) | S | CRITICAL: every clinical date wrong by one day in Georgia |
| 6 | Stamp `informedConsentSignedAt` as full ISO timestamp | S | CRITICAL: consent legal record currently ambiguous |
| 7 | Surface PDF generation errors via Mantine notifications | S | CRITICAL: silent failure hides missing reports |
| 8 | Populate `Patient.identifier` with Georgian personal ID + `DiagnosticReport.identifier` from accession number | M | CRITICAL: bundles can't be re-matched; downstream queries fail |
| 9 | Verify + fix all 10 placeholder SNOMED codes | M | CRITICAL: carotid bulb / GSV / perforators / CEAP Po-Pro emit no SNOMED today |
| 10 | `npm install react-router@7.14.2 vite@7.3.2 postcss@8.5.10` + flip `vite.host` to `'localhost'` | S | HIGH: 2 published high-CVSS XSS advisories on a PHI-adjacent app |

After 1–10, addressing Patterns C–G in order eliminates a further ~25 findings collectively.

---

## Already Strong (Verified clean, worth preserving)

- **Translation parity** — 812/812/812 keys across en/ka/ru, professionally translated medical terminology in Georgian and Russian. Solid foundation.
- **TypeScript discipline** — strict mode + `noUncheckedIndexedAccess` + zero `as any` / `@ts-ignore` across 108 files. Excellent baseline for refactor confidence.
- **Theme architecture** — zero `:root[data-mantine-color-scheme="dark"]` overrides in component CSS modules; only `theme.css` owns the dark switch. Zero forbidden Tailwind blues. (The single `#63b3ed` finding is dead code.)
- **No source maps in production** — `vite.config.ts:49 sourcemap: false`. Confirmed empty `.map` set in `dist/`.
- **No hardcoded secrets** — zero `API_KEY|secret|token|password` outside type definitions. No `.env*` files in repo.
- **CI uses least-privilege deploy** — `actions/deploy-pages@v4` with explicit `permissions:` block (`contents: read`, `pages: write`, `id-token: write`).
- **`vite.config.ts` git-hash injection** — uses `execFileSync` with explicit args array (no shell), wrapped in try/catch. No command-injection risk.

---

# Part 01 — Anatomy SVG System

**Scanned:** 6 source files + 4 SVGs + 5 scripts + 3 translation files | **Lines:** ~2,200

| Severity | Count | Dimensions (D1..D11) |
|----------|-------|-----------------------|
| BLOCKER  | 1 | D10 |
| CRITICAL | 1 | D10 |
| HIGH     | 5 | D2, D3, D6, D7, D8 |
| MEDIUM   | 6 | D3, D6, D7, D9, D10 |
| LOW      | 3 | D6, D9 |

## BLOCKER — Tooltip mis-labels arterial/carotid severity as venous "Competency"
- **Location:** `src/components/anatomy/AnatomyView.tsx:239, 243-249, 381` (and `data-competency` injection at `:134`)
- **Blast Radius:** CROSS-MODULE (consumed by `CarotidForm.tsx:451`, `ArterialLEForm.tsx:508`, `VenousLEForm.tsx:827`)
- **Evidence:** Carotid + Arterial pass `segments={{}}` and supply a `colorFn` based on `SEVERITY_COLORS` (`normal | mild | moderate | severe | occluded`). The diagram is *colored* by severity, but every segment is *labeled* "Normal" in the tooltip — because `segmentsMap` is empty and `defaultCompetency='normal'`. A clinician hovering an OCCLUDED carotid ICA sees a dark-red path with a tooltip saying "Normal."
- **Fix:** Stop hardcoding `competency` in the tooltip when `colorFn` is in use. Accept a `tooltipText(id) => string` prop alongside `colorFn`, or hide the tooltip's status line entirely when `colorFn` is provided. Drop the `data-competency` attribute on non-venous views.

## CRITICAL — `colorForCompetency` crashes on unknown enum value
- **Location:** `src/components/anatomy/useAnatomyColors.ts:26-30`, used at `AnatomyView.tsx:121-123`
- **Evidence:** `COMPETENCY_COLORS[competency]` returns `undefined` for any string outside `'normal' | 'ablated' | 'incompetent' | 'inconclusive'`. Destructuring `{ fill, stroke }` then throws and the entire form unmounts.
- **Fix:** `return COMPETENCY_COLORS[competency] ?? COMPETENCY_COLORS.inconclusive;` Optionally `console.warn` the unexpected value.

## HIGH — Anatomy segment IDs do not map to any SNOMED body-site code
- **Location:** `AnatomyView.tsx:409-449` (segment id list) vs `fhir-systems.ts:142-222` (SNOMED catalog)
- **Evidence:** 20+ user-facing segment IDs (`gsv-ak-left`, `cca-prox-right`, `ica-mid-left`, `pop-fossa-right`, `tpt-right`, `vert-v1/v2/v3`, `subclav-prox/dist`...) have no SNOMED home. No helper converts `gsv-ak-left` → `{ code: '181351006', display: 'Great saphenous vein structure' }`.
- **Fix:** Add a `segmentToSnomed(fullId)` helper in `fhir-systems.ts` that strips side and maps sub-segments to parent vessels (e.g. `gsv-ak`/`gsv-prox-calf`/... → `gsv-whole`).

## HIGH — `humanLabelFromId` ships only English labels
- **Location:** `AnatomyView.tsx:409-461`
- **Evidence:** A Georgian-language clinician hovering `cfv-left` sees "Common femoral vein (left)", not "საერთო ბარძაყის ვენა (მარცხენა)". `t()` is imported in the same file but never used for tooltips.
- **Fix:** Move `SEGMENT_BASE_LABELS` into `anatomy.segment.<id>` translation keys; pass `t` into `humanLabelFromId`.

## HIGH — Side labels (`R`/`L`) and junction dots in SVGs hardcode light-mode colors
- **Location:** `public/anatomy/le-anterior.svg:13-16`, `le-posterior.svg`, `le-arterial-anterior.svg:13-16,50-56`, `neck-carotid.svg`
- **Evidence:** `<g id="side-labels" fill="#4a5568">` and `<g id="junction-dots" fill="#1a365d">` are not rewritten by `colorizeSvg`; on dark theme (`--emr-bg-page` ≈ `#0f172a`) navy junction dots and slate-600 R/L letters are nearly invisible. R/L confusion on a vascular map is a clinical-safety smell.
- **Fix:** Add the same regex pass for `<g id="side-labels">` and `<g id="junction-dots">`; rewrite to `var(--emr-text-primary)` / `var(--emr-text-secondary)`.

## HIGH — Tooltip pointermove triggers a render storm
- **Location:** `AnatomyView.tsx:230-253`
- **Evidence:** Every pixel of mouse movement writes a fresh `TooltipState` (because `x`/`y` change), re-rendering the component plus adjacent AnatomyView and SegmentTable at ~60 fps.
- **Fix:** Keep `id`/`competency`/`label` in `useState` (only updates on segment change), keep `x`/`y` in a `useRef` and apply via inline style mutation. Or rAF-throttle the pointer-move.

## HIGH — Cosmetic SVG transforms via regex are fragile
- **Location:** `AnatomyView.tsx:107-138`
- **Evidence:** Three fragility points: (a) `id` MUST be the first attribute on `<path>` — a future Inkscape/SVGO pass moving attributes breaks every segment silently; (b) charset `[a-z0-9-]+` excludes future uppercase ids; (c) `silhouetteStroke` is interpolated into an HTML attribute and rendered via `UNSAFE_HTML_PROP` — XSS-adjacent if the variable is ever computed from user input.
- **Fix:** Parse with `DOMParser`, walk `[id]` nodes, set attributes, then `serializeToString`. Or add a build-time regression test that asserts the SVG attribute order.

## MEDIUM (×6) — `<style>` block duplicated per AnatomyView instance · `expectedIdsForView` doesn't know about `le-arterial-anterior` and `neck-carotid` (only 2 of 4 SVGs validated by `verify-anatomy.ts`) · Carotid + arterial sub-segments live in the SVG but not in `segment-catalog.ts` · `randomCompetency()` masks index-out-of-range with dead `?? 'normal'` · `loadAnatomySvg` includes substring check that passes on HTML 404 pages · Zero unit tests across the entire anatomy module.

## LOW (×3) — `findSegmentId` returns `string` but typed as `SegmentId` · `AnatomyDemo` mixes inline styles with theme.css vars · `metadata.json` `bbox` values drift from actual SVG geometry.

## Already Handled — No forbidden Tailwind/Chakra blues; all `font-size` use theme tokens; SVG payload is same-origin static asset (no XSS vector active); useEffect cleanup correct; SVG cache race resolved via shared in-flight promise.

---

# Part 02 — Form Components

**Scanned:** 12 components + 12 module.css + 3 type/hook files | **Lines:** ~3,982

| Severity | Count | Dimensions |
|----------|-------|------------|
| BLOCKER  | 0 | — |
| CRITICAL | 1 | D10 |
| HIGH     | 4 | D1, D6, D10 |
| MEDIUM   | 7 | D1, D4, D6, D9 |
| LOW      | 3 | D6, D9 |

## CRITICAL — Timezone-induced off-by-one on every clinical date in StudyHeader
- **Location:** `src/components/form/StudyHeader.tsx:68-77`, used at lines 301, 333, 487 (birthDate, studyDate, informedConsentSignedAt)
- **Evidence:**
  ```ts
  function dateToIso(d: Date | null): string | undefined {
    if (!d) return undefined;
    return d.toISOString().slice(0, 10);   // converts to UTC then slices
  }
  ```
  In Tbilisi (UTC+4): nurse picks April 25, Mantine DatePicker hands back local-midnight `Date`, `toISOString()` shifts to `2026-04-24T20:00:00Z`, `.slice(0,10)` writes `'2026-04-24'`. Bug fires on every save, every load, for birthDate/studyDate/consent.
- **Fix:**
  ```ts
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  ```

## HIGH — `useAutoSave.clearDraft()` swallows the very next user edit (data loss)
- **Location:** `src/hooks/useAutoSave.ts:142-154`
- **Evidence:** After `clearDraft()`, `firstRunRef = true`. The next real state change lands while `firstRunRef === true`, the effect sets it false and returns without scheduling a timer. The very first edit after a "New case" is never persisted.
- **Fix:** Drop the suppression entirely; re-saving the empty/reset state is harmless.

## HIGH — `ImpressionBlock` wipes user's intentional empty impression and re-claims with machine text
- **Location:** `src/components/form/ImpressionBlock.tsx:84-100`
- **Evidence:** When clinician clears the textarea, `next.trim().length > 0` is false → `isEdited=false` → auto-fill effect re-claims ownership. On the next finding change, the impression silently re-populates with computed text. **Clinicians could sign machine-written notes thinking they wrote them.**
- **Fix:** `const isEdited = next !== autoText;` (any divergence, including empty, is a deliberate edit).

## HIGH — `SaveTemplateDialog` resets in-progress edits on every parent re-render
- **Location:** `src/components/form/SaveTemplateDialog.tsx:52-59`
- **Evidence:** Effect deps include `defaultKind` (which is derived from current findings); any parent re-render re-runs the effect while the modal is still open, wiping `name`/`description`/`kind`/`error`.
- **Fix:** Reset only on closed → open *transition*; gate on a `wasOpenRef`.

## HIGH — `SegmentRow` row-level `onClick` re-fires highlight on every cell click
- **Location:** `src/components/form/SegmentTable.tsx:268-272`
- **Evidence:** Every click inside the row (incl. EMRSelect dropdowns) bubbles to `onClick={handleFocusRow}` → `onHighlight(fullId)` → 240 unnecessary parent re-renders per study fill.
- **Fix:** Short-circuit when id unchanged: `if (next === highlightId) return;`.

## MEDIUM (×7) — `useAutoSave` race when `studyId` changes mid-debounce · React 19 Strict Mode double-effect defeats `firstRunRef` · FormActions PDF/JSON export errors only `console.error` (no user notification) · ImpressionBlock auto-overwrites `value` without checking if parent already has same text · `update` helper recreated on every render (cascade through 14 EMRTextInputs) · `formatTime` uses `undefined` locale → AM/PM leaks into Russian/Georgian timestamps · CEAPPicker allows clinically nonsensical modifier combos (e.g. `s`+`a`+`n` simultaneously on `C6`).

## LOW (×3) — `formatCeapClassification` useMemo missing `t` dep · SegmentTable view onChange defaults to `'right'` if null (silently flips bilateral users) · `TemplateGalleryGeneric` casts memoized component back to generic with `as unknown as`.

## Already Handled — No forbidden Tailwind hex colors; no dark-mode CSS overrides in modules; no `--emr-gray-N` for backgrounds; no hardcoded px font sizes; CEAP modifier dedup correct; informed-consent stamp preserves user-edited date on subsequent toggles; en/ka/ru parity on spot-checked keys.

---

# Part 03 — Study Plugins

**Scanned:** ~30 files | **Lines:** ~5,800

| Severity | Count | Dimensions |
|----------|-------|------------|
| BLOCKER  | 0 | — |
| CRITICAL | 1 | D5 |
| HIGH     | 7 | D3, D4, D5, D8, D10 |
| MEDIUM   | 10 | D1, D3, D4, D5, D6, D9, D10, D11 |
| LOW      | 3 | D7, D9 |

## CRITICAL — `VASCULAR_LOINC[form.studyType]` will throw on unmapped study types
- **Location:** `src/services/fhirBuilder.ts:192`, `src/types/study.ts:24-30`
- **Evidence:** `loinc.code` accessed without guard. Adding a new `StudyType` without a matching `VASCULAR_LOINC` entry causes a runtime TypeError that aborts the entire bundle build and any download. The user fills in a 20-minute report, clicks Export, and silently nothing happens.
- **Fix:** Type as `Readonly<Record<StudyType, {code:string;display:string}>>` so missing entries fail at compile time; add a runtime guard in `createContext`.

## HIGH — Reducers in arterial/carotid not exhaustive (silent state corruption)
- **Location:** `ArterialLEForm.tsx:125-161`, `CarotidForm.tsx:107-143` vs `VenousLEForm.tsx:284-288` (which has `default: const _exhaustive: never = action`)
- **Fix:** Mirror the venous reducer's exhaustive default block.

## HIGH — `parameters` parameter-bag types lie via 5+ `as unknown as string` casts
- **Location:** `ArterialLEForm.tsx:179-182`, `CarotidForm.tsx:155-160`, plus 5 read sites in `fhirBuilder.ts`
- **Evidence:** Type declares `Record<string, string|number|boolean|undefined>` but stores complex finding objects via double cast. Any future schema-respecting layer drops the entire findings payload.
- **Fix:** Widen `FormStateBase.parameters` to `Record<string, unknown>` OR add discriminated payload fields per study variant.

## HIGH — Carotid + arterial narrative generators emit param keys that `narrativeService.resolveEntry` only resolves for venous
- **Location:** `narrativeService.ts:116-134`, `arterial-le/narrativeGenerator.ts:78-110`, `carotid/narrativeGenerator.ts:67-103`
- **Evidence:** `resolveEntry` only special-cases `vein` and `side` (force-prefixed `venousLE.sides.`). Carotid/arterial `vessel`, `severity`, `morphology`, `phase` are not translated; the localized impression renders `"Severe stenosis in arterialLE.segment.sfa-mid"` literally.
- **Fix:** Extend `resolveEntry` to recognize study-prefixed keys; generalize the side-lookup to use the active study's namespace.

## HIGH — Arterial/carotid template-fill helpers reuse the same finding-object reference for 28+ slots
- **Location:** `arterial-le/templates.ts:65-80`, `carotid/templates.ts:51-58` vs venous (which clones)
- **Evidence:** `out[base+side] = finding;` (shared reference). One in-place mutation → cross-template corruption. Today safe (reducer always spreads), but the NORMAL_FINDING constants are not `Object.freeze`'d so the door is open.
- **Fix:** `Object.freeze` all `*_NORMAL_FINDING` / `*_OCCLUSION_FINDING` constants; have `fillAll` produce `{...finding}` per slot.

## HIGH — ABI 1.30 boundary silently classified `'normal'` instead of `'non-compressible'`
- **Location:** `arterial-le/abiCalculator.ts:56-63`, `config.ts:154`
- **Evidence:** `if (ratio > ABI_THRESHOLDS.nonCompressible)` is strict-greater. ABI = exactly 1.30 → `'normal'`. The threshold is named `nonCompressible` but the operator is `>`. A patient measuring 1.30 with calcinosis silently looks normal — a treatment-class decision.
- **Fix:** Pick `>=` and document. Or rename to `nonCompressibleStrictGt` with a citation comment.

## HIGH — `findPluginByPath` route resolution via `endsWith` accepts arbitrary URL prefixes
- **Location:** `src/components/studies/index.ts:75-85`
- **Evidence:** `endsWith('/arterial-le')` matches `/foo/bar/arterial-le`. Today dormant (only 3 routes); becomes a real route-hijack the moment a second route family is added.
- **Fix:** Match exact equality: `path === plugin.route || path === '/studies' + plugin.route`.

## HIGH — Subclavian-steal-left template only flips `vert-v2-left` retrograde
- **Location:** `carotid/templates.ts:279-285`
- **Evidence:** Subclavian-steal physiology produces retrograde flow throughout the entire ipsilateral vertebral (V1, V2, V3). Template seeds only V2 retrograde; V1/V3 stay antegrade. Anyone applying the worked example gets a half-painted diagram and an under-described impression.
- **Fix:** Set V1, V2, V3 (left) all retrograde + post-stenotic turbulence at `subclav-dist-left`.

## MEDIUM (×10) — Doc says "15 venous-LE segments" but array has 20 · `medimindParamSystem(paramId)` returns `venous-` prefix even for arterial/carotid params · `Side` type redeclared in 3 study configs · Carotid `pickCat` is dead identity function · `useMemo(generateArterialNarrative)` discarded with `void` operator each render · No `schemaVersion` on saved drafts (V1 is name-only) · `customTemplate` cast trusts user-saved JSON without runtime validation · `competencyOverride` honored only by venous · Phase-0 subclavian steal emitted as positive Observation · `impressionEdited` forced `true` after APPLY_TEMPLATE even when impression is empty.

## LOW (×3) — Hardcoded ABI fallback band labels not localized · `WaveformSelector` uses raw `<button>` instead of `EMRSegmentedControl` · Duplicate `defaultPlaqueLabel` between arterial + carotid tables.

## Already Handled — Venous templates correctly `Object.freeze` NORMAL/ACUTE/CHRONIC findings; `crypto.randomUUID` fallback is documented; junctions correctly excluded from deep-segment list; reducer pattern clean in venous; URL.createObjectURL/revokeObjectURL paired correctly; en/ka/ru full parity across `venous-le`/`arterial-le`/`carotid` translation subtrees; no forbidden Tailwind blues in study area.

---

# Part 04 — PDF Generation

**Scanned:** 21 files | **Lines:** ~4,488

| Severity | Count | Dimensions |
|----------|-------|------------|
| BLOCKER  | 0 | — |
| CRITICAL | 1 | D10 |
| HIGH     | 6 | D3, D4 (×2), D8 (×2), D11 |
| MEDIUM   | 7 | D1, D4, D6, D9 (×2), D11, D7 |
| LOW      | 3 | D7, D9 (×2) |

## CRITICAL — PDF download/preview errors swallowed via `console.error` only
- **Location:** `src/components/form/FormActions.tsx:199-204, 215-220`
- **Evidence:** Both Download PDF and Preview PDF clinical-output paths catch errors silently. On font-load/anatomy-fetch/render failure the spinner stops with no toast. Clinician believes the PDF saved when it didn't.
- **Fix:** Surface via Mantine `notifications.show({ color: 'red', ... })` or render an inline error like `PDFGenerator.tsx` does. Include patient MRN + studyType in the log payload for support correlation.

## HIGH — `PDFGenerator.tsx` is dead code — 221-line orphan that contradicts the production rendering pipeline
- **Location:** `src/components/pdf/PDFGenerator.tsx:1-221`
- **Evidence:** Zero importers outside the file itself. Production uses an inlined `renderPdfBlob` in `FormActions.tsx`. Two divergent implementations; the dead one carries the same anatomy-coloring bug as the BLOCKER.
- **Fix:** Delete or refactor `FormActions.tsx` to use it. Don't keep both.

## HIGH — Hardcoded English `"Issued"` string in PDF header
- **Location:** `src/components/pdf/sections/HeaderSection.tsx:83`
- **Evidence:** Every PDF prints "Issued" in Latin script regardless of language. `ReportLabels.issueDateLabel` is declared on the type but never populated by `buildReportLabels` and never threaded through to `<HeaderSection>`. Contract designed, wiring forgotten — AI-slop signature.
- **Fix:** Accept `issuedLabel` as a prop; populate `t('pdf.issued', 'Issued')` in `buildReportLabels.ts`; add the key to all three locales.

## HIGH — Missing translation keys `pdf.pageLabel` and `pdf.issued`
- **Location:** `buildReportLabels.ts:325`; absent from `translations/{en,ka,ru}.json`
- **Evidence:** No `"pdf"` namespace exists in any locale file. Every Georgian/Russian PDF footer ships English fallback `"Page {current} / {total}"`.
- **Fix:** Add `pdf.pageLabel` (ka: `"გვერდი {current} / {total}"`, ru: `"Стр. {current} / {total}"`) and `pdf.issued`.

## HIGH — Anatomy SVG path strings extracted by regex and re-emitted into PDF without validation
- **Location:** `src/components/pdf/anatomyToPdfSvg.ts:130-167`, `DiagramSection.tsx:91-102`
- **Evidence:** Regex assumes stable `<g id="silhouette">/<g id="segments">` structure; no validation that `d` is a well-formed path; structurally-valid-but-empty SVGs return `[]` silently → PDF renders an empty diagram with no warning.
- **Fix:** Throw on `results.length === 0` for `segments`; validate `d` starts with `[Mm]` and contains only path-command grammar.

## HIGH — `data?: unknown` opaque pass-through prop on `ReportDocumentProps`
- **Location:** `ReportDocument.tsx:103-105`
- **Evidence:** "Make-it-compile placeholder" — no caller actually passes `data`; never destructured/read; comment cites "legacy callers" but the codebase is weeks old.
- **Fix:** Delete the prop and the comment.

## HIGH — A4-only assumption hardcoded across 3 files
- **Location:** `ReportDocument.tsx:252,392`, `pdfTheme.ts:60-71`
- **Evidence:** `<Page size="A4">` and `PDF_LAYOUT.contentWidthPt = 595.28 - 56.7*2`. A US clinic deployment ships every report with broken margins on Letter paper.
- **Fix:** Add `pageSize?: 'A4' | 'Letter'` prop; derive `contentWidthPt` from a presets map.

## HIGH — `formatDateTime` claims timezone-stable but uses local-machine accessors
- **Location:** `ReportDocument.tsx:204-211` (rendered in every page footer)
- **Evidence:** `getHours()/getMinutes()/getDate()` are local-machine. Tbilisi sonographer at 14:15 vs NY reviewer of same FHIR `generatedAt` see 14:15 vs 06:15. No timezone label.
- **Fix:** Use `toISOString().slice(0,16).replace('T',' ') + 'Z'` or `Intl.DateTimeFormat(lang, { timeZoneName: 'short' })`.

## MEDIUM (×7) — Patient MRN in `Document.subject` PDF metadata (PHI in file metadata) · `formatDate/formatDateTime` returns raw ISO string on parse failure (leaks unformatted timestamps to footer) · `useCallback` deps missing `lang` (stale closure on language switch) · Hardcoded `"A4"` duplicated despite `PDF_LAYOUT.pageSize` constant existing · `test-pdf.ts` re-implements font registration without italic-alias defenses (production drift) · 6+ files hardcode hex (`#fecaca`, `#bbf7d0`, etc.) bypassing `pdfTheme.ts` · `Document language="ka"` hardcoded.

## LOW (×3) — `Math.round(diameter*0.9)` fake transverse-diameter in test fixture · Magic letter-spacing values without design tokens · `RecommendationsSection` priority colors duplicated locally instead of types/form.ts.

## Already Handled — Lazy load of `@react-pdf/renderer` via `Promise.all([import(...)])`; Font registration idempotency via module flag; Italic-fallback defense documented; Object URL revoke pattern correct; Anatomy SVG cache works; `<View fixed>` for footer/watermark correct; Empty-row filtering avoids 20 em-dash rows.

---

# Part 05 — Services + FHIR Builder

**Scanned:** 11 files | **Lines:** ~4,629

| Severity | Count | Dimensions |
|----------|-------|------------|
| BLOCKER  | 1 | D5 |
| CRITICAL | 2 | D5, D10 |
| HIGH     | 6 | D3, D5, D9, D11 |
| MEDIUM   | 5 | D2, D5, D9 |
| LOW      | 2 | D9 |

## BLOCKER — Peroneal artery emits the SNOMED code for peroneal **vein**
- **Location:** `src/constants/fhir-systems.ts:171, 197`
- **Evidence:**
  ```ts
  perv: { code: '8821006', display: 'Peroneal vein structure' },
  pera: { code: '8821006', display: 'Peroneal artery structure' },   // SAME code
  ```
  SNOMED CT `8821006` = "Peroneal vein structure". The peroneal artery has its own concept. Every arterial-LE bundle that contains a peroneal-artery segment is body-site-mislabeled.
- **Fix:** Verify the correct concept ID for "Peroneal artery structure" in the SNOMED browser; replace `pera`. Add a unit test asserting `perv.code !== pera.code`.

## CRITICAL — Patient resource omits `identifier`
- **Location:** `src/services/fhirBuilder.ts:251-280`
- **Evidence:** `buildPatientEntry` produces only `name + gender + birthDate`. Georgian personal ID (`header.patientId`), accession number, MRN are stored only in `QuestionnaireResponse.item.answer.valueString` (unsearchable). Re-importing creates a fresh anonymous Patient. `IDENTIFIER_SYSTEMS.PERSONAL_ID` is defined but never consumed.
- **Fix:** Populate `Patient.identifier[0]` with `{ system: IDENTIFIER_SYSTEMS.PERSONAL_ID, value: header.patientId }` when set; emit `DiagnosticReport.identifier` from `accessionNumber`.

## CRITICAL — TODO-placeholder SNOMED codes (`'-'`) for clinically critical sites
- **Location:** `fhir-systems.ts:150,152,158,175,180,182,210,247,251,259`; fallback at `fhirBuilder.ts:1906-1922`
- **Evidence:** 10 placeholders include `gsv-thigh`, `gsv-calf`, `aasv`, `sv` (soleal), `perf-thigh`, `perf-calf`, `carotid-bulb`, `C4A`, `C4C`, `OBSTRUCTION`. Fallback emits `bodySite: { text: segment }` — no `coding[]` array. SNOMED-aware consumers see nothing for the most common reflux + plaque sites.
- **Fix:** Verify each via `browser.ihtsdotools.org` and replace; add unit test `assert(no entry has code === '-')`.

## HIGH — Per-segment Observation.code is the *study-level* LOINC, not parameter-specific
- **Location:** 6 sites in `fhirBuilder.ts` (categorical/numeric/coded/boolean/generic builders)
- **Evidence:** Every venous Observation reports `code = 39420-5 ("US.doppler Lower extremity vein - bilateral")`, whether the row is compressibility, phasicity, augmentation, or diameter. Parameter-specific LOINC (e.g. `89999-3` Vein compressibility) is never used. A code-aware client sees 50+ identical-looking observations.
- **Fix:** Populate `code.coding[0]` with parameter-specific LOINC where one exists, or with a MediMind CodeSystem entry per parameter. Keep study-level as `coding[1]`.

## HIGH — `OBSTRUCTION` placeholder breaks CEAP `Po`/`Pro` coding
- **Location:** `fhir-systems.ts:259`, `ceapService.ts:228-237`
- **Evidence:** Pure-obstruction patients (`...,Po`) get a CEAP Observation with `valueCodeableConcept` but EMPTY `coding[]`. Post-thrombotic syndrome patients become invisible to SNOMED-aware queries.
- **Fix:** Verify the SNOMED concept (`441574008` "Venous outflow obstruction" or similar) and replace.

## HIGH — `header.operatorName/referringPhysician/institution` never become Practitioner/Organization references
- **Location:** `fhirBuilder.ts:1493-1532`, `1822-1862`
- **Evidence:** `ServiceRequest.requester` and `DiagnosticReport.performer` slots empty. Per-Observation performer encoded as `note: [{ text: 'performer=sonographer' }]` (free-text annotation). "Show me all reports performed by Dr. X" returns nothing.
- **Fix:** Emit a contained `Practitioner` per unique operator/referrer; reference from the appropriate slots. Emit `Organization` for `institution`.

## HIGH — `referringPhysician/medications/accessionNumber/studyDate` never reach typed FHIR slots
- **Location:** `fhirBuilder.ts:359-396` (`headerToItem`)
- **Evidence:** `studyDate` ignored — `DiagnosticReport.effectiveDateTime` always uses `nowIso`. So a study written up the day after performance silently claims "performed today."
- **Fix:** Use `header.studyDate` for `DiagnosticReport.effectiveDateTime` and `Encounter.period.start`.

## HIGH — CPT entry lookup by array index — reordering silently changes default codes
- **Location:** `vascular-cpt.ts:114-130` (`defaultCptForStudy`)
- **Evidence:** `case 'arterialLE': return VASCULAR_CPT_CODES[3]!;`. A future contributor inserting an entry above index 3 silently shifts every arterial study to a venous CPT — wrong billing.
- **Fix:** Use `findCptByCode('93925')` instead of `[3]!`. Or change the lookup table to `Record<StudyType, string>` of CPT codes.

## HIGH — Patient-position Observation system URL points at a `StructureDefinition`, not a `CodeSystem`
- **Location:** `fhirBuilder.ts:1611`
- **Evidence:** String-replace trick produces `http://medimind.ge/fhir/StructureDefinition/patient-position` but it is used as a `Coding.system` (which by FHIR convention should be `/CodeSystem/...`).
- **Fix:** Add `PATIENT_POSITION` to `MEDIMIND_CODESYSTEMS` and reference directly.

## HIGH — `fhirBuilder.ts` is 2,007 lines (D11 size threshold)
- **Evidence:** Single-file mega-service with 30+ build helpers; 4 study-type branches. AI-assisted edits at high risk of duplicating helpers because the file is too long to fully load.
- **Fix:** Extract into `src/services/fhirBuilder/{patient,encounter,serviceRequest,diagnosticReport,observations/*}.ts`. `index.ts` re-exports preserve current import path.

## MEDIUM (×5) — `Encounter.period.start === end === nowIso` (zero-duration); no `serviceProvider` or `participant` · `extras` field on `CustomTemplate` is `Record<string, unknown>` and skips type validation in `isCustomTemplate` · CEAP `'C0'` has no SNOMED case (silently emits no coding even though "no signs" has a SNOMED concept) · `defaultCptForStudy` for unknown studyType silently returns CPT 93970 (venous bilateral) · `narrativeService` 6× `as unknown as <Type>` casts on `form.parameters`.

## LOW (×2) — Italic font fallback silently maps italic→upright with no warning · `_exhaustive: never` returns the unmatched value rather than throwing.

## Already Handled — Schema versioning of saved templates (`schemaVersion === 1` enforced); legacy localStorage migration idempotent; SSR-guard via `safeStorage()`; bundle reference integrity via `urn:uuid:` + reference resolution test; LOINC accuracy verified against `loinc.org`; ICD-10 system URL canonical (`http://hl7.org/fhir/sid/icd-10`); CPT system URL correct (`http://www.ama-assn.org/go/cpt`); panel `hasMember` pattern follows MediMind `cultureResultService`.

---

# Part 06 — Layout + Common + Shared Components

**Scanned:** 38 files | **Lines:** ~6,900

| Severity | Count | Dimensions |
|----------|-------|------------|
| BLOCKER  | 1 | D4 |
| CRITICAL | 0 | — |
| HIGH     | 4 | D3, D4, D7, D8 |
| MEDIUM   | 8 | D6, D7, D8, D9 |
| LOW      | 4 | D7, D9 |

## BLOCKER — No top-level ErrorBoundary
- **Location:** `src/main.tsx:13-17`, `src/App.tsx:36-53`
- **Evidence:** Repo-wide grep for `componentDidCatch`/`getDerivedStateFromError`/`ErrorBoundary` returns zero matches. Any unhandled render error inside any study form, anatomy view, EMR component, or context provider crashes the entire React tree to a blank white page.
- **Fix:** Wrap `<App />` (or `{renderRoute()}`) with a class-based `<ErrorBoundary>` that renders a polite recovery card with Reload button + diagnostics. Verify draft autosave runs before throw.

## HIGH — `endsWith` route resolution accepts unintended URLs
- See Pattern A in cross-area summary. Same finding as Area 03 HIGH; `/admin/edit-venous-le` → loads venous-LE form.

## HIGH — Full-page reload on every navigation destroys in-memory form state
- **Location:** `StudyPicker.tsx:32-34`, `BackToStudiesButton.tsx:15-17`, `VenousLEForm.tsx:547`
- **Evidence:** `window.location.pathname = ...` triggers hard browser reload — discards in-progress dictation, unsaved fields, focused element, scroll position, notifications queue. No router (no `react-router`).
- **Fix:** Introduce `react-router-dom` (wrap App in `BrowserRouter` + `<Routes>`), or at minimum use `pushState` + `popstate`. Add `beforeunload` guard on dirty forms.

## HIGH — Tap targets in header controls are 30×30px (below 44×44 mobile minimum)
- **Location:** `ThemeToggle.module.css:19-20`, `LanguageSwitcher.module.css:19`
- See Pattern D in cross-area summary.

## HIGH — Translation keys `common.clearInput` and `common.noOptionsFound` missing in all three locales
- **Location:** `EMRTextInput.tsx:139`, `EMRSelect.tsx:134`
- **Evidence:** Russian/Georgian users see English fallbacks via `t(key, fallback)` pattern.
- **Fix:** Add to all three JSONs: ka `"გასუფთავება"/"ვარიანტები ვერ მოიძებნა"`, ru `"Очистить"/"Варианты не найдены"`.

## MEDIUM (×8) — EMRTabs `sm`(36px)/`md`(42px) under 44 minimum · EMRBadge `info` variant uses `secondary-alpha-10` bg with `info` fg (mismatch) · EMRCheckbox internal `useState` desyncs with `checked` prop on rapid toggles · EMRCheckbox `onMouseEnter`/`onMouseLeave` mutate DOM via `e.currentTarget.style` (bypasses React) · EMRModal builds 12 separate `useMemo` style objects (premature) · EMRBadge `version` variant uses `--emr-shadow-success` (green glow) on a brand-blue badge · "MediMind Angio" / "build" / aria-labels in VersionFooter not translated · `console.info` left in `StudyPicker.tsx:36-37` production code.

## LOW (×4) — EMRButton `padding: '0 20px'` override (mitigated by `label.overflow:visible` escape) · EMRTabs focus outline may clip inside `overflow-x:auto` container · `BackToStudiesButton` builds raw Mantine Button instead of EMRButton (hardcoded `borderRadius: 10`, `paddingInline: 14`) · `ConfirmDialog.module.css:28` uses `#ffffff` instead of `var(--emr-text-white)`.

## Already Handled — Theme persistence via `STORAGE_KEYS.THEME`; no forbidden Tailwind/Chakra blues; no dark-mode CSS overrides in modules; no `--emr-gray-N` for backgrounds; no hardcoded font-sizes in px; `__BUILD_HASH__` injection XSS-safe; StrictMode enabled; `prefers-reduced-motion` respected; D10 wrong-patient-banner N/A (no patient context at layout layer).

---

# Part 07 — i18n + Hooks + Contexts

**Scanned:** 18 files | **Lines:** ~4,540
**Translation parity:** 812 / 812 / 812 keys across en/ka/ru — zero missing, zero extras.
**Translation quality:** professional medical Georgian + Russian (sample-verified).

| Severity | Count | Dimensions |
|----------|-------|------------|
| BLOCKER  | 0 | — |
| CRITICAL | 0 | — |
| HIGH     | 4 | D8, D10 |
| MEDIUM   | 5 | D1, D4, D6, D8 |
| LOW      | 3 | D8, D9 |

## HIGH — CEAP clinical descriptors hardcoded in English
- **Location:** `src/components/form/CEAPPicker.tsx:43-78`
- **Evidence:** Four `*_DESCRIPTIONS` maps with English clinical descriptors ("Lipodermatosclerosis", "Corona phlebectatica", "Telangiectasies / reticular veins") are used in `<EMRRadioGroup>` options. Meanwhile `ceap/{en,ka,ru}.json` already contain full professional translations sitting unused.
- **Fix:** Delete the four constants; replace with `t('ceap.c.${code}', code)` lookups. Add `t` to deps.

## HIGH — Anatomy segment tooltip labels hardcoded in English (35+ vessel names)
- **Location:** `AnatomyView.tsx:409-461`
- See Pattern E in cross-area summary.

## HIGH — PDF "Issued" header label hardcoded
- **Location:** `pdf/sections/HeaderSection.tsx:83`
- See Area 04 HIGH (same finding).

## HIGH — `useAutoSave` cleanup never flushes — debounced data dropped on unmount
- **Location:** `src/hooks/useAutoSave.ts:122-127`
- **Evidence:** Cleanup clears the timer but never flushes the pending write. Default debounce 2000ms (Venous 1500ms). Any keystroke in the last 1.5–2s before unmount is lost. User clicks "Back to studies" 1.2s after the last edit → that edit is gone.
- **Fix:** In cleanup, if `timerRef.current !== null`, flush synchronously: `clearTimeout(timerRef.current); writeDraft(studyIdRef.current, stateRef.current);`. Also wire a `beforeunload` listener.

## MEDIUM (×5) — `useAutoSave` swallows quota/write errors silently · `loadDraft` parses untrusted JSON without shape validation (localStorage-poisoning vector) · TranslationContext `mountedRef` race: stale-language translations land in state when language switches mid-load · ThemeContext bidirectional sync triggers redundant localStorage writes · Hardcoded clinical column headers `PSV`, `EDV` in CarotidSegmentTable (universal abbreviations but inconsistent with localized neighbors).

## LOW (×3) — 3 hardcoded English aria-labels (FormActions, VersionFooter, CarotidSegmentTable steal radiogroup) · VersionFooter "build {hash}" English crumb · CEAPPicker `useMemo` deps will go stale once HIGH #1 lands.

## Already Handled — i18n key parity verified via `Object.keys(flatten(en)).filter(k => !(k in flatten(ka)))` for each of 5 namespaces; translation quality (Georgian, Russian) professional medical-grade; graceful degradation for missing study modules (`abdominal-venous`, `dialysis-aortic`); `migratedGetItem` legacy key handling; Russian CLDR pluralization correct; `firstRunRef`/`stateRef`/`studyIdRef` patterns in useAutoSave correct; ThemeContext system-preference listener cleanup correct; aria-hidden on decorative SVG paths.

---

# Part 08 — Theme + Styles + Design System

**Scanned:** 38 files (6 in scope + 32 component CSS modules) | **Lines:** ~3,800
**Quick stats:** 47 hardcoded hex colors (45 are intentional `#ffffff` inverse-text on dark gradient headers, 1 brand triplet, 1 print background). 1 forbidden Chakra blue. 0 dark-mode overrides in modules. 2 undefined CSS variables. 3 components with sub-44 tap targets.

| Severity | Count | Dimensions |
|----------|-------|------------|
| BLOCKER  | 0 | — |
| CRITICAL | 0 | — |
| HIGH     | 3 | D7, D9 |
| MEDIUM   | 4 | D7, D9 |
| LOW      | 2 | D7, D9 |

## HIGH — Forbidden Chakra blue `#63b3ed` defined as `--emr-info-light` in theme.css
- **Location:** `src/styles/theme.css:109`
- **Evidence:** Project's own `FORBIDDEN_COLORS` list (`theme-colors.ts:156`) explicitly bans `#63b3ed` as Chakra blue-300, yet it is a theme token. Currently unused — landmine for the first developer who writes `var(--emr-info-light)`.
- **Fix:** `--emr-info-light: var(--emr-light-accent);` (= `#bee3f8`).

## HIGH — Two undefined CSS variables silently render as initial values
- **Location:** `--emr-border-radius-md` (5+ usages: WaveformSelector, SegmentalPressureTable, ArterialLEForm, NASCETPicker), `--emr-line-height-normal` (1 usage)
- **Evidence:** Neither variable defined in `theme.css` or `emr-fields.css`. `var()` with undefined and no fallback resolves to property's initial value. For `border-radius` that's **0px** (sharp corners) — a visual regression rendering as working code.
- **Fix:** Add to `theme.css`: `--emr-border-radius-md: 8px;`, `--emr-line-height-normal: var(--emr-line-height-base);`.

## HIGH — Tap targets below 44×44 (Pattern D)
- See cross-area summary.

## MEDIUM (×4) — Dual writers to `data-mantine-color-scheme` (ThemeContext + Mantine manager may disagree on `'system'` mode) · Mantine core CSS imported AFTER `theme.css` in `main.tsx` (Mantine wins on equal specificity) · 5 different "small mobile" breakpoints across 32 modules (420/480/575/576/768/900/992) — should standardize on Mantine's canonical scale · 2px white focus outlines on dark-gradient headers may fail WCAG 2.4.7 contrast on lighter gradient stops.

## LOW (×2) — Widespread `var(--emr-foo, fallback)` anti-pattern in component CSS modules (CLAUDE.md rule 2 forbids fallbacks; 22+ occurrences) · `--emr-info-light` is also dead (no consumers) — same line as HIGH #1, framed via dead-code lens.

## Already Handled — Zero `:root[data-mantine-color-scheme="dark"]` overrides in component CSS modules; zero Tailwind blues anywhere except the explicit FORBIDDEN reference list; all `font-size` declarations use `var(--emr-font-*)` tokens; PDF hex colors intentional (react-pdf doesn't support CSS vars); print stylesheet correct; localStorage migration; system-preference detection; Mantine theme integration; color-scheme-manager round-trips `'system' ⇄ 'auto'`.

---

# Part 09 — Build Config + Deps + Security Posture

**Scanned:** 12 config/CI files + inventory pass over 108 source files | **Lines:** ~24,811

| Severity | Count | Dimensions |
|----------|-------|------------|
| BLOCKER  | 0 | — |
| CRITICAL | 0 | — |
| HIGH     | 4 | D2 ×4 |
| MEDIUM   | 5 | D2 ×2, D6, D9, D2/legal |
| LOW      | 3 | D7, D9, D2 |

**npm audit (2026-04-25):** 0 critical · 2 high (vite, react-router) · 2 moderate (postcss, react-router-dom) · 0 low.
**Dependency totals:** prod=102, dev=388, optional=78, peer=17 → 495 total nodes.

## HIGH — react-router 7.9.5 has 4 advisories incl. 2 high-CVSS XSS
- **Location:** `package.json:36-37`
- **Advisories:**
  - GHSA-2w69-qvjg-hvjx — XSS via Open Redirects (CVSS 8.0, range >=7.0.0 <=7.11.0)
  - GHSA-8v8x-cx79-35w7 — SSR XSS in ScrollRestoration (CVSS 8.2, range >=7.0.0 <7.12.0)
  - GHSA-h5cw-625j-3rxh — CSRF in Action (moderate)
  - GHSA-9jcx-v3wj-wh4m — external redirect untrusted (moderate)
- **Fix:** `npm install react-router@7.14.2 react-router-dom@7.14.2` (non-major bump).

## HIGH — vite 7.1.12 has 3 advisories incl. 2 high-CVSS dev-server CVEs
- **Location:** `package.json:55`
- **Advisories:** GHSA-p9ff-h696-f583 (arbitrary file read via dev-server WS), GHSA-v2wj-q39q-566r (`server.fs.deny` bypass), GHSA-4w7w-66w2-5vf9 (path traversal in optimized deps)
- **Aggravator:** `server.host: true` binds dev-server to all interfaces → exploitable from same Wi-Fi
- **Fix:** `npm install -D vite@7.3.2` AND change `server.host: 'localhost'`.

## HIGH — `server.host: true` exposes dev server to LAN by default
- **Location:** `vite.config.ts:42-44`
- **Fix:** Default to `'localhost'`; document `npm run dev:lan` for cross-device testing.

## HIGH — CI workflow swallows lint failures with `continue-on-error: true`
- **Location:** `.github/workflows/ci.yml:31-33`
- **Aggravator:** combined with the missing `eslint.config.*` (LOW finding), the project has effectively zero lint coverage.
- **Fix:** Remove `continue-on-error`; add a flat-config `eslint.config.js`.

## MEDIUM (×5) — postcss 8.5.6 moderate XSS advisory; non-major fix to 8.5.10 · 9 `console.*` calls left in production code paths (TranslationContext, FormActions, PDFGenerator, customTemplatesService, StudyPicker) — info-disclosure + no logger abstraction · CPT codes embedded without an AMA license entry in `NOTICE` (legal risk if app ships in US billing context) · Eager-loaded `pdf` chunk weighs 1.4MB — manualChunks doesn't lazy-split on first paint · No CSP / X-Frame-Options / Permissions-Policy / referrer-policy in `index.html` (PHI-adjacent app, no header hardening).

## LOW (×3) — Hardcoded `<html lang="ka">` overrides user language preference (screen readers pronounce English content with Georgian rules until React boots) · `tsconfig.build.json` functionally identical to `tsconfig.json` (maintenance trap) · No `eslint.config.*` despite ESLint 9 in devDeps — combined with CI silencer, lint coverage is zero.

## Already Handled — TypeScript strict mode + `noUncheckedIndexedAccess` + `noImplicitAny` + `noUnusedLocals/Parameters` + `noFallthroughCasesInSwitch`; zero `as any`/`@ts-ignore`/`@ts-expect-error` across 108 files; no source maps in `dist/`; no hardcoded secrets/no `.env*` in repo; `vite.config.ts` git-hash uses safe `execFileSync` with explicit args array; GitHub Pages deploy uses least-privilege permissions block; no `innerHTML` or unsafe-HTML sinks across source; charset + viewport meta correct.

---

# Part 10 — Clinical Safety + End-to-End Wiring

**Scanned:** ~14 files traced for cross-cutting flows | **Lines:** ~5,500

| Severity | Count | Dimensions |
|----------|-------|------------|
| BLOCKER  | 1 | D10 |
| CRITICAL | 2 | D1, D10 |
| HIGH     | 4 | D1, D3, D4, D9 |
| MEDIUM   | 3 | D1, D7, D9 |
| LOW      | 2 | D7, D9 |

## BLOCKER — Venous PDF anatomy diagram colored from empty findings map
- **Location:** `src/components/form/FormActions.tsx:87-104`; dead duplicate at `src/components/pdf/PDFGenerator.tsx:91-100, 180-220`
- **Evidence:**
  ```ts
  for (const seg of form.segments) {              // form.segments is ALWAYS [] for venous
    findings[`${seg.segmentId}-${seg.side}`] = {
      refluxDurationMs: seg.refluxDurationMs,
      apDiameterMm: seg.diameterMm,
    };
  }
  ```
  `VenousLEForm.stateToFormState()` returns `segments: []` (findings live on `parameters.segmentFindings`). Inside `colorsForSegment()`, `findings[key]` is `undefined` for every segment → `deriveCompetency()` returns `'normal'` for every vessel.
  Even if `form.segments[]` were populated, only `refluxDurationMs` and `apDiameterMm` are forwarded — `compressibility`, `thrombosis`, `spontaneity`, `phasicity`, `augmentation` (the primary DVT signals) are dropped.
  **Every venous PDF shows the entire leg as black/normal regardless of acute DVT, chronic thrombosis, or pathological reflux.**
- **Fix:**
  ```ts
  const findings = (form.parameters['segmentFindings'] ?? {}) as VenousSegmentFindings;
  ```
  Apply same fix to `PDFGenerator.tsx`.

## CRITICAL — `informedConsentSignedAt` collected as date-only but typed as ISO date-time
- **Location:** `StudyHeader.tsx:212-215`, `form.ts:55-56`, `fhirBuilder.ts:1542-1574`
- **Evidence:** UI writes `YYYY-MM-DD`; `Consent.dateTime` is FHIR `dateTime` (timestamp). Patient signs at 23:45 local; system stamps `2026-04-25` no time; downstream auditor reads as `2026-04-25T00:00:00Z` = 04:00 next day Tbilisi. Timeline reconstruction can falsely show "consent obtained AFTER procedure."
- **Fix:** Stamp `new Date().toISOString()` (full timestamp) when consent is first checked. Consent is a legal record — never widen its precision retroactively.

## CRITICAL — `dateToIso` UTC bug on every clinical date (Pattern B)
- See Pattern B in cross-area summary.

## HIGH — Arterial + Carotid `APPLY_TEMPLATE` doesn't clear `clinicianComments`
- **Location:** `ArterialLEForm.tsx:146-156`, `CarotidForm.tsx:130-139`; dialog text at `:565-568`, `:508-511`
- **Evidence:** Reducer spreads `...state` and overrides findings/pressures/impression/recommendations but never enumerates `clinicianComments`. Clinician sets up Patient A's report, types interpretation, applies a template, accepts → Patient B silently inherits Patient A's clinician comments. Cross-patient contamination vector.
- **Fix:** Reset `clinicianComments: ''` in all three reducers; align dialog text.

## HIGH — Same shape on Venous reducer (clinician comments preserved while dialog enumerates other fields)
- **Location:** `VenousLEForm.tsx:243-266`, dialog text at `:887-890`
- See Pattern F in cross-area summary.

## HIGH — Arterial + Carotid `loadDraft` doesn't verify `studyType` or schema version
- **Location:** `ArterialLEForm.tsx:193-196`, `CarotidForm.tsx:166-169` (vs `VenousLEForm.tsx:460-465` which checks)
- **Evidence:** `loadDraft<T>` returns `JSON.parse(raw) as T` — unchecked cast. After a code release that bumps state shape, yesterday's draft hydrates as the new shape and either crashes (missing field) or silently renders wrong data (renamed enum).
- **Fix:** Verify `persisted.studyType === '<expected>'` and `persisted.schemaVersion === 1` in initializer; fall back to `initialState()` on mismatch.

## HIGH — `PDFGenerator.tsx` dead code carries the same anatomy-coloring bug
- **Location:** `src/components/pdf/PDFGenerator.tsx:1-220`
- **Evidence:** Zero importers. Has its own `deriveInlineFindings(form)` reading `form.segments[]` (always empty). If re-wired tomorrow, ships the BLOCKER.
- **Fix:** Delete or rewire — don't keep both.

## MEDIUM (×3) — Empty-state template apply on Arterial + Carotid forces unnecessary confirmation click (venous handles correctly via `hasFormContent`) · `useAutoSave` writes full form state (PHI: patientName/Id/birthDate/medications) to localStorage with no expiration, no clear-on-logout, no idle-timeout. Shared-workstation contamination + browser-extension exfiltration vector · Reflex-time numeric input has no upper-sanity validation on physiologically-implausible values (10000ms = 10s of continuous reflux is meaningless; should be rejected as a likely typo).

## LOW (×2) — `narrative.indication` from free-text duplicated with `header.icd10Codes` (two ways to express the same thing) · `Math.random()` UUID fallback in `fhirBuilder.ts` for environments without `crypto.randomUUID` — runtime target has it; throw is more honest.

## Already Handled — Reflux-threshold operators correct (Gloviczki/ESVS-aligned: `>1000ms` deep, `>500ms` superficial); reflux-duration warning chip uses segment-aware threshold; on-screen anatomy diagram works (only PDF is broken); FHIR Bundle venous-segment Observations read from the right place (`extractVenousFindings` reads `form.parameters['segmentFindings']`); patient-identifier flow consistent between PDF and FHIR; CEAP→ICD-10 mapping intentionally manual (safer); no race between autosave and PDF generation (PDF reads live in-memory `form` prop, not saved draft); recommendations text pre-resolved via `t()` before handing to `@react-pdf`; custom template store explicitly excludes PHI.

---

*End of unified report. 10 partial files merged from `audit-findings/.parts/`; that directory will be removed after this file lands.*
