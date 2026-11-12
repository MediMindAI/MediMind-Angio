# W1-G report — Shared chrome (UI-X lane) · run `angio-module-2026-11-12`

Moves: UX-ANGIO-021 (done first), 023, 027, 016, 018, 022 L2–L3. All verified live at
http://localhost:3001, Georgian UI, Playwright context `w1g` (closed at the end).

## Touched files (all inside the W1-G fence; none carried uncommitted WIP before this run)

| File | Move | Change |
|---|---|---|
| `src/main.tsx` | 021 L1 | The three `@mantine/*.css` imports now sit above `import App`. theme.css + print.css are unchanged (still after App). |
| `src/styles/theme.css` | 023 L1, 018 | Light `--emr-bg-page` `#ffffff` → `#e7ebf1` (reference `deep-dive.html --paper`). Dark and print values unchanged. The global `h1–h6 { font-size … !important }` rules now skip `.mantine-Text-root`, so a Mantine `<Text component="h2">` keeps its own size (that is how 018 adds headings with no visual change). |
| `src/components/common/EMRContentSection.tsx` | 018 L1 | Title `Text` → `component="h2"`. |
| `src/components/common/EMRCollapsibleSection.tsx` | 016 L1, 018 L2 | (a) A rightSection click is stopped only when it lands on an interactive control (`INTERACTIVE_SELECTOR`), so a passive chip now toggles the header. (b) The header row is wrapped in `<Text component="h2" inherit>` (`h3` for `variant="soft"`). The heading wraps the button (WAI accordion pattern); a heading *inside* `role="button"` would be flattened to plain text. |
| `src/components/form/CEAPPicker.tsx` | 016 L2 | `defaultOpen={value != null}`: a saved classification opens expanded, an untouched one stays folded. |
| `src/components/form/RecommendationsBlock.tsx` | 027 L1–L2, 018 | Icon tile → 4×15 gradient tick. Title → `h2`. Add button `primary` → `secondary`. Empty state = header row only (the muted "none added" line replaces the subtitle; no body, no dashed box). Header row wraps on phones. Trash `aria-label` uses new key `venousLE.recommendations.remove` (was `common.close`). |
| `src/components/form/RecommendationsBlock.module.css` | 023 L2, 027 | Deck style (borderless, `--emr-shadow-card`, hover `--emr-shadow-card-hover`). 3px ribbon removed. `.tick` added. Title `--emr-font-md`. No header divider when empty. `.empty` rule removed. |
| `src/components/form/ImpressionBlock.module.css` | 023 L2 | `.card` → deck style. **Not rendered anywhere today** (dead component), so there is no visible effect. |
| `src/components/form/StudyHeader.module.css` | 023 L2 | `.card` → deck style. **Not rendered anywhere today** (removed in Phase 3b), so there is no visible effect. |
| `src/components/anatomy/AnatomyView.tsx` | 022 L2 | New regex rewrite: silhouette `fill` → `var(--emr-bg-hover)`. That token is exactly `#f7fafc` in light (pixel-identical) and slate `#334155` in dark. Screen only; the PDF path (`anatomyToPdfSvg.ts`) still reads the raw SVG. `dangerouslySetInnerHTML` pattern untouched. |
| `src/components/anatomy/AnatomyLegend.tsx` | 022 L3 | Each swatch gets `box-shadow: 0 0 0 1px var(--emr-border-secondary)` (outer hairline, size unchanged). |

Not touched: `EMRButton.tsx` (021 L3 is optional, see Decisions), `CEAPPicker.module.css`, `SVPPicker.module.css`, `DrawingToolbar.module.css` (023 L3 visual pass found nothing to change).

Tests added/edited: `src/main.test.ts` (new), `src/components/common/EMRCollapsibleSection.test.tsx` (new), `src/components/common/EMRContentSection.test.tsx` (new), `src/components/form/RecommendationsBlock.test.tsx` (new), `src/components/anatomy/AnatomyLegend.test.tsx` (new), `src/components/anatomy/AnatomyView.test.tsx` (+1 case), `src/components/form/CEAPPicker.test.tsx` (+3 cases; the `openSection()` helper now clicks only when the section is folded, because a saved value now opens expanded).

## Tests run + results

```
npx vitest run src/main.test.ts src/components/common/EMRCollapsibleSection.test.tsx \
  src/components/common/EMRContentSection.test.tsx src/components/form/RecommendationsBlock.test.tsx \
  src/components/form/CEAPPicker.test.tsx src/components/form/SVPPicker.test.tsx \
  src/components/anatomy/AnatomyView.test.tsx src/components/anatomy/AnatomyLegend.test.tsx \
  src/components/form/ImpressionBlock.test.tsx src/styles/theme.test.ts
```
→ 10 files, 32 tests, all pass. (RecommendationsBlock re-run after the final wrap tweak: 3/3 pass.)

- `npm run typecheck` → clean.
- `npm run lint` → 0 errors. 14 warnings, all in files outside this fence.
- `npm run ui:orphans` → none of my files listed. (The script rewrites `audit-findings/ui-orphans-2026-11-12.{md,json}` as a side effect.)
- Self-audit greps on touched files (dates imports, forbidden blues, purple/orange/amber/yellow, backdrop-filter, dark overrides in CSS modules, new hex/rgb) → clean. The only hex added is the token value inside theme.css.
- Live console capture (wrapped `console.error`/`warn` plus SPA remount of intake and all 4 study screens) → 0 errors, 0 warnings.

## Evidence (all under `/Users/toko/Desktop/medimind-angio/screenshots/`)

**021 — stylesheet order**
- Before, live: sheet order was `EMRButton.module.css` = 1, `theme.css` = 30, `@mantine/core` = 74. Every secondary/ghost EMRButton computed `rgb(43,108,176)` bg with white text, and primaries lost their gradient. Shot: `w1g-BEFORE-venous-1440-light.png`.
- After: Mantine = 0/1/2, EMRButton = 4, theme.css = 33, print = 77. Secondary = `rgb(255,255,255)` / dark text. Ghost = transparent / `rgb(107,114,128)`. Shot: `w1g-AFTER021-venous-1440-light.png`.
- Destructive confirm ("+ ახალი კვლევა" → confirm): "წაშლა და ახლის დაწყება" computes `rgb(229,62,62)` (danger red); "გაუქმება" is ghost. Shot: `w1g-AFTER021-confirm-danger.png`.
- Side effect worth knowing: in dev, theme.css also used to load *before* Mantine. Theme overrides now win over Mantine on equal specificity everywhere (the intended Wave 4.4 order). I saw no other visual regressions on intake or the 4 study screens.

**023 — page vs card**
- Light body = `rgb(231,235,241)`, card `#ffffff`, contrast ≈ 1.20:1 (target ≥ 1.05) on intake + venous + arterial + carotid + iliac. Dark body unchanged (`rgb(15,23,42)` vs card `#1e293b`).
- Shots: `w1g-AFTER-intake-1440-light.png`, `w1g-AFTER-{venousLEBilateral,arterialLE,carotid,iliacPelvicVenous}-1440-light.png`, `w1g-AFTER-intake-1440-dark.png`, `w1g-AFTER-venousLEBilateral-1440-dark.png`.
- L3 inset pass: `w1g-L3-ceap-open-light.png` (CEAP/SVP unselected chips), `w1g-L3-toolbar-light.png` (drawing toolbar sub-groups). The recommendation item card also uses the inset. All read as recessed wells under white decks, so no change was needed and dark stays untouched.

**027 — Recommendations**
- Empty deck height: **67px** on venous, arterial and carotid at 1440 (architect measured 223px before). Populated with one item: 253px. So empty ≤ populated holds.
- At 375 the header wraps (button under the title): 119px, title not truncated.
- Trash button `aria-label` = "Delete recommendation" (English fallback until W1-H merges the key below).
- Shots: `w1g-AFTER027-recs-empty-1440-light.png`, `w1g-AFTER027-recs-populated-1440-light.png`, `w1g-AFTER027-recs-375.png`, `w1g-AFTER027-recs-ceap-dark.png`. (`w1g-AFTER-venousLEBilateral-375.png` / `w1g-AFTER-venous-recs-ceap-375.png` were shot *before* the wrap fix and show the truncated title.)

**016 — CEAP header**
- L0 confirmed the hypothesis: clicking the "C0,En,An,Pn" chip left `aria-expanded="false"` (`w1g-BEFORE016-ceap-badge-click.png`).
- After: a chip click gives `true`, a second click gives `false`. Same for the SVP chip on the pelvic page (`w1g-AFTER016-iliac-svp-open-light.png`).
- L2: set C2 → reload → CEAP opens with `aria-expanded="true"`. A fresh study stays folded.

**018 — headings**
- Visible h1–h3 per screen went from 0 to: venous 3, arterial 3, carotid 3, iliac 7. Section titles look the same (sizes and weights are unchanged, e.g. "დიაგრამა" 13px/600, the size `size="md"` resolves to in this theme). The collapsible wrapper computes margin 0, 13px/400 inherited, and the header height is unchanged (≈66px).

**022 — dark anatomy + legend**
- Before: near-white silhouette in dark, R/L invisible (`w1g-BEFORE022-venous-diagram-dark.png`).
- After: silhouette `rgb(51,65,85)`, R/L and the outline clearly visible on venous and arterial (`w1g-AFTER022-venous-diagram-dark.png`, `w1g-AFTER022-arterial-diagram-dark.png`).
- Legend hairline: `w1g-AFTER022-legend-dark-crop.png`. The occlusion swatch is separable from the card.

## Decisions

1. **021 L3 (EMRButton passes a Mantine variant) skipped.** It is optional, and with the order fixed every variant computes as designed. Passing e.g. `variant="transparent"` would not protect primaries if the order regressed. A regression test (`src/main.test.ts`) locks the import order instead.
2. **018 needed one theme.css rule change.** The global `h2 { font-size: var(--emr-font-xl) !important }` would have made every promoted title visibly bigger. Scoping it with `:not(.mantine-Text-root)` affects only Mantine Text rendered as a heading. Today that is my new headings plus the unused `EMRBottomSheet`. Raw `<h1>/<h2>` elements and `<Title>` keep the rule.
3. **Collapsible heading wraps the button**, not the other way round, because `role="button"` flattens its children for assistive tech. The heading's accessible name also includes the subtitle and the summary chip, which is verbose but accurate.
4. **016 interactive test** uses a selector (`button, a[href], input, select, textarea, label, [role=button|checkbox|switch|menuitem|tab], [tabindex≥0]`) bounded to the rightSection box. Today all three callers (CEAP, SVP, NASCET) pass passive previews.
5. **CEAP "has a value" = `value != null`.** The form keeps `ceap` undefined until a clinician touches it (or a template sets it), so a saved all-baseline C0/En/An/Pn also opens. That is intended: it was recorded.
6. **Recommendations empty state** puts the muted line in the header's second line instead of adding a body row. That gives one quiet row. The Recommendations card keeps the theme-blue priority strips (no clinical meaning changed).
7. **Legend hairline token** is `--emr-border-secondary` (navy-alpha). A stronger token would put a heavy double border on every light-mode swatch.

## Keys for W1-H (do not exist yet; component uses an English fallback meanwhile)

File: `src/translations/venous-le/{ka,en,ru}.json`, under `venousLE.recommendations` (RecommendationsBlock also renders on arterial and carotid, but all its keys live under `venousLE.recommendations.*`).

| Key | ka | en | ru |
|---|---|---|---|
| `venousLE.recommendations.remove` | რეკომენდაციის წაშლა | Delete recommendation | Удалить рекомендацию |

No other keys were added or changed.

## Handoffs / unproven items

- **018 "headingCount ≥ 5" is not met on venous, arterial or carotid (3 each)** inside this fence. The remaining titled decks render titles as Mantine `Text` in files owned by other fences: `SegmentAssessmentCard.tsx` (W2-venous), `ReflexTimeTable.tsx` and `SegmentTable.tsx` (W1-C/W3), `ArterialSegmentTable.tsx` (W1-H), `SegmentalPressureTable.tsx` (W1-F), `CarotidSegmentTable.tsx` (W2-carotid). Because of the theme.css scoping above, adding `component="h2"` to those title `Text`s is now a zero-visual-change one-liner for their owners.
- **One-gradient-primary-per-screen**: the EMRButton primaries left are PDF download and the banner's "+ კვლევის დამატება" (`EncounterContextBanner.tsx`, W1-E). Other gradient hits are not actions (active study chip, active side tab, active draw toggle) or are the custom "+ ახალი კვლევა" button (UX-ANGIO-005, W2).
- **375px horizontal overflow (scrollWidth 548)** on study screens comes from the SegmentAssessmentCard title (W2-venous) and the FormActions PDF button (W1-B, UX-ANGIO-024). My decks fit (right edge 363px).
- 022 L3 stepper/moon HYPOTHESIS (global dark `.tabler-icon` rule) not tested. It needs DevTools rule toggling, which the harness doesn't offer.
- 768px not shot separately (1440 / 375 / dark were the brief).
- Design-critic and composition-metrics re-runs (023 / 021 "done when") are for the UI-X re-shoot (021 L2). The numbers above are my live measurements.
- The `w1g` browser context created two test visits ("W1G ტესტი", "W1G ოთხი კვლევა"). They live only in that context's storage.
