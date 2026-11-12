# W2-iliac report: pelvic study (UX-ANGIO-011 L2, 025 L4, 026 L4, 002 L3b)

Run `angio-module-2026-11-12` · Wave 2 · fence W2-iliac · 2026-11-12.
Built on top of the uncommitted pelvic-rebuild + U-1025 work and on W1-F's side-in-card-title change. Nothing was reverted. 002 L3b was skipped at first because `W1-B-report.md` didn't exist yet. It appeared mid-run, so L3b was then done and proven too.

## What changed (plain language)

- **One click for a normal pelvic study (011).** A "ყველა ნორმაში" button above the vein table sets all 21 rows to patent / full filling / competent. These are exactly the normal template's values: it's the same `NORMAL_CAVAL` object, so the button and the template can't drift apart. Phasicity stays blank (sign-off S5). A phasicity, velocity or AP diameter the clinician already typed is kept. If any row already holds a value that would change (e.g. occluded, partial, incompetent), a confirm opens first, the same `ConfirmDialog` the templates use. Cancel leaves everything as it was. A clean table fills right away.
- **Diagram beside the table (025).** From 1280px the pelvic diagram sits in a sticky right rail (300px at 1280–1439, 380px from 1440) beside the vein table. It stays in view while the clinician scrolls the 21 rows. Below 1280px the order is exactly as before (DOM order is unchanged). The rail stops above the sticky save bar and scrolls itself if the diagram is taller than the space left.
- **Short rows on tablets and phones (026).** Below 992px, an empty row is one 44px line: vein + side (W1-F's `· მარჯვენა` kept) + a neutral status chip + a chevron. Tapping it opens the row. A populated row opens by default, and any row can be folded or opened by tapping. On a tablet an open card lays its fields out in a grid (3 columns at 768) instead of one long column. The IVC / Right / Left header stays pinned at the top while its rows scroll.
- **SVP / CEAP (goal 4).** The loose "SVP and CEAP are optional" line is now the subtitle of a standard deck ("SVP / CEAP", tick-bar h2 header) that holds both pickers. **The pickers' own gradient headers are still there.** They're hard-coded inside `SVPPicker.tsx` / `CEAPPicker.tsx` (outside this fence). See handoff H1.
- **Headings (goal 5).** Every deck title on this page is already an h2 (W1-G's EMRContentSection change). The table's IVC / Right / Left headers are now h3 (Mantine `Text component="h3"`, so the global heading font rule leaves their size alone).
- **Save line (002 L3b).** Removed the form's own `lastSavedAt` state and the hard-coded `hasUnsavedChanges={false}`. FormActions now reads both from EncounterContext (W1-B), so after a reload the line shows the real save time.

## Touched files (all in the fence)

| File | Change |
|---|---|
| `src/components/studies/iliac-pelvic-venous/templates.ts` | `NORMAL_CAVAL` exported (doc comment notes it backs the button). Values unchanged. |
| `src/components/studies/iliac-pelvic-venous/IliacPelvicVenousForm.tsx` | `SET_ALL_NORMAL` reducer case (copied from venous, merges over each row). `allNormalOverwritesFindings()` (exported). Handler + third `ConfirmDialog`. Caval + gonadal decks wrapped in `.tableColumn`, diagram in `.diagramRail`, both inside `.tableDiagramLayout`. SVP + CEAP inside one `IliacZoneCard`. Local save state removed (002 L3b). `reducer` exported for tests. Unused `Text` import dropped. |
| `src/components/studies/iliac-pelvic-venous/IliacPelvicVenousForm.module.css` | `.tableDiagramLayout` / `.tableColumn` / `.diagramRail` (grid + sticky at ≥1280, 380px rail at ≥1440). The `.fieldHint` rule this change orphaned was removed. |
| `src/components/studies/iliac-pelvic-venous/IliacCavalTable.tsx` | Optional `onSetAllNormal` prop + `EMRButton` (testid `iliac-bulk-set-all-normal`). Section header → `Text component="h3"`. Compact mode via `useMediaQuery('(max-width: 992px)')`: `UnstyledButton` row toggle (testid `iliac-caval-toggle-<id>`, `aria-expanded`) with `EMRBadge variant="neutral"` + chevron. Fields render only when open. Desktop markup is unchanged. |
| `src/components/studies/iliac-pelvic-venous/IliacCavalTable.module.css` | Grid tracks are now `minmax()`. The maxima still add up to 990px, and competency took 20px from the two numeric columns so a filled "კომპეტენტური" isn't clipped by the clear ×. min-width 866px. Toolbar spacing, h3 margin reset. Below 992px: sticky opaque side header, collapsed-row style, toggle / chip / chevron styles, open-card field grid, and the last card's bottom border restored. |
| `IliacCavalTable.test.tsx`, `IliacPelvicVenousForm.test.tsx`, `templates.test.ts` | New cases (below). |

Not touched: PDF, FHIR, `config.ts`, translations, `IliacZoneCard.tsx`, any W1-B / W1-H / W2-venous file.

## Tests and checks

| Command | Result |
|---|---|
| `npm run typecheck` (and `npx tsc -p tsconfig.json --noEmit` after the last edit) | clean |
| `npm run lint` | 0 errors, 14 warnings, all pre-existing and outside the fence. `npx eslint src/components/studies/iliac-pelvic-venous/` → clean |
| `npx vitest run src/components/studies/iliac-pelvic-venous` (final, after every edit including 002 L3b) | **3 files, 16 tests passed** (302s at load ~120) |

New test cases:
- `templates.test.ts`: the template's caval **is** `NORMAL_CAVAL`. 21 rows, phasicity blank.
- `IliacCavalTable.test.tsx`: the button appears only with a callback and calls it. 3 h3 side headers. Compact mode (matchMedia mocked): an empty row is collapsed (no patency input), the side shows in the toggle, a tap opens it, a populated row is open by default.
- `IliacPelvicVenousForm.test.tsx`: the `allNormalOverwritesFindings` truth table. One click fills a clean table (full mount, no dialog, phasicity blank). The `SET_ALL_NORMAL` reducer keeps AP diameter / phasicity and leaves gonadal untouched.

Note on load: the machine ran at load average ~120 (parallel workers). The first folder run had 15/16 green, and the one red was a 180s timeout in a second full-form mount test (`findByRole` over the whole form tree). I replaced that mount test with the reducer unit test above. The confirm path's UI wiring is proven live instead (below).

Self-audit greps on all 5 source files: no `@mantine/dates`, no forbidden blues, no purple / orange / amber / yellow, no `backdrop-filter`, no hex / rgb, no dark-mode overrides. Transitions are 150ms. Mantine imports are layout primitives only (Box, Group, Text, UnstyledButton, Stack, Grid, Menu).

## Live proof (http://localhost:3001, context `w2i` only, Georgian, closed at the end)

| Check | Measured |
|---|---|
| 1440 light, layout | Before: the table used 1,020 of 1,440px, the diagram started 1,500px below the table, page 3,803px. After: caval deck 1,044px wide, diagram rail at x=1060 (380px) beside it, sticky at top 16, rail bottom 788 < save bar top 807, table `scrollWidth = clientWidth` (1002, no inner scroll), page 3,170px. |
| 1280×720 | Rail 300px at x=980. Table 922 = 922 (no inner scroll), PV column ends at x=935, inside the deck. The rail shows the top of the diagram and scrolls itself. |
| All normal, clean table | 1 click → 21/21 rows patent / full / competent, phasicity blank on all, no dialog. |
| Overwrite guard | CFV left set to occluded → click → confirm opens. Cancel → still occluded. Click again + confirm → patent / competent. |
| Draft survives reload | After all normal + generate conclusion → reload: 21/21 normal, conclusion kept (197 chars), PDF view / print / download enabled. |
| 002 L3b | Fresh visit → all normal → save line "ბოლოს შენახული: 18:29:04" → reload → still "ბოლოს შენახული: 18:29:04", `data-save-state="saved"`. |
| 768 | Empty study: page 13,809 → **3,823px** (≈4.2 viewports at 900, target ≤6), empty row 46px. Populated (all normal): 7,712px, open card 229px (3-column field grid). |
| 375 | Empty study: 14,242 → **4,302px**, row toggle 44px tall. Populated: 14,591px (open cards are one column, 539px each). `scrollWidth = 375` in every state, so no sideways scroll from anything. Tap opens a row (`aria-expanded` true). The side header pins at top 0 (Left header at 0 while the CFV-left row scrolls under it). |
| Dark | 1440 and 375 render with semantic tokens. Chip, pinned header, last-card border all readable. |
| Console | `console.error` / `warn` wrapped, then SPA remount of the form + all normal + resize to 375 + row toggle + resize back → **0 errors, 0 warnings**. |

### Clicks for a normal pelvic study

- **Before:** by hand, 21 rows × 3 normal fields × 2 clicks (open + pick) = **126 clicks**, plus 1 for "generate from findings". The architect's ≈84 counted 4 clicks per row. The template path already existed (templates → normal → confirm = 3), but it also replaces context and conclusion and clears comments.
- **After:** **1 click** ("ყველა ნორმაში") for all 21 rows + 1 "გენერაცია ნაპოვნიდან" = **2 clicks**, measured live. Optional +2 to mark the left gonadal reflux "absent" (that section is outside the table, and the button deliberately doesn't touch it) = 4.

### Evidence

All under `documentation/level-up/runs/angio-module-2026-11-12/screens/w2i/` (originals also in `/Users/toko/Desktop/medimind-angio/screenshots/`):
`w2i-BEFORE-{1440,768,375}.png`, `w2i-AFTER-1440-light.png` (full page, all normal), `w2i-AFTER-1440-sticky.png` / `-scrolled.png` (rail while scrolling; `-scrolled` was shot before the rail height cap), `w2i-AFTER-1280.png`, `w2i-AFTER-allnormal-confirm.png`, `w2i-AFTER-768-{empty,populated}.png`, `w2i-AFTER-375-{empty,populated,expanded,sticky-side}.png`, `w2i-AFTER-1440-dark.png`, `w2i-AFTER-375-dark.png`, `w2i-AFTER-L3b-reload-savetime.png`.

## Decisions

1. **Merge, not replace.** Venous's `SET_ALL_NORMAL` replaces each row. Here the three normal values are merged over the row, so a measured velocity, AP diameter or phasicity survives a bulk action. Only patency / filling / competency are written.
2. **When to confirm.** Only when a value that is already set would change. Blank fields and values that already read normal never ask, so the normal path stays at 1 click.
3. **The button doesn't touch the gonadal section or the conclusion.** It's a table action, like venous's. The normal template still does the whole study.
4. **Compact mode in JS (`useMediaQuery`) with the same 992px query as the CSS cards.** That way a collapsed row doesn't mount 6 hidden inputs, and desktop markup and testids are unchanged. jsdom's matchMedia stub returns false, so existing tests see the desktop table.
5. **Populated rows open by default** (as briefed). After "all normal" a phone shows 21 open cards. On a tablet the 3-column field grid keeps that to 7,712px. Any card can be folded by tapping.
6. **Rail widths.** At 1440 the table keeps its full 990px tracks. At 1280–1439 the 300px rail is paid for by `minmax()` tracks (≤20px each), so no column scrolls out of the deck. That is the arterial UX-ANGIO-015 failure, avoided here.
7. **Rail height cap uses a local 96px clearance** for the FormActions bar (no theme token exists for its height). If W1-B changes the bar height, adjust `--iliac-rail-bottom-clearance` in `IliacPelvicVenousForm.module.css`.
8. **Classification title fallback is "SVP / CEAP"**, which reads correctly in all three languages until W1-H merges the key.
9. **Chip colour:** `EMRBadge variant="neutral"`, never a severity colour, because a row being empty or recorded is not a clinical finding (status-colour reservation).

## Keys for W1-H (none exist yet; code shows the fallback until merged)

File `src/translations/iliac-pelvic-venous/{ka,en,ru}.json`, under `iliacPelvicVenous`:

| Key | ka | en | ru |
|---|---|---|---|
| `iliacPelvicVenous.actions.allNormal` | ყველა ნორმაში | All normal | Всё в норме |
| `iliacPelvicVenous.actions.allNormalConfirmTitle` | ყველა ვენა ნორმაში მოვნიშნოთ? | Set every vein to normal? | Отметить все вены как норму? |
| `iliacPelvicVenous.actions.allNormalConfirmBody` | ზოგიერთ ვენას უკვე აქვს პათოლოგიური მნიშვნელობა. ყველა ვენა მოინიშნება როგორც გამავალი, სრული ავსებით და კომპეტენტური. ფაზურობა, სიჩქარე და დიამეტრი უცვლელი დარჩება. | Some veins already have an abnormal value. This sets every vein to patent, full filling and competent. Phasicity, velocity and diameter stay as entered. | У некоторых вен уже есть патологическое значение. Все вены будут отмечены как проходимые, с полным заполнением и состоятельные. Фазность, скорость и диаметр останутся без изменений. |
| `iliacPelvicVenous.actions.allNormalConfirm` | ნორმაში მონიშვნა | Set all normal | Отметить норму |
| `iliacPelvicVenous.rowStatus.empty` | არ არის შევსებული | Not recorded | Не заполнено |
| `iliacPelvicVenous.rowStatus.recorded` | შევსებულია | Recorded | Заполнено |
| `iliacPelvicVenous.zone.classification.title` | კლასიფიკაცია | Classification | Классификация |

`actions.allNormal` already renders Georgian today: its fallback is the existing `venousLE.bulk.allNormal`. Until the merge, the confirm and the chip show English. The Georgian wording above is a proposal for the i18n owner and the clinician to check.

## Handoffs / unproven

- **H1 (goal 4, not fully met inside the fence).** SVP and CEAP still render gradient headers inside the new deck. They call `EMRCollapsibleSection` with the default `variant="primary"`. Fix: give `SVPPicker` / `CEAPPicker` an optional `variant` prop passed to `EMRCollapsibleSection` (it already has `'soft'`, documented "use when nested inside another container"), then pass `variant="soft"` from this form. That's 1 line in each picker + 2 here. `CEAPPicker.tsx` is W1-G's file; `SVPPicker.tsx` has no owner in the fence map.
- **H2 (wrapper, cosmetic).** In the 300–380px rail, `EMRContentSection`'s title group wraps, so the tick bar sits on its own line above the diagram title (visible in `w2i-AFTER-1440-sticky.png`). Fix in `EMRContentSection.tsx`: `wrap="nowrap"` on the title `Group` + `minWidth: 0` on its `Stack`.
- **Unproven:** the PDF of an all-normal study was not opened (PDF code is unchanged and reads the same `segmentFindings`). At exactly 992px the CSS and the JS compact switch were not checked side by side. 768 dark was not shot (1440 and 375 dark were). The design-critic / composition-metrics re-shoot is for the orchestrator. The "ONE focal element" and density verdicts are not scored here.
- **Pre-existing, not mine:** the CFV-only "—" placeholder cells still show in open mobile cards. The `.muted[data-label]` hide rule never matches, because the span has no `data-label`. I left it alone (outside the brief).
- Test visits "W2I ტესტი", "W2I ცარიელი", "W2I შენახვა" lived only in the `w2i` context's storage, which was cleared when the context closed.
