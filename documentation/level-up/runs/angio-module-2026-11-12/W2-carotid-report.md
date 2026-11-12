# W2-carotid report: carotid study page (UX-ANGIO-002 L3b, 005 L2–L3, 025 L3, 026 L3, 018 carry-over)

Run `angio-module-2026-11-12` · worker W2-carotid · 2026-11-12 · status **DONE in fence. The NASCET header band, its preview chip and the green "auto (SRU)" text live in `NASCETPicker` and are handed to the orchestrator (see "For the orchestrator").**

## In plain language

- **The diagram sits beside the table.** At 1280 px and wider, the anatomy diagram sits in a right-hand column that stays on screen while you scroll the table. The NASCET grade is directly under the diagram. At 1440×900, the abnormal row (ICA Prox R, 250 / 110 / 60 %) and its red ICA segment are on screen together. Below 1280 px the column stacks under the table: table, then diagram, then NASCET.
- **Phones and tablets keep a real table.** Below 992 px the table no longer turns into 24 tall cards. It stays one compact row per segment (53 px when empty) inside a scroll box. The column labels stay pinned at the top and the vessel name stays pinned at the left while you scroll. At 768 the page is **2,995 px** tall (about 16,000 before). At 375 it is **3,459 px**.
- **"Clear form" says what it does.** The old "+ new case" button is now a quiet secondary button with an eraser icon, labelled "ფორმის გასუფთავება". It turns red only on hover or focus. Its confirm names the patient and the study in bold ("W2C ტესტი პაციენტი · საძილე არტერიები") and the confirm button is red.
- **The save line is the shared one.** The form no longer keeps its own save clock or passes a fake "no unsaved changes". The bar reads the stored save time from the visit. After a reload it showed "ბოლოს შენახული: 18:39:17" and the dot was neutral grey.
- **Headings and screen-reader names.** The table title is now a real `h2`. The flow and plaque controls are announced with the Georgian column labels (for example "ICA Prox R ნაკადი") instead of English "flow" and "plaque".

## Touched files (fence only)

| File | Change |
|---|---|
| `src/components/studies/carotid/CarotidForm.tsx` | 002 L3b: removed the local `lastSavedAt` state and `setLastSavedAt`, and stopped passing `lastSavedAt` / `hasUnsavedChanges={false}` to `FormActions`. The manual "save draft" still re-flushes `setStudyState`. 025 L3: new `assessmentLayout` grid with `assessmentMain` (the segment table) and `assessmentAside` (`data-testid="carotid-assessment-aside"`), which holds the anatomy `EMRContentSection` and then `NASCETPicker`. 005 L2: the raw `<button>` + `IconPlus` became `EMRButton variant="secondary"` with `IconEraser` and `data-testid="new-case-button"`. 005 L3: the confirm message has a bold first line (`data-testid="new-case-confirm-patient"`) with the patient name · `studies.carotid.short`, then the existing body. The confirm keeps `destructive`. Header comment updated. All clinician-feedback logic (BIF, SRU auto-NASCET, plaque %) is untouched. |
| `src/components/studies/carotid/CarotidForm.module.css` | `.newCaseButton` was replaced by `.clearFormButton`, copied from the venous sibling: a secondary deck at rest, with `--emr-error` border and text only on hover/focus, hidden in print. Added `.assessmentLayout` / `.assessmentMain` / `.assessmentAside`. At ≥1280 px the grid is `minmax(0,1fr) clamp(340px, 27vw, 440px)`, and the aside is sticky with its own scroll (same mechanics as venous). `.textSection` is now a Command deck: no outer border, `--emr-shadow-card`. `.templateSelect` is unused and pre-existing, so it was left alone. |
| `src/components/studies/carotid/CarotidSegmentTable.module.css` | Fluid desktop columns, `min-width` 940 → 780, so the table fits beside the aside down to 1280. The header row follows the Command table rule (`--emr-table-header-bg` / `-border` / `-text`, 10 px uppercase bold). Header labels wrap instead of truncating ("ინტიმა-მე…", "ICA/C…"). Added the missing `.plaqueStack` class, which the TSX already referenced. Below 992 px, 026 L3: the stacked-card collapse and the `data-label::before` labels are gone. Instead a bounded scroll box (`max-height: min(70vh, 640px)`) holds a sticky header row (z 4), a sticky vessel cell (z 3, `--emr-bg-card`, hover-matched) and fixed compact columns (112 / 72×3 / 128 / 140 / 60 / 120). Rows are hairline-separated. Tokens only. |
| `src/components/studies/carotid/CarotidSegmentTable.tsx` | Title `Text component="h2"`. The flow and plaque `aria-label` suffixes now use `carotid.param.flowDirection` / `carotid.param.plaqueMorphology`, the same keys as the column headers. Nothing else changed; the clinician-feedback diff already in this file is kept. |
| `src/components/studies/carotid/CarotidForm.test.tsx` | 3 new tests: the aside holds the diagram and then NASCET, and not the table. The table title is an h2, and the flow and plaque aria-labels end with the rendered column-header text. "Clear form" has no "+", and its confirm names the patient. |

Not touched: `NASCETPicker.tsx`, `NASCETPicker.module.css`, `stenosisCalculator.ts`, every shared component, and every other study's files.

## Tests and results

- `npm run typecheck`: **clean**.
- `npm run lint`: **0 errors**, 14 warnings, all pre-existing. The only one in my files is `CarotidForm.tsx:505` `react-hooks/exhaustive-deps` on `handleTemplateConfirm`; the identical warning sits at `ArterialLEForm.tsx:525`. I didn't touch it.
- `npx vitest run src/components/studies/carotid`, first run: **46/48 pass, 4 files**. `config.test.ts`, `stenosisCalculator.test.ts` and `NASCETPicker.test.tsx` were all green. The 2 failures were my own new tests: they asserted Georgian strings, but the test environment renders English. I made the assertions locale-agnostic: they now compare with the rendered column-header text and accept either language for the button label.
- `npx vitest run src/components/studies/carotid/CarotidForm.test.tsx`, re-run alone after the fix: see "Final test status" at the end.
- Self-audit on the 4 source files: the only `@mantine/core` imports are `Stack`, `Group`, `Text` and `Box`. No `@mantine/dates`, no hex, `rgb(` or `rgba(`, no forbidden blues, no purple/orange/amber/yellow, no `backdrop-filter`, no dark-mode overrides. `npm run ui:orphans` does not list `CarotidForm` or `CarotidSegmentTable`.

## Live evidence (http://localhost:3001, ka, context `w2c`, now closed)

Each check used a fresh visit created through intake ("W2C ტესტი პაციენტი", carotid), then ICA Prox R PSV 250, EDV 110 and plaque 60 %.

| Check | Result |
|---|---|
| NASCET auto-fill | `nascet-right-ge70` `aria-pressed=true`, and `nascet-right-auto` shows "ავტომატური (SRU)". The diagram ICA-prox-right fill is `#dc2626`. |
| 1440×900 row and diagram together | Row top 420 px, red segment 424–465 px, aside sticky at top 16 px. Aside x 1023, w 397. Table deck w 987, with internal `scrollWidth == clientWidth` (959), so there is no sideways scroll. Page `scrollWidth` 1440. |
| Headings | h2 ×4 on the page: სისხლძარღვების შეფასება, საძილე არტერიების ანატომია, NASCET…, რეკომენდაციები. |
| Dark 1440 | Scheme `dark`. Header row bg `rgb(26,45,71)`, text `rgb(226,232,240)`. The clear-form button rests at the card surface `rgb(30,41,59)` / `rgb(241,245,249)`. |
| Clear-form confirm | Bold line "W2C ტესტი პაციენტი · საძილე არტერიები", title "გავასუფთაოთ ეს ფორმა?", red "ფორმის გასუფთავება" confirm. |
| Draft survives reload | After `location.reload()`: PSV 250, EDV 110, plaque 60, `nascet-right-ge70` still selected. Save line "ბოლოს შენახული: 18:39:17", `data-save-state="saved"`, dot `rgb(148,163,184)` (neutral). |
| 768 light | `scrollWidth 768 / clientWidth 768`. Page 2,995 px. Table box 640 tall (1,721 content), 700 wide (810 content). Empty rows 53 px. Sticky header and vessel column confirmed with the box scrolled (400 down, sideways). |
| 375 light | `scrollWidth 375 / clientWidth 375 / body 375`. Page 3,459 px. Clear-form button 44 px tall. The only elements past x 375 are header cells inside the table scroll box, which are clipped. |
| 375 dark | `scrollWidth 375`. The pinned vessel cell bg equals the card bg (`rgb(30,41,59)`). |

Screenshots (`/Users/toko/Desktop/medimind-angio/screenshots/`): `w2c-1440-light-empty.png`, `w2c-1440-light-ica-row-and-diagram.png`, `w2c-1440-light-aside-nascet.png`, `w2c-1440-dark-ica-row-and-diagram.png`, `w2c-1440-dark-clear-form-confirm.png`, `w2c-768-light-top.png`, `w2c-768-light-table-scrolled.png`, `w2c-375-light-top.png`, `w2c-375-light-table.png`, `w2c-375-light-nascet.png`, `w2c-375-dark-table.png`.

No BEFORE screenshots were taken: Vite hot-reloaded my edits before the first visit finished loading under load. The critic's captures stand as the before state: `screens/carotid-default.png`, `screens/carotid-768.png`.

## Decisions

- **D-W2C-1. The aside scrolls on its own.** The diagram deck is 836 px and NASCET is 872 px (its two side cards stack in the column), so the aside (1,733 px) is taller than the viewport. It keeps the venous sibling's mechanics: sticky top, `max-height: 100vh − 112px`, own scroll. At 1440×900 you see the diagram beside the table, and you scroll the column to reach the NASCET cards. Once NASCETPicker gets a slim header and full-width side cards (below), the column gets shorter.
- **D-W2C-2. Below 1280 px the order is table → diagram → NASCET.** Before, it was table → NASCET → diagram. Grade-under-picture holds at every width. I did not move the diagram above the table at 768 (a critic suggestion): the architect says "below that, the stacked order stays", and the table is the entry surface.
- **D-W2C-3. Below 992 px the table uses a bounded scroll box.** Pinned column labels plus horizontal scroll can't both work against the page scroll without JS: an `overflow-x` ancestor kills page-level sticky. So the table lives in a `min(70vh, 640px)` box with both axes scrolling. Scroll chaining is left on (no `overscroll-behavior: contain`), so a finger reaching the end of the box carries on to the page.
- **D-W2C-4. Clear form is a secondary button that turns red only on hover or focus.** This is the "destructive-secondary" from the brief and matches the venous sibling exactly. Solid red at rest would break status-colour reservation, because red means stenosis on this screen. The red step is the confirm.
- **D-W2C-5. Only the flow and plaque aria suffixes were changed**, as briefed. PSV, ED and IMT stay as clinical abbreviations (the "do not translate abbreviations" rule).

## For the orchestrator (outside my fence)

1. **NASCET header band (UX-ANGIO critic "no full-width tinted band").** It comes from `NASCETPicker.tsx:71`: `EMRCollapsibleSection` with the default `variant="primary"`, a gradient band. In the narrow aside the band and its subtitle wrap to about 5 lines (`w2c-1440-light-aside-nascet.png`). Fix: a slim tick-bar header. Either NASCETPicker passes `variant="soft"` (that gives an h3, which works under the anatomy h2), or W1-G's `EMRCollapsibleSection` gets a Command tick-bar variant. **`NASCETPicker.module.css` `.previewLabel` / `.previewChip` are styled white-on-band** (with raw `rgba(255,255,255,…)`) and must change with the header to a neutral soft chip (`--emr-bg-hover` / `--emr-text-secondary`).
2. **The "auto (SRU)" text is still success green.** `NASCETPicker.module.css` `.suggestApplied` has `color: var(--emr-success, #16a34a)`, live `rgb(56,161,105)`. Change it to `--emr-text-secondary`, a neutral provenance badge.
3. **The NASCET side cards don't fill the column.** `NASCETPicker.tsx:80` `Group grow wrap="wrap"` caps each card at `max-width: 50%`, while `.axis` has `min-width: 240px`. When they wrap, each card is about 240 px in a 340 px column (and about 75 % width at 375). Use a one-column/two-column grid (for example `SimpleGrid cols={{ base: 1, sm: 2 }}`), or drop the grow cap.
4. **The `EMRContentSection` tick bar is orphaned in narrow columns** (W1-G). The header `Group` wraps and the title `Stack` has no `minWidth: 0; flex: 1`, so in the 397 px aside (and at 375) the tick bar sits on its own line above the title. Fix: `wrap="nowrap"` on the header group and `style={{ minWidth: 0, flex: 1 }}` on the title stack. This affects every study's diagram deck.
5. **The save dot is already neutral.** It comes from FormActions (W1-B) and was `rgb(148,163,184)` live. Nothing to do.
6. **Mobile action bar.** At 375 the fixed FormActions bar takes about 190 px of an 812 px viewport (4 buttons on 3 rows), which shrinks the usable table box. That belongs to W1-B / 024.
7. **Another session drove context `w2c` during this run.** The context navigated to `/encounter/99b5c57c…/arterialLE` and was closed and recreated twice (storage wiped), even though the server process stayed up. My checks were re-run as single scripted chains. Worth checking which worker reused `w2c`.

## Keys (ka / en / ru) for the i18n fence

No new keys. Reused, all existing in every locale:

| Key | ka | en | ru |
|---|---|---|---|
| `carotid.actions.newCase` (button + confirm) | ფორმის გასუფთავება | Clear form | Очистить форму |
| `carotid.actions.newCaseConfirmTitle` | გავასუფთაოთ ეს ფორმა? | Clear this form? | Очистить эту форму? |
| `carotid.actions.newCaseConfirmBody` | (unchanged) | (unchanged) | (unchanged) |
| `studies.carotid.short` (confirm first line) | საძილე არტერიები | Carotid | (existing) |
| `carotid.param.flowDirection` / `carotid.param.plaqueMorphology` (aria suffixes) | ნაკადი / ფოლაქი | Flow / Plaque | Поток / Бляшка |

Suggested follow-up only, not required: `carotid.actions.newCaseToastTitle` still says "ახალი კვლევა დაწყებულია" / "New case started" after a clear. "ფორმა გასუფთავდა" / "Form cleared" / "Форма очищена" would match the new label. The toast also uses `color: 'green'`, which is pre-existing; I left it.

## Unproven / open

- **Page height at 768 for a normal study ≤6 viewports.** Measured 2,995 px at 1024 tall, which is 2.9 viewports. That was with an otherwise empty study and the template gallery unused. A full "all normal" template run was not measured.
- **Firefox and Safari were not tested** for the sticky header and vessel column inside the scroll box. Chromium only.
- **Touch scroll chaining** on a real phone (table box → page) was not tried. Only the 375 viewport in desktop Chromium was used.
- **1280–1340 px width was not measured live.** By arithmetic the table minimum (780 + 28 padding) fits beside a 346 px aside at 1280 (main ≈ 870 px).
- **The critic's other carotid items are not in this fence:** page background token (W1-G 023), the Recommendations ribbon and empty state (W1-G 027), and the gradient-button count.

## Final test status

- `npx vitest run src/components/studies/carotid/CarotidForm.test.tsx`, re-run alone after making the assertions locale-agnostic: **9/9 pass** (6 existing + 3 new).
- Combined with the first full-folder run (the other 3 files were green, 39 tests): **48/48 carotid tests pass**.
