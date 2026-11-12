# W1-F report — UX-ANGIO-004 L3 + L4 (laterality: iliac side, arterial R-first)

Run `angio-module-2026-11-12` · Wave 1 · fence W1-F · 2026-11-12
Scope: UX-ANGIO-004 layers L3 and L4 only. UX-ANGIO-006 (TBI grading) not started — it waits on clinical sign-off S6. `abiCalculator.ts` and arterial `templates.ts` untouched.

## What changed (plain language)

- **Arterial pressures (L4, U-1023).** The pressures table had the Left column before the Right one, while every other control and the PDF list Right first. Now the column headers, the input pair in each of the 7 rows, and the ABI / TBI badges below the table all read **R then L**. Values, test IDs (`pressure-<row>-R/L`) and aria labels are unchanged, only the order moved.
- **Pelvic iliac cards (L3, U-1037 / X-TABLE iliac part).** Below desktop each vein row turns into its own card, far from the "მარჯვენა / მარცხენა" section chip, so the right and left CIV cards had identical titles. Each RIGHT/LEFT card title now ends with the side: `CIV პროქს. · მარჯვენა`. IVC rows have no side and are unchanged. On desktop (≥ 992px) the narrow 110px label column stays as it was, so nothing gets cut off there.

## Touched files

| File | Change |
|---|---|
| `src/components/studies/arterial-le/SegmentalPressureTable.tsx` | Swapped header columns, row inputs and ABI/TBI badges to R, L. Doc comment updated. |
| `src/components/studies/arterial-le/SegmentalPressureTable.test.tsx` | **New.** Asserts header order `['right','left']` and that the R input precedes the L input in the DOM. |
| `src/components/studies/iliac-pelvic-venous/IliacCavalTable.tsx` | Built on top of the uncommitted pelvic-rebuild WIP (nothing reverted). Extracted `sideLabel` (reused by the existing `fullLabel` aria text, which is unchanged), and rendered `· <side>` in the segment cell inside a Mantine `<Box component="span" hiddenFrom="md">`. |
| `src/components/studies/iliac-pelvic-venous/IliacCavalTable.test.tsx` | Added one case: RIGHT/LEFT rows carry a `[data-side]` span, the right and left CIV titles differ, IVC has none. Existing two cases untouched. |

`SegmentalPressureTable.module.css` not edited: the grid is three generic columns, not order-bound. `IliacCavalTable.module.css` is not in this fence (W2-iliac) and was not needed.

## Decisions

1. **Hide on desktop with Mantine `hiddenFrom="md"`, not CSS.** The iliac stylesheet is outside the fence. Mantine's `md` breakpoint is 62em = 992px, the same point where `IliacCavalTable.module.css` switches to cards (`max-width: 992px`). The app uses Mantine's default breakpoints and `@mantine/core/styles.css` is imported in `main.tsx`. Known edge: at exactly 992px both layouts apply, so the side shows in the table cell too. That is harmless.
2. **Plain text, not a coloured chip.** The `ArterialSegmentTable.tsx:186` pattern uses a separate side span next to the label. I kept that structure (a separate `data-side` span) but used the brief's `·` text form, because adding chip colours would need CSS in a file I don't own. The separator uses non-breaking spaces so the flex container doesn't drop the space.
3. **Desktop iliac rows unchanged.** The architect's L3 text said "render `fullLabel` as the visible cell label". I didn't do that on desktop: the 110px column is `nowrap` + ellipsis, so `CIV პროქს. (მარჯვენა)` would be cut off (§4.5). The section chip already sits right above the rows on desktop. As a result, the 1440 table still shows repeated titles under the two section chips (the measure script counts 9). That is by design. The brief's goal was the card view below desktop.
4. **Arterial header letters stay `R` / `L`.** These are hard-coded Latin letters, matching the arterial segment table's side chips. Translating them is outside this move (see the keys below).

## Tests and checks

| Command | Result |
|---|---|
| `npx vitest run src/components/studies/arterial-le/SegmentalPressureTable.test.tsx src/components/studies/iliac-pelvic-venous/IliacCavalTable.test.tsx` | 2 files, 4 tests passed |
| `npm run typecheck` | clean |
| `npm run lint` | 0 errors (14 warnings, all pre-existing and outside the fence). `npx eslint` on the 4 fenced files: clean |

No other test or e2e spec references `pressure-*` test IDs or `IliacCavalTable` (grep). Full vitest suite not run, as briefed.

## Live proof

`http://localhost:3001` (existing dev server), Playwright harness, context `--context w1f` only, Georgian UI. Fresh encounter "W1F ტესტი" with arterial + pelvic studies. Context closed at the end (`close-context w1f` → closed: true).

| Check | Measured | Evidence |
|---|---|---|
| Pressures, 1440 | headers `["დონე","R","L"]`; `pressure-brachial-R` x=223, `-L` x=404; badges `ABI R, ABI L, TBI R, TBI L` | `screens/w1f/w1f-arterial-pressures-1440.png` |
| Iliac cards, 768 | `CIV პროქს. · მარჯვენა`, `CFV · მარჯვენა`, `CIV პროქს. · მარცხენა`, `CFV · მარცხენა`, `IVC შუა` (no side); side on the same line as the label; 0 duplicate card titles; no clipping | `screens/w1f/w1f-iliac-cards-768.png` |
| Iliac cards, 375 | same titles; on one line; not clipped (title 303px wide, side ends at x=193); 0 duplicate titles | `screens/w1f/w1f-iliac-cards-375.png`, `screens/w1f/w1f-iliac-cards-375-left.png` |
| Iliac table, 1440 | side span hidden (width 0); labels unchanged in the 110px column | `screens/w1f/w1f-iliac-cards-1440.png` |

All paths are relative to `documentation/level-up/runs/angio-module-2026-11-12/`.

## Keys for W1-H

None required. The iliac side words already exist in all three locales: `iliacPelvicVenous.side.right` / `.left` (ka მარჯვენა / მარცხენა, en Right / Left, ru Правая / Левая).

Optional, only if the founder wants Georgian letters instead of `R`/`L` in the web pressures header (not done here, needs a code change in this file too): reuse the PDF's existing `arterialLE.pressureTable.sideRight` / `sideLeft`.

## Unproven / out of scope

- **375 page overflow (not caused by this change):** at 375 the pelvic page scrolls sideways. The overflowing elements are the action bar's `_buttons_` group and `#download-pdf` button (`FormActions`, W1-B / UX-ANGIO-024). Nothing in this fence overflows.
- The arterial pressures table was proven at 1440 only, as briefed. Its 768/375 layout was not re-shot. The CSS grid is order-neutral, so no change is expected.
- The behaviour at exactly 992px (both labels show) was not visually checked.
- Dark mode not re-shot. The side span inherits the title colour, so there is no new colour.
- The design-critic re-shoot ("no anonymous card") is for the orchestrator. Layers L1/L2 (venous, W1-C) are not part of this report.
