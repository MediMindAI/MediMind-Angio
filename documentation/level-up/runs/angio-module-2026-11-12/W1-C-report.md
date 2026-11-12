# W1-C report — Venous report + venous labels

Run `angio-module-2026-11-12` · fence W1-C · moves UX-ANGIO-003 (L1, L3) and UX-ANGIO-004 (L1, L2) · 2026-11-12
Status: **built and proven.** One open layout consequence for S4 (see "Unproven / open").

## In plain language

- **Paper report (U-1033, critical).** Before, if a sonographer marked a vein as refluxing, or not fully compressible, and typed no number, the PDF table dropped that row. The table printed only "—" and just the diagram turned red. Now each row prints the values the clinician picked, as words, on a line under the numbers, e.g. `კომპეტენტურობა: რეფლუქი` or `კომპრესიულობა: ნაწილობრივი`. The line is red when those values make the diagram red (reflux or occlusion). The diagram itself is unchanged.
- **Tablet/phone cards (U-1022, critical).** Below desktop width the measurement cards (duration / diameter / depth) had no vein name. Each card now shows the vein's full Georgian name and an R/L badge. At desktop width the name lives in the table beside it, so nothing changes there.
- **Side badge (U-1037).** On long GSV rows the next cell painted over the R/L badge. The label column is now wide enough (88 → 148px), and a longer label in future would cut its text, never the badge.

## Touched files (fence only)

| File | Change |
|---|---|
| `src/components/pdf/sections/FindingsTable.tsx` | Row filter counts categorical values. A categorical line goes under each row, built from `PRINTED_CATEGORICAL_FIELDS = ['competencyOverride','compressibility','thrombosis','phasicity']`, the single knob for S4. It turns red when `deriveCompetency()` (the diagram's own rule) gives incompetent/occluded. New optional label maps `field` and `value`. |
| `src/components/pdf/buildReportLabels.ts` | Builds the `findings.field` / `findings.value` maps from the **same keys the on-screen segment table uses** (`venousLE.param.*`, `venousLE.compressibility/thrombosis/phasicity.*`, `venousLE.competency.*`). Added on top of the uncommitted pelvic WIP; nothing reverted. |
| `src/components/form/ReflexTimeTable.tsx` | The segment cell (existing label + R/L badge markup) and its column header now render in `headless` mode too, with class `segmentCellStacked`. |
| `src/components/form/ReflexTimeTable.module.css` | `@media (min-width:1200px) { .segmentCellStacked { display:none } }`, placed after `.segmentCell` (source order matters). At ≤768 the label may wrap. |
| `src/components/form/SegmentTable.module.css` | Label column 88px → 148px. Button `max-width:100%`. Label text ellipsizes. Badge `flex-shrink:0`. |
| `src/components/pdf/sections/FindingsTable.test.tsx` | **New.** 9 tests. |
| `src/components/form/ReflexTimeTable.test.tsx` | +1 test (headless rows carry name + badge). |

Not touched: `observations/venous.ts` (L2/FHIR waits on S7), translations, any other fence. Typecheck forced one compromise: `scripts/test-pdf.ts` is outside my fence, carries others' WIP and is in the typecheck include. So `field`/`value` are **optional** on `FindingsTableLabels`, and a missing entry falls back to the raw key. `buildReportLabels` always fills them.

## Tests and checks

| Command | Result |
|---|---|
| `npx vitest run src/components/pdf/sections/FindingsTable.test.tsx src/components/form/ReflexTimeTable.test.tsx src/components/pdf/sections/IliacPelvicVenousFindingsTable.test.tsx` | 3 files, 19/19 pass |
| `npx vitest run src/components/pdf/ReportDocument.test.tsx src/components/pdf/UnifiedReportDocument.test.tsx` (FindingsTable consumers) | 2 files, 21/21 pass |
| `npm run typecheck` | clean |
| `npm run lint` | 0 errors (14 pre-existing warnings, none in fence files) |

There is no SegmentTable test file. The L2 change is CSS only and was proven live (below).

## Evidence

**PDF (U-1033).** Rendered with the real `ReportDocument` + real `buildReportLabels` + merged `ka` translation files + the registered `PDF_FONT_FAMILY` fonts. The throwaway script `scripts/w1c-pdf-proof.tmp.ts` was deleted after use.
- `documentation/level-up/runs/angio-module-2026-11-12/pdf/w1c-venous-reflux-only.pdf` (+ `-p1-1.png`). Input: GSV prox-thigh R = override incompetent only, CFV R = partial compressibility only, SFJ L = numbers, SSV L = thrombosis none only, GSV calf L = override 'inconclusive' (shown as perforator). `pdftotext` shows:
  - `ბარძაყის საერთო ვენა` … `კომპრესიულობა: ნაწილობრივი` (red)
  - `დიდი საჩინო ვენა (ბარძაყის პროქსიმალური ნაწილი)` … `კომპეტენტურობა: რეფლუქი` (red)
  - `დიდი საჩინო ვენა (წვივი)` … `კომპეტენტურობა: პერფორანტი` (regular colour)
  - SSV with only "none" is not printed. Diagram still red GSV, black CFV, blue calf perforator.
- Before: the walk's `qa-reports/ux/runs/angio-module-2026-11-12-phys/walks/vascular-physician/pdfs/t9-download.pdf` prints the right-side table as a bare `—`.

**Live UI (U-1022 / U-1037).** `http://localhost:3001`, Playwright harness `--context w1c` only, Georgian (`emr-language=ka`). Context closed afterwards. Screens are in `documentation/level-up/runs/angio-module-2026-11-12/screens/w1c/`:
- `w1c-before-375.png`, `w1c-before-768.png`: anonymous duration/diameter/depth cards.
- `w1c-after-768.png`, `w1c-after-375.png`: every card headed by its full Georgian name + R badge. DOM check at both widths: 19/19 numeric rows named, 0 anonymous, 0 clipped badges. Example: `დიდი საჩინო ვენა (ბარძაყის პროქსიმალური ნაწილი) | R`.
- `w1c-before-1440.png` vs `w1c-after-1440.png`: GSV Prox Thigh badge right edge at 173px, next cell starts at 198px. Before, the cell started at 138px, over the badge. The numeric table at 1440 is unchanged (name cell `display:none`).
- `w1c-after-1024.png` (stacked band: name is the 1st grid column) and `w1c-after-1200.png` (tightest side-by-side: select cells 86 → 77px, rows still aligned).

## Decisions

1. **One categorical text line per row, not 4 extra columns.** Each venous side table is half a page wide (~250pt). Four more Georgian-headed columns would clip, and a single "values" column would be ambiguous: `დაუდგენელი` means "inconclusive" for three different fields. So each value prints as "field: value", using the on-screen field names.
2. **Labels match the screen**, not the diagram legend. `venousLE.competency.*` is what the clinician picked in the dropdown. The root `competency.*` legend reads differently, e.g. normal = `ნორმალური` vs `კომპეტენტური`.
3. **Every entered value prints (D9 literally)**, normal ones included. The only skip: a value whose label *is* the dash (thrombosis `none` → "—").
4. **Red = the diagram's own rule** (`deriveCompetency`). No new clinical threshold.
5. **L2 by widening (148px)**, the arterial/carotid precedent. Reordering the badge would need `SegmentTable.tsx`, which is the W3-perforator fence.

## Keys for W1-H

**None needed.** All labels already exist in ka/en/ru: `venousLE.param.{competency,compressibility,thrombosis,phasicity}`, `venousLE.competency.*`, `venousLE.compressibility.*`, `venousLE.thrombosis.*`, `venousLE.phasicity.*`, `venousLE.segment.*`, `venousLE.segmentTable.segment`.

## Unproven / open

- **S4 layout consequence (needs a decision).** Because every entered value prints, a study filled with the built-in "normal bilateral" template now lists all 19 segments per side. The venous report grows from 2 to **4 pages**: the table runs onto page 2 and the diagram moves to page 3. Evidence: `pdf/w1c-venous-normal-template.pdf` (+ `-1.png`, `-2.png`). If S4 prefers short normal reports, the change is one line in `FindingsTable.tsx` `buildRows`: skip `compressibility.normal`, `phasicity.respirophasic` and `competencyOverride.normal` the same way the dash label is skipped. That is deciding which values count as "normal", so it is a clinician's call, not mine. Abnormal values print either way.
- The 2-page "before" count for the normal template comes from reading the code, not from a render: the old filter dropped every row without a number, and the template has no numbers.
- No browser-download PDF was taken. Proof is the Node render through the same `ReportDocument` + `buildReportLabels`. `UnifiedReportDocument` uses the same `FindingsTable` + labels but was not rendered separately.
- The PDF prints override 'inconclusive' as `პერფორანტი` (what the clinician saw). FHIR export of `competencyOverride` (003 L2) still waits on S7.
- The categorical line has no ka/en/ru check beyond Georgian. en/ru labels exist and are used through the same keys.
