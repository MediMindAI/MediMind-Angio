# W2-arterial report: arterial form (UX-ANGIO-002 L3a, 005 L2–L3, 015, 025 L1, 026 L2, 018 carry-over)

Run `angio-module-2026-11-12` · worker W2-arterial · 2026-11-12 · status **DONE, with one partial item: at 1440×900 the sticky diagram is taller than its box (see Unproven).** UX-ANGIO-006 was not touched (it waits on sign-off S6).

## In plain language

- **The table fits its card.** At 1440 the segment table gets the width its columns need, so the plaque and occlusion columns are on screen with no sideways scrolling inside the card. Before, the table was 890 px wide in a 777 px box.
- **The diagram sits beside the table.** The anatomy diagram moved from about 2,700 px down the page into the left column, under the pressures card. From 1280 px it stays pinned while the table scrolls past. Between 1280 and 1399 px the pressures card has its own row and the diagram sits beside the table below it. Below 1280 px everything stacks: pressures, then diagram, then table.
- **Tablet (768): one card per segment.** The right and left blocks of a segment sit side by side as one card, and the name appears once. A segment with nothing recorded shows only its name row and the waveform picker (125 px). It opens to all fields once a waveform is picked, once the clinician tabs into it, or when the chevron is tapped. Page height went from 17,416 px to 5,936 px, about 5.8 screens.
- **Phone (375): an R/L switch.** A bilateral study shows one leg at a time behind a pinned "მარჯვენა | მარცხენა" switch, with 17 cards instead of 34. This only changes what is shown. The saved `view` stays `bilateral`, and the other leg is one tap away. No sideways scroll (scrollWidth 375). Page height went from 17,675 px to 6,136 px.
- **"Clear form" says what it does.** The '+ new case' button is now a quiet secondary button with an eraser icon, labelled "ფორმის გასუფთავება". It shows red only on hover or focus. The confirm names the patient and the study, and its confirm button is red.
- **Save line.** The form no longer keeps its own "last saved" clock. The bar reads the stored save time from the visit, so after a reload it shows the real time.
- **Headings.** The segment-table title is now a real `h2`. The page has 4 h2 headings (anatomy, segment table, run-off, recommendations).

## Touched files (fence only)

| File | Change |
|---|---|
| `src/components/studies/arterial-le/ArterialLEForm.tsx` | **002 L3a:** removed `lastSavedAtRef`, the `lastSavedAt` / `hasUnsavedChanges` state, and the two props passed to `FormActions`. W1-A's `lastPersistedRef` idle-save guard is unchanged. `saveNow` still calls `setStudyState`. **005 L2/L3:** the raw `<button className=newCaseButton>` + `IconPlus` became `EMRButton variant="secondary"` + `IconEraser` (`data-testid="arterial-new-case-button"`). The confirm `message` has a bold first line `patient · studies.arterialLE.short` (`data-testid="arterial-new-case-confirm-patient"`). `destructive` was already set. English fallbacks updated to "Clear form" / "Clear this form?". **015/025 L1:** Mantine `Grid` (5/7) replaced by `div.assessmentLayout` with three areas (pressures, diagram, table). The anatomy `EMRContentSection` moved into the diagram area; its props are unchanged. **026 L2:** `useMediaQuery('(max-width: 639px)')` plus a local `phoneSide` state. When the view is bilateral on a phone, an `EMRViewToggle` (R/L, `size="lg"`, 46 px tap target) renders above the table, and the table gets `view={phoneSide}`. `state.view` is never changed. The clinician-feedback WIP is kept. |
| `src/components/studies/arterial-le/ArterialLEForm.module.css` | `.newCaseButton` replaced by `.clearFormButton` (same treatment as venous: red border and text on hover/focus only, hidden in print). New `.assessmentLayout` / `.pressuresArea` / `.diagramArea` / `.tableArea` / `.sideSwitch`. Columns: one below 1280. At 1280: `minmax(0,1fr) minmax(918px,2.4fr)` with areas `pressures pressures / diagram table`. At 1400: `pressures table / diagram table`. Sticky diagram: `top: --emr-spacing-lg`, `max-height: calc(100vh - 16px - 96px)`, scrolls inside the box, the same as venous. Tokens only. |
| `src/components/studies/arterial-le/ArterialSegmentTable.module.css` | Desktop grid unchanged (890 px; the 180 px label column is not trimmed). Below 992 px the card chrome moved from `.row` to the per-side wrapper, so the details panel sits inside the card. Empty blocks collapse with `:has()`: PSV / stenosis / plaque / occlusion hide until a value exists (`input[value]`, checked box, `aria-checked` waveform, open or filled details), the block has focus, or the chevron is open. At 640–992 px, bilateral only (both sides present): a 2-column grid joins R and L into one card. The L name is `visibility: hidden`, so the rows line up and the name prints once. |
| `src/components/studies/arterial-le/ArterialSegmentTable.tsx` | Only `component="h2"` on the title `Text`. W1-H's aria-label edits are kept. |
| `src/components/studies/arterial-le/ArterialLEForm.test.tsx` | The `FormActions` mock now records its props. New test 1 (wave-2 contract): no `lastSavedAt` / `hasUnsavedChanges` props; the diagram area comes before the first segment input in document order; the clear button has no '+' and no primary class; the confirm names "Jane Doe". New test 2 (phone, mocked `matchMedia`): the R/L switch shows; only right inputs at first, only left after switching. |
| `src/components/studies/arterial-le/ArterialSegmentTable.test.tsx` | New: the title is `heading` level 2, "სეგმენტური შეფასება". |

`SegmentalPressureTable.tsx` also shows in `git diff`. That is W1-F's change, not mine.

## Tests and results

| Command | Result |
|---|---|
| `npm run typecheck` | clean (also re-run after the last edit) |
| `npm run lint` | 0 errors, 14 warnings, all there before. The ArterialLEForm `:525 isBuiltInTemplate` warning is in an untouched hunk. `npx eslint src/components/studies/arterial-le/`: 0 errors, 1 warning (the same one). |
| `npx vitest run src/components/studies/arterial-le` | 5 files, **38/39**. The one failure was the file's first test, `does NOT render the legacy <StudyHeader>`, hitting its 60 s limit on a cold first mount (116 s at load average ~100). W1-B saw the same thing. All 3 new tests passed in this run. |
| `npx vitest run src/components/studies/arterial-le/ArterialLEForm.test.tsx --no-file-parallelism` (re-run alone) | **8/8 pass** (load average 29–56). Folder total **39/39**. |
| `npm run i18n:check` | arterial-le parity OK. Fails only on my new key `arterialLE.segmentTable.sideSwitchLabel` (pending W1-H) plus iliac keys from another fence. |
| Self-audit | No raw Mantine visuals (only `Stack/Group/Text/Box`), no `@mantine/dates`, no forbidden blues, purple, orange, amber or yellow, no `backdrop-filter`, no hex or rgba in my CSS, no dark-mode overrides. `npm run ui:orphans`: no arterial file listed. |

## Decisions

- **D-W2A-1. "Destructive-secondary" means a secondary button whose red shows only on hover/focus**, the same as W2-venous's `.clearFormButton`. At rest red stays reserved for clinical severity (the collision rule). The confirm button is red (`EMRButton danger`, rgb 229,62,62).
- **D-W2A-2. Desktop breakpoints.** 1280–1399: pressures get a full row, then diagram | table. At 1400 and up the pressures join the left column, as the brief and critic asked. Reason: at 1280 the left column is only 283–306 px, too narrow for the pressures card, but wide enough for the diagram. The table column has a hard floor of 918 px (890 grid + 28 padding), so it never scrolls inside.
- **D-W2A-3. Diagram before table when stacked** (below 1280). This follows from the brief's DOM order (pressures → diagram) and matches the 768/375 critic advice. The architect's "keep today's stacked order" (table first) is superseded here.
- **D-W2A-4. 026 L2 is CSS-only for the table.** `ArterialSegmentTable.tsx` was fenced to the `h2` line. So the tablet pairing and the empty collapse use `:has()` and attribute selectors on the existing DOM. React mirrors controlled input values to the `value` attribute; I checked this live (stenosis → `value="70–99 %"`, hidden `value="severe"`). Without `:has()` support the layout falls back to today's one-card-per-side list, so nothing is lost.
- **D-W2A-5. The phone R/L switch is display-only and lives in the form.** It is local state, never saved. It defaults to Right (R-first everywhere). Below 640 px the waveform picker (254 px) cannot fit two halves side by side, so 640 is the switch point.
- **D-W2A-6. Playwright context.** The brief said `--context w2a`. The shared scratchpad held W2-carotid's wrapper `c.sh` (`--context w2c`), and my first `cat > c.sh` overwrote it. For about 15 minutes their commands landed in `w2a`: their "W2C ტესტი პაციენტი" visits appeared in my context. I restored `c.sh` to `w2c`, moved to my own `w2a-arterial-cmd.sh`, and briefly used, then closed, `w2a-arterial`. All proof below is from a fresh `w2a` visit, and `w2a` is now closed. **W2-carotid may want to re-check any evidence it captured around 18:15–18:31.**

## Live evidence (http://localhost:3001, ka, context `w2a`, closed)

Visit `a9b81842-14e3-4ae3-b495-fc4220c61cfe`, created through intake ("W2A არტერიული პაციენტი", arterial only). Abnormal finding entered: SFA Mid R, monophasic, PSV 420, 70–99 %.

| Check | Before | After |
|---|---|---|
| 1440 table scrollWidth / clientWidth | 890 / 777 (clipped) | 943 / 943; occlusion box right edge 1346 < card 1416 |
| 1440 diagram top (page y) | 2,696 | 852, left column, under pressures |
| 1440 document height | 4,755 | 3,346 |
| 1280 | not measured | table 918 px wide, 890/890; diagram 306 px wide beside it; scrollWidth 1280 |
| 768 height / layout | 17,416, 34 cards | 5,936; R/L pairs as one card; 17 visible names; empty card 125 px, opens to 399 px after a waveform pick |
| 375 height / scrollWidth | 17,675 / 375 | 6,136 / 375; 17 cards for one leg; switch tap 46 px; after the switch only left cards show; saved `view` still `bilateral` |
| Row + segment together, 1440×900 | never (diagram ~2,700 px down) | at scroll 700: row top y=35, red `sfa-mid-right` (stroke #991b1b) at y=793–861 |
| Dark 1440 | n/a | page rgb(15,23,42) ≠ card rgb(30,41,59); table 943/943; clear button on the card surface |
| Reload | n/a | PSV 420, 70–99 %, monophasic restored; save line "ბოლოს შენახული: 18:49:19" = stored `updatedAt` 14:49:19Z (+4) |
| Confirm | add-looking '+' button | title "გავასუფთაოთ ეს ფორმა?", first line "W2A არტერიული პაციენტი · ქვ. კიდურების არტერიები", red confirm |
| Console (hooked error/warn/onerror/unhandledrejection) | n/a | 0 entries across clear-form open/cancel, resize 1440→768→375, side switch, waveform pick |

Screenshots (`/Users/toko/Desktop/medimind-angio/screenshots/`): `w2a-BEFORE-1440-light.png`, `w2a-AFTER-1440-light-top.png`, `w2a-AFTER-1440-light-row-and-segment-700.png`, `w2a-AFTER-1440-light-row-and-diagram.png`, `w2a-AFTER-1440-light-abnormal-sticky.png`, `w2a-AFTER-1440-clear-confirm.png`, `w2a-AFTER-1440-dark.png`, `w2a-AFTER-1280-diagram-beside-table.png`, `w2a-AFTER-768-pairs.png`, `w2a-AFTER-768-touched-expands.png`, `w2a-AFTER-375-top.png`, `w2a-AFTER-375-side-switch.png`, `w2a-AFTER-375-left-leg.png`. Run BEFORE screens: `screens/arterial-le-default.png`, `screens/arterial-le-768.png`.

## Keys for W1-H (ka / en / ru)

| Key | ka | en | ru |
|---|---|---|---|
| `arterialLE.segmentTable.sideSwitchLabel` (new; aria-label of the phone R/L switch group) | სეგმენტების ცხრილში ნაჩვენები კიდური | Leg shown in the segment table | Конечность, показанная в таблице сегментов |

Reused existing keys: `arterialLE.actions.newCase*` (W1-H values), `studies.arterialLE.short`, `arterialLE.tabs.right/left`.

Suggested value change (optional, W1-H's call): `arterialLE.actions.newCaseToastTitle` still says "ახალი კვლევა დაწყებულია" (new study started) after a *clear form*. Suggest `ფორმა გასუფთავდა` / `Form cleared` / `Форма очищена`.

## Unproven / open

- **Sticky diagram is taller than its box at 1440×900.** The leg drawing (viewBox 600×1453) is about 820 px tall at the 340 px column width, and the whole card is 1,292 px against a 788 px sticky box. Proximal findings (CFA–SFA) can be seen with their segment before the diagram sticks (proven at scroll 700, though the segment's lower part is under the report bar). Once stuck, the box shows groin to mid-calf, so distal segments (tibial, DPA) need a scroll inside the box. A real fix needs `AnatomyDiagramSection` to forward AnatomyView's existing `size` preset, or a height cap. That is a shared component outside this fence (4 callers), so I recommend it as a follow-up for the orchestrator. Venous has the same limit.
- **`SegmentalPressureTable` title is not an h2** (carry-over list). The file is W1-F's and outside this fence. It is a one-line `component="h2"` for whoever owns it.
- **EMRViewToggle buttons have no `aria-pressed`**, so a screen reader does not hear which leg is selected (the top Right/Both/Left toggle has the same gap). The switch group has an aria-label. The wrapper fix belongs to the library owner.
- **The modal backdrop renders blurred** in the clear-form confirm screenshot. That is the shared ConfirmDialog/EMRModal (possibly `backdrop-filter`), not this fence. Worth a check by W1-G or the library owner.
- **993–1279 px was not checked live.** By arithmetic the stacked table is ≥1,037 px there against its 890 px grid.
- `:has()` needs Chromium 105+, Safari 15.4+ or Firefox 121+. Older browsers get the previous list layout. Not checked on hospital machines.
